import './registry.js';
import {validId,redactSecrets} from './task-store.js';

const registry=globalThis.KZRegistry;
const failure=(status,message)=>Object.assign(Error(message),{status});
export function workspaceProfile(root,storeDir){
  const fields=['":root"="read"',JSON.stringify(root)+'="write"',JSON.stringify(root+ '/.git')+'="read"',JSON.stringify(root+'/.codex')+'="read"'];
  if(storeDir)fields.push(JSON.stringify(storeDir)+'="read"');
  const profile='{filesystem={'+fields.join(',')+'},network={enabled=false}}';
  return ['-c','permissions.kz_project='+profile,'-c','default_permissions="kz_project"'];
}
export function codexArguments(mode,root,text,storeDir){
  if(!['read-only','workspace-write'].includes(mode))throw failure(400,'Ungültiger Arbeitsmodus');
  const policy=mode==='read-only'?['--sandbox','read-only']:workspaceProfile(root,storeDir);
  return ['exec',...policy,'--ephemeral','--ignore-user-config','--json','--cd',root,
    '-c','approval_policy="never"','-c','web_search="disabled"',
    '-c','shell_environment_policy.experimental_use_profile=false',
    ...(process.platform==='win32'?['-c','windows.sandbox="unelevated"']:[]),
    '-c','developer_instructions="Only work within the project. Never read credentials or authentication files. Never publish, send messages, or run git push. Do not bypass sandbox restrictions."',
    '--',text];
}
export function executionSummary(result){
  const summary={exitCode:result.code??null,timedOut:!!result.timeout,toolCalls:0,failedToolCalls:0,sandboxDenied:0};
  for(const line of (result.stdout||'').split('\n')){try{const e=JSON.parse(line),item=e.item;if(e.type==='item.completed'&&item&&['command_execution','file_change','mcp_tool_call'].includes(item.type)){summary.toolCalls++;if(item.status==='failed'||item.exit_code!==undefined&&item.exit_code!==0)summary.failedToolCalls++;if(/access (?:is )?denied|zugriff.*verweigert|sandbox.*(?:denied|reject|block)|permission denied|operation not permitted|read.only file system/i.test(item.aggregated_output||item.error?.message||''))summary.sandboxDenied++}}catch{}}
  return summary;
}
export function parseExecution(result){
  const replies=[],errors=[];
  for(const line of (result.stdout||'').split('\n')){
    try{const e=JSON.parse(line);
      if(e.type==='item.completed'&&e.item?.type==='agent_message'&&typeof e.item.text==='string')replies.push(e.item.text);
      if(e.type==='error'||e.type==='turn.failed')errors.push(e.message||e.error?.message||'Codex-Turn fehlgeschlagen');
    }catch{}
  }
  if(!result.ok||errors.length)throw Error(result.timeout?'Codex-Auftrag wegen Zeitüberschreitung abgebrochen':errors.join('\n')||result.error||result.stderr||'Codex beendet mit Exitcode '+result.code);
  if(!replies.at(-1)?.trim())throw Error('Codex hat keine Antwort zurückgegeben');
  return redactSecrets(replies.at(-1));
}

