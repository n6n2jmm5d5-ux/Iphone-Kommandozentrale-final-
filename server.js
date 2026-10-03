import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
const root=path.dirname(fileURLToPath(import.meta.url)),port=process.env.PORT||3000;
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
const body=req=>new Promise((ok,no)=>{let d='',size=0;req.on('data',c=>{size+=c.length;if(size>65536){no(Object.assign(Error('Anfrage zu groß'),{status:413}));req.resume();return}d+=c});req.on('error',no);req.on('aborted',()=>no(Error('Anfrage abgebrochen')));req.on('end',()=>{try{ok(d?JSON.parse(d):{})}catch{no(Object.assign(Error('Ungültiges JSON'),{status:400}))}})});
// Preserve an explicit Codex home; otherwise use the real user's default directory.
const envClean=()=>{let e={...process.env,OPENAI_API_KEY:'',ANTHROPIC_API_KEY:'',NO_COLOR:'1',TERM:'dumb',CI:'0',CLICOLOR:'0',FORCE_COLOR:'0'};if(!e.CODEX_HOME)e.CODEX_HOME=path.join(homedir(),'.codex');return e};
// Resolve only fixed tool names, without a shell or user-supplied commands.
const toolNames=new Set(['codex','claude','git','node','python','python3','ffmpeg']);
function executable(cmd){
  if(!toolNames.has(cmd))return null;
  if(cmd==='node')return process.execPath;
  const names=cmd==='python'||cmd==='python3'?['python3','python']:[cmd];
  const dirs=(process.env.PATH||process.env.Path||'').split(path.delimiter).filter(Boolean);
  for(const name of names)for(const dir of dirs)for(const ext of process.platform==='win32'?['.exe','.com']:['']){
    const file=path.resolve(dir.replace(/^"|"$/g,''),name+ext);
    try{if(fs.statSync(file).isFile()){fs.accessSync(file,process.platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return file}}catch{}
  }
  return null;
}
const runningProcesses=new Set();
const run=(cmd,args=[],cwd=root,timeout=15000)=>new Promise(resolve=>{let file=executable(cmd);if(!file)return resolve({ok:false,error:'Programm nicht gefunden: '+cmd,stdout:'',stderr:''});let p=spawn(file,args,{cwd,env:envClean(),shell:false,stdio:['ignore','pipe','pipe']}),out='',err='',done=false;p.stdout?.setEncoding('utf8');p.stderr?.setEncoding('utf8');runningProcesses.add(p);p.on('close',()=>runningProcesses.delete(p));let finish=r=>{if(done)return;done=true;clearTimeout(timer);try{p.kill('SIGTERM')}catch{}resolve(r)};p.stdout?.on('data',d=>{out+=d;if(out.length>2000000)finish({ok:false,error:'Codex-Ausgabe zu groß',stdout:'',stderr:''})});p.stderr?.on('data',d=>{err=(err+d).slice(-16000)});p.on('error',e=>finish({ok:false,error:e.message,stdout:out,stderr:err}));p.on('close',code=>finish({ok:code===0,code,stdout:out,stderr:err}));let timer=setTimeout(()=>finish({ok:false,timeout:true,stdout:out,stderr:err}),timeout)});
const present=async c=>Boolean(executable(c));
const clean=s=>String(s||'').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -\/]*[@-~])/g,'').replace(/\r/g,'').trim().slice(-16000);
const authText=r=>clean(String((r.stdout||'')+'\n'+(r.stderr||'')));
const loginJobs=new Map();
async function authStatus(type){if(type==='chatgpt'){if(!await present('codex'))return {installed:false,connected:false};let r=await run('codex',['login','status'],root,8000);return {installed:true,connected:r.ok,detail:authText(r)}}if(type==='claude'){if(!await present('claude'))return {installed:false,connected:false};let r=await run('claude',['auth','status'],root,8000);return {installed:true,connected:r.ok,detail:authText(r)}}return {installed:false,connected:false}}
async function diagnostics(){if(!await present('codex'))return {installed:false};let v=await run('codex',['--version'],root,8000),h=await run('codex',['login','--help'],root,8000);return {installed:true,version:authText(v),deviceAuthSupported:/device-auth/.test(authText(h)),loginHelp:authText(h).slice(0,3000)}}
async function aiState(){let chatgpt=await authStatus('chatgpt'),claude=await authStatus('claude');return {ok:true,paidApi:false,chatgpt:{supported:true,...chatgpt,mode:'chatgpt-plan-codex',loginAvailable:chatgpt.installed},claude:{supported:true,...claude,mode:'claude-pro-max-code',loginAvailable:claude.installed,note:'Claude bleibt optional und kann nach einem Pro/Max-Upgrade angemeldet werden.'}}}
function jobView(type){let j=loginJobs.get(type);if(!j)return {running:false,output:''};return {running:j.running,finished:j.finished,code:j.code,output:clean(j.output),started:j.started}}
function waitForOutput(job,ms=10000){return new Promise(resolve=>{let start=Date.now(),t=setInterval(()=>{if(clean(job.output)||!job.running||Date.now()-start>=ms){clearInterval(t);resolve()}},150)})}
async function startLogin(type){if(type==='chatgpt'){let d=await diagnostics();if(!d.installed)return {ok:false,error:'Codex CLI ist noch nicht installiert.'};if(!d.deviceAuthSupported)return {ok:false,error:'Die installierte Codex-Version unterstützt --device-auth nicht.',diagnostics:d};let old=loginJobs.get(type);if(old?.running)return {ok:true,type,flow:'device-auth',diagnostics:d,...jobView(type)};let job={running:true,finished:false,code:null,output:'',started:Date.now()},p=spawn(executable('codex'),['login','--device-auth'],{cwd:root,env:envClean(),shell:false,stdio:['ignore','pipe','pipe']});job.process=p;loginJobs.set(type,job);p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');p.stdout.on('data',d=>job.output+=d);p.stderr.on('data',d=>job.output+=d);p.on('error',e=>{job.output+='\n'+e.message;job.running=false;job.finished=true});p.on('close',code=>{job.code=code;job.running=false;job.finished=true});await waitForOutput(job,10000);let view=jobView(type);if(!view.output&&job.running){job.output+='\nCodex läuft, hat aber noch keinen Gerätecode ausgegeben. Prüfe, ob Device-Code-Autorisierung in den ChatGPT-Sicherheitseinstellungen aktiviert ist.';view=jobView(type)}return {ok:true,type,flow:'device-auth',diagnostics:d,...view}}if(type==='claude'){if(!await present('claude'))return {ok:false,error:'Claude Code ist noch nicht installiert. Die Anmeldemöglichkeit bleibt erhalten.'};let r=await run('claude',['auth','login'],root,12000);return {ok:r.ok||r.timeout,type,flow:'browser-login',output:authText(r)}}return {ok:false,error:'Unbekannter Anbieter'}}

const executions=new Map();
const executionTimeout=120000;
const safeError=text=>clean(text).replace(/\bsk-[A-Za-z0-9_-]+/g,'[entfernt]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[entfernt]');
function executionView(job){return {id:job.id,state:job.state,done:job.state==='done',result:job.result||'',error:job.error||''}}
async function executeTask(req,res){
  if(req.method!=='POST')return json(res,405,{ok:false,error:'POST erforderlich'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{ok:false,error:'JSON erforderlich'});
  const b=await body(req);
  if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(b.id)||typeof b.text!=='string'||!b.text.trim()||b.text.length>12000)return json(res,400,{ok:false,error:'Ungültiger Auftrag (ID und Text, maximal 12000 Zeichen erforderlich)'});
  for(const [id,job] of executions)if(job.state!=='work'&&Date.now()-job.finished>3600000)executions.delete(id);
  const old=executions.get(b.id);
  if(old){if(old.text!==b.text)return json(res,409,{ok:false,error:'Auftrags-ID bereits mit anderem Text verwendet'});return json(res,old.state==='work'?409:old.state==='done'?200:502,{ok:old.state==='done',...executionView(old)})}
  if(executions.size>=100||[...executions.values()].filter(j=>j.state==='work').length>=2)return json(res,503,{ok:false,error:'Ausführungsdienst ausgelastet'});
  const job={id:b.id,text:b.text,state:'work'};executions.set(job.id,job);
  try{
    const auth=await authStatus('chatgpt');
    if(!auth.connected||!auth.detail.includes('Logged in using ChatGPT'))throw Error('Keine bestehende ChatGPT-Anmeldung verfügbar. '+auth.detail);
    // Fixed client/options. The prompt is a single positional argument after --, never shell code.
    const r=await run('codex',['exec','--sandbox','read-only','--ephemeral','--ignore-user-config','--json','--',b.text],root,executionTimeout);
    const replies=[],errors=[];
    for(const line of r.stdout.split('\n')){try{const e=JSON.parse(line);if(e.type==='item.completed'&&e.item?.type==='agent_message')replies.push(e.item.text);if(e.type==='error'||e.type==='turn.failed')errors.push(e.message||e.error?.message||'Codex-Ausführung fehlgeschlagen')}catch{}}
    if(!r.ok||errors.length)throw Error(r.timeout?'Codex-Auftrag nach 120 Sekunden abgebrochen':errors.join('\n')||r.error||r.stderr||'Codex beendet mit Exitcode '+r.code);
    if(!replies.length||!replies.join('\n').trim())throw Error('Codex hat keine Antwort zurückgegeben');
    job.result=replies.join('\n');job.state='done';
  }catch(e){job.state='error';job.error=safeError(e.message)}finally{job.finished=Date.now()}
  return json(res,job.state==='done'?200:502,{ok:job.state==='done',...executionView(job)});
}

async function api(req,res,u){if(u.pathname==='/api/tasks')return executeTask(req,res);if(u.pathname.startsWith('/api/tasks/')){if(req.method!=='GET')return json(res,405,{ok:false,error:'GET erforderlich'});const j=executions.get(u.pathname.slice('/api/tasks/'.length));return json(res,j?200:404,j?{ok:true,...executionView(j)}:{ok:false,error:'Auftrag nicht mehr im Ausführungsdienst vorhanden'})}if(u.pathname==='/api/health')return json(res,200,{ok:true,service:'kommandozentrale'});if(u.pathname==='/api/diagnostics')return json(res,200,{ok:true,codex:await diagnostics()});if(u.pathname==='/api/capabilities'){let a=await aiState();return json(res,200,{node:true,python:await present('python3'),git:await present('git'),ffmpeg:await present('ffmpeg'),claude:a.claude.installed,codex:a.chatgpt.installed,claudeConnected:a.claude.connected,codexConnected:a.chatgpt.connected,paidApi:false})}if(u.pathname==='/api/ai-status')return json(res,200,await aiState());if(u.pathname==='/api/auth/start'&&req.method==='POST'){let b=await body(req),r=await startLogin(String(b.type||''));return json(res,r.ok?200:503,r)}if(u.pathname==='/api/auth/status'){let type=String(u.searchParams.get('type')||'chatgpt'),auth=await authStatus(type);return json(res,200,{ok:true,type,...auth,...jobView(type)})}if(u.pathname==='/api/session'&&req.method==='POST'){let b=await body(req),type=String(b.type||''),s=await authStatus(type==='codex'?'chatgpt':type);if(!s.installed)return json(res,503,{ok:false,error:'Der benötigte Client ist noch nicht installiert.'});if(!s.connected)return json(res,401,{ok:false,error:'Noch nicht angemeldet. Bitte zuerst die Anmeldung in der Kommandozentrale starten.'});return json(res,200,{ok:true,type})}return json(res,404,{ok:false,error:'Nicht gefunden'})}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.md':'text/markdown; charset=utf-8'};
const publicFiles=new Set(['index.html','styles.css','app.js','agent-layer.js','sw.js','manifest.webmanifest']);
const realRoot=fs.realpathSync(root);
function publicFile(pathname){
  let rel;try{rel=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1))}catch{return null}
  if(!publicFiles.has(rel))return null;
  try{
    const file=fs.realpathSync(path.resolve(root,rel)),relative=path.relative(realRoot,file);
    if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)||!fs.statSync(file).isFile())return null;
    return file;
  }catch{return null}
}
const server=http.createServer(async(req,res)=>{try{const host=req.headers.host;const allowedHosts=new Set(['127.0.0.1:'+port,'localhost:'+port]);if(!allowedHosts.has(host))return json(res,403,{ok:false,error:'Unzulässiger Host'});if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(res,403,{ok:false,error:'Unzulässiger Ursprung'});let u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/'))return await api(req,res,u);const f=publicFile(u.pathname);if(!f){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(f);stream.on('error',()=>res.destroy());stream.pipe(res)}catch(e){json(res,e.status||500,{ok:false,error:safeError(e.message)})}}).listen(port,'127.0.0.1',()=>console.log('Kommandozentrale auf http://127.0.0.1:'+port));
function shutdown(){for(const p of runningProcesses)p.kill();for(const job of loginJobs.values())job.process?.kill();server.close();server.closeAllConnections()}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
