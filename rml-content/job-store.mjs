// Durable job store and process runner. Production is NEVER an approval to publish.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const base=path.resolve(process.env.RML_DATA_DIR||'./rml-data');
fs.mkdirSync(base,{recursive:true});
const jobsDir=path.join(base,'jobs');fs.mkdirSync(jobsDir,{recursive:true});
const read=id=>{if(!/^[a-f0-9-]{36}$/.test(id))return null;try{return JSON.parse(fs.readFileSync(path.join(jobsDir,id+'.json'),'utf8'))}catch{return null}};
const write=j=>{const target=path.join(jobsDir,j.id+'.json'),tmp=target+'.tmp';fs.writeFileSync(tmp,JSON.stringify(j,null,2));fs.renameSync(tmp,target)};
const list=()=>fs.readdirSync(jobsDir).filter(f=>f.endsWith('.json')).map(f=>read(f.slice(0,-5))).filter(Boolean).sort((a,b)=>b.created.localeCompare(a.created));
let busy=null;
export function createJob(topic,root){
 if(busy)return {error:'Eine Produktion läuft bereits',active:busy};
 const j={id:crypto.randomUUID(),topic,status:'warteschlange',created:new Date().toISOString(),approved:false};write(j);busy=j.id;
 const proc=spawn(process.execPath,[path.join(root,'production.mjs'),topic],{cwd:root,env:{...process.env,RML_OUTPUT:path.join(base,'productions')},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';
 proc.stdout.on('data',d=>stdout+=d.toString().slice(-100000));
 proc.stderr.on('data',d=>stderr+=d.toString().slice(-100000));
 j.status='in_bearbeitung';write(j);
 let finished=false;
 const done=(err,code)=>{if(finished)return;finished=true;busy=null;
  if(err||code!==0){j.status='fehler';j.error=String(err?.message||stderr||'Render exit '+code).slice(-2000)}
  else try{const result=JSON.parse(stdout.trim());if(!result.video||!fs.existsSync(result.video))throw Error('Video fehlt');j.status='zur_pruefung';j.video=result.video;j.sources=result.sources}
  catch(e){j.status='fehler';j.error=e.message}
  j.finished=new Date().toISOString();write(j)};
 proc.on('error',e=>done(e));proc.on('close',code=>done(null,code));
 return {id:j.id,status:j.status};
}
export const getJob=read;
export const listJobs=list;
export function recoverInterrupted(){for(const j of list()){if(['warteschlange','in_bearbeitung'].includes(j.status)){j.status='unterbrochen';j.error='Serverneustart während Produktion; Auftrag erneut starten';write(j)}}}
recoverInterrupted();
