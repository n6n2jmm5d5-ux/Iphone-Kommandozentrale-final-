// Standalone local RML server: serves editor and renders only explicitly approved drafts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.RML_PORT||4177);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
function send(res,status,body,headers={}){res.writeHead(status,{'cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(body)}
let currentJob=null;
const jobs=new Map();
const json=(res,status,obj)=>send(res,status,JSON.stringify(obj),{'content-type':'application/json; charset=utf-8'});
const readBody=async req=>{let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error('Payload too large')}return JSON.parse(body)};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&['/','/index.html','/app.js','/style.css'].includes(url.pathname)){
    const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
    return send(res,200,fs.readFileSync(file),{'content-type':mime[path.extname(file)]});
  }
  if(req.method==='POST'&&url.pathname==='/api/film'){
    if(currentJob)return json(res,409,{error:'Eine Filmproduktion läuft bereits',id:currentJob});
    let input;try{input=await readBody(req)}catch{return json(res,400,{error:'Ungültige Eingabe'})}
    const topic=String(input.topic||'').trim();
    if(topic.length<12||topic.length>400)return json(res,400,{error:'Thema muss 12–400 Zeichen lang sein'});
    const id=String(Date.now())+'-'+Math.random().toString(36).slice(2,8);
    const job={id,topic,status:'läuft',created:new Date().toISOString(),approved:false};
    jobs.set(id,job);currentJob=id;
    const work=path.join(root,'productions');fs.mkdirSync(work,{recursive:true});
    const proc=spawn(process.execPath,[path.join(root,'production.mjs'),topic],{cwd:root,env:{...process.env,RML_OUTPUT:work},stdio:['ignore','pipe','pipe']});
    let output='',error='';
    proc.stdout.on('data',d=>output+=d.toString().slice(-16000));
    proc.stderr.on('data',d=>error+=d.toString().slice(-4000));
    proc.on('error',e=>{job.status='fehler';job.error=e.message;currentJob=null});
    proc.on('close',code=>{
      if(code===0){try{const result=JSON.parse(output.trim());job.status='prüfen';job.video=result.video;job.sources=result.sources}catch{job.status='fehler';job.error='Ungültige Produktionsantwort'}}
      else{job.status='fehler';job.error=error.slice(-1200)||'Filmproduktion fehlgeschlagen'}
      currentJob=null;
    });
    return json(res,202,{id,status:job.status});
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/film/')){
    const parts=url.pathname.split('/'),id=parts[3],job=jobs.get(id);
    if(!job)return json(res,404,{error:'Filmauftrag nicht gefunden'});
    if(parts[4]==='video'){
      if(job.status!=='prüfen'||!job.video||!fs.existsSync(job.video))return json(res,409,{error:'Video noch nicht verfügbar'});
      res.writeHead(200,{'content-type':'video/mp4','content-disposition':'attachment; filename="rml-film-entwurf.mp4"','cache-control':'no-store'});
      return fs.createReadStream(job.video).pipe(res);
    }
    if(parts[4]==='sources'){
      if(job.status!=='prüfen'||!job.sources||!fs.existsSync(job.sources))return json(res,409,{error:'Quellen noch nicht verfügbar'});
      return send(res,200,fs.readFileSync(job.sources),{'content-type':'application/json'});
    }
    return json(res,200,{id:job.id,topic:job.topic,status:job.status,error:job.error||null,videoReady:job.status==='prüfen',approved:false});
  }
  if(req.method==='POST'&&url.pathname==='/api/render'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)return send(res,413,'Payload too large')}
    let post;try{post=JSON.parse(body)}catch{return send(res,400,'Invalid JSON')}
    if(post.status!=='Freigegeben')return send(res,403,'Freigabe erforderlich');
    if(!String(post.hook||post.title||'').trim())return send(res,400,'Text fehlt');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rml-'));
    const json=path.join(dir,'post.json'),video=path.join(dir,'reel.mp4');
    fs.writeFileSync(json,JSON.stringify(post));
    const proc=spawn(process.execPath,[path.join(root,'render-reel.mjs'),json,video],{stdio:['ignore','ignore','pipe']});
    let error='';proc.stderr.on('data',d=>{error+=d.toString().slice(0,3000)});
    proc.on('error',e=>{fs.rmSync(dir,{recursive:true,force:true});send(res,500,e.message)});
    proc.on('close',code=>{if(res.writableEnded)return;if(code!==0){fs.rmSync(dir,{recursive:true,force:true});return send(res,500,error||'Renderer fehlgeschlagen')}const file=fs.createReadStream(video);res.writeHead(200,{'content-type':'video/mp4','content-disposition':'attachment; filename="rml-reel.mp4"','cache-control':'no-store'});file.pipe(res);res.on('close',()=>fs.rmSync(dir,{recursive:true,force:true}))});
    return;
  }
  send(res,404,'Not found');
});
server.listen(port,'127.0.0.1',()=>console.log('RML editor: http://127.0.0.1:'+port));
