import fs from 'node:fs';
import path from 'node:path';

export const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id)&&redactSecrets(id)===id;
export function redactSecrets(text){
  return String(text??'').replace(/\b(?:sk-|ghp_|github_pat_|gho_)[A-Za-z0-9_-]{8,}/g,'[entfernt]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[entfernt]')
    .replace(/((?:access_token|refresh_token|id_token|api_key|apikey|password|authorization)\s*["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi,'$1[entfernt]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi,'Bearer [entfernt]')
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[entfernt]');
}
const within=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep)};

export class TaskStore{
  constructor(projectRoot,directory='.kz-data'){
    this.root=fs.realpathSync(projectRoot);
    this.dir=path.resolve(this.root,directory);
    if(!within(this.root,this.dir))throw Error('Auftragsspeicher muss im Projekt liegen');
    // Do not follow symlinks/junctions into a different directory.
    let current=this.root;
    for(const part of path.relative(this.root,this.dir).split(path.sep)){
      current=path.join(current,part);
      if(fs.existsSync(current)){if(fs.lstatSync(current).isSymbolicLink()||!fs.statSync(current).isDirectory())throw Error('Unsicherer Auftragsspeicher')}
      else fs.mkdirSync(current,{mode:0o700});
    }
    this.file=path.join(this.dir,'tasks.json');this.lock=path.join(this.dir,'server.lock');
    for(const f of [this.file,this.lock,path.join(this.dir,'tasks.tmp')])if(fs.existsSync(f)&&fs.lstatSync(f).isSymbolicLink())throw Error('Unsichere Speicherdatei');
    if(fs.existsSync(this.lock)){
      const pid=Number(fs.readFileSync(this.lock,'utf8'));
      if(!Number.isSafeInteger(pid)||pid<=0)throw Error('Ungültige Auftragsspeicher-Sperre');
      let alive=true;try{process.kill(pid,0)}catch(e){if(e.code==='ESRCH')alive=false}
      if(alive)throw Error('Auftragsspeicher bereits durch einen Server geöffnet');
      fs.unlinkSync(this.lock);
    }
    fs.writeFileSync(this.lock,String(process.pid),{flag:'wx',mode:0o600});
    try{
      const data=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{version:1,tasks:[]};
      if(data.version!==1||!Array.isArray(data.tasks))throw Error('Ungültiger Auftragsspeicher');
      this.jobs=new Map();
      for(const row of data.tasks){
        if(!validId(row.id)||this.jobs.has(row.id)||!['wait','work','wartet_auf_freigabe','done','error'].includes(row.state))throw Error('Ungültiger gespeicherter Auftrag');
        this.jobs.set(row.id,row);
      }
      // Never replay an uncertain execution after a restart.
      for(const job of this.jobs.values())if(job.state==='work'||job.state==='wait'){
        job.state='error';job.done=false;job.result='';job.error='Serverneustart: Ausführung wurde unterbrochen und nicht erneut gestartet.';
        job.finishedAt=new Date().toISOString();job.history.push({state:'error',at:job.finishedAt});
      }
      this.save();
    }catch(e){this.close();throw e}
  }
  save(){
    const rows=[...this.jobs.values()].map(job=>({
      id:job.id,text:redactSecrets(job.text),worker:job.worker,requestedWorker:job.requestedWorker,skillId:job.skillId,mode:job.mode,
      state:job.state,done:job.state==='done',result:redactSecrets(job.result||''),error:redactSecrets(job.error||''),
      createdAt:job.createdAt,startedAt:job.startedAt||null,finishedAt:job.finishedAt||null,
      approvedAt:job.approvedAt||null,requiresApproval:!!job.requiresApproval,history:job.history,execution:job.execution||null
    }));
    const temp=path.join(this.dir,'tasks.tmp');
    const fd=fs.openSync(temp,'w',0o600);
    try{fs.writeFileSync(fd,JSON.stringify({version:1,tasks:rows}));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    fs.renameSync(temp,this.file);
  }
  close(){if(fs.existsSync(this.lock)&&fs.readFileSync(this.lock,'utf8')===String(process.pid))fs.unlinkSync(this.lock)}
}