export class TaskService{
  constructor({store,run,authStatus,root,timeout=120000}){
    this.store=store;this.run=run;this.authStatus=authStatus;this.root=root;this.timeout=timeout;
    this.jobs=store.jobs;this.running=false;this.stopped=false;
  }
  list(){return [...this.jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(j=>this.view(j))}
  get(id){if(!validId(id))throw failure(400,'Ungültige Auftrags-ID');const job=this.jobs.get(id);if(!job)throw failure(404,'Auftrag nicht gefunden');return this.view(job)}
  view(job){return {...job,done:job.state==='done',ok:job.state!=='error'}}
  transition(job,state){const at=new Date().toISOString();job.state=state;job.done=state==='done';job.history.push({state,at});if(state==='work')job.startedAt=at;if(state==='done'||state==='error')job.finishedAt=at;this.store.save()}
  async create(input){
    if(!input||!validId(input.id)||typeof input.text!=='string'||!input.text.trim()||input.text.length>12000)throw failure(400,'Ungültiger Auftrag (maximal 12000 Zeichen)');
    if(redactSecrets(input.text)!==input.text)throw failure(400,'Auftrag enthält mögliche Zugangsdaten; diese dürfen nicht gespeichert werden');
    const chosen=input.worker??'chatgpt',mode=input.mode??'read-only';
    if(!['chatgpt','claude','auto'].includes(chosen)||!['read-only','workspace-write'].includes(mode)||input.requiresApproval!==undefined&&typeof input.requiresApproval!=='boolean')throw failure(400,'Ungültiger Agent, Modus oder Freigabewert');
    const old=this.jobs.get(input.id);
    if(old){if(old.text!==input.text||old.mode!==mode||old.requestedWorker!==undefined&&old.requestedWorker!==chosen)throw failure(409,'Auftrags-ID bereits vergeben');return this.view(old)}
    if(this.jobs.size>=1000)throw failure(503,'Lokaler Auftragsspeicher voll');
    let worker=chosen;
    if(chosen==='auto'){const auth=await this.authStatus('chatgpt');worker=registry.route(input.text,'auto',id=>id==='chatgpt'&&auth.connected);}
    // Recheck after asynchronous routing to prevent a racing duplicate submission.
    if(this.jobs.has(input.id))return this.create(input);
    const approval=mode==='workspace-write'||input.requiresApproval===true;
    const job={id:input.id,text:input.text,worker,requestedWorker:chosen,skillId:worker==='chatgpt'?(mode==='workspace-write'?'codex-write':'codex-read'):null,mode,
      state:approval?'wartet_auf_freigabe':'wait',done:false,result:'',error:'',createdAt:new Date().toISOString(),startedAt:null,finishedAt:null,approvedAt:null,requiresApproval:approval,history:[]};
    job.history.push({state:job.state,at:job.createdAt});this.jobs.set(job.id,job);
    try{this.store.save()}catch(e){this.jobs.delete(job.id);throw e}
    setImmediate(()=>this.pump());return this.view(job);
  }
  approve(id,approved){
    const job=this.jobs.get(this.get(id).id);
    if(approved!==true)throw failure(400,'Ausdrückliche Freigabe erforderlich');
    if(job.state!=='wartet_auf_freigabe')return this.view(job);
    job.approvedAt=new Date().toISOString();this.transition(job,'wait');setImmediate(()=>this.pump());return this.view(job);
  }
  async pump(){
    if(this.running||this.stopped)return;
    const job=[...this.jobs.values()].find(j=>j.state==='wait');if(!job)return;
    this.running=true;
    try{
      this.transition(job,'work');
      const agent=registry.agents.find(a=>a.id===job.worker);
      if(!agent?.executable)throw Error('Claude-Auftragsausführung ist noch nicht verfügbar.');
      const auth=await this.authStatus('chatgpt');
      if(!auth.connected||!auth.detail?.includes('Logged in using ChatGPT'))throw Error('Keine bestehende ChatGPT-Anmeldung verfügbar. '+(auth.detail||''));
      const result=await this.run('codex',codexArguments(job.mode,this.root,job.text,this.store.dir),this.root,this.timeout);
      if(this.stopped)return;
      job.execution=executionSummary(result);job.result=parseExecution(result);this.transition(job,'done');
    }catch(e){
      if(!this.stopped){job.result='';job.error=redactSecrets(e.message);try{this.transition(job,'error')}catch{this.stopped=true}}
    }finally{this.running=false;if(!this.stopped)setImmediate(()=>this.pump())}
  }
  stop(){
    this.stopped=true;
    for(const job of this.jobs.values())if(job.state==='work'||job.state==='wait'){
      job.result='';job.error='Server beendet: Auftrag wurde unterbrochen.';this.transition(job,'error');
    }
  }
}
