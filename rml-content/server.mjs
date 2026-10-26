// Standalone local RML server: serves editor and renders only explicitly approved drafts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createJob,getJob,listJobs} from './job-store.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.RML_PORT||4177);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
function send(res,status,body,headers={}){res.writeHead(status,{'cache-control':'no-store','x-content-type-options':'nosniff',...headers});res.end(body)}
const json=(res,status,obj)=>send(res,status,JSON.stringify(obj),{'content-type':'application/json; charset=utf-8'});
const readBody=async req=>{let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)throw Error('Payload too large')}return JSON.parse(body)};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&['/','/index.html','/app.js','/style.css'].includes(url.pathname)){
    const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
    return send(res,200,fs.readFileSync(file),{'content-type':mime[path.extname(file)]});
  }
  if(req.method==='GET'&&url.pathname==='/api/films')return json(res,200,listJobs().map(({id,topic,status,created,error})=>({id,topic,status,created,error})));
  if(req.method==='POST'&&url.pathname==='/api/film'){
    let input;try{input=await readBody(req)}catch{return json(res,400,{error:'Ungültige Eingabe'})}
    const topic=String(input.topic||'').trim();
    if(topic.length<12||topic.length>400)return json(res,400,{error:'Thema muss 12–400 Zeichen lang sein'});
    const result=createJob(topic,root);
    return json(res,result.error?409:202,result);
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/film/')){
    const parts=url.pathname.split('/'),job=getJob(parts[3]);
    if(!job)return json(res,404,{error:'Filmauftrag nicht gefunden'});
    if(parts[4]==='video'||parts[4]==='sources'){
      const file=parts[4]==='video'?job.video:job.sources;
      if(job.status!=='zur_pruefung'||!file||!fs.existsSync(file))return json(res,409,{error:'Datei noch nicht verfügbar'});
      if(parts[4]==='video'){
        res.writeHead(200,{'content-type':'video/mp4','content-disposition':'attachment; filename="rml-film-entwurf.mp4"','cache-control':'no-store'});
        return fs.createReadStream(file).pipe(res);
      }
      return send(res,200,fs.readFileSync(file),{'content-type':'application/json'});
    }
    return json(res,200,{id:job.id,topic:job.topic,status:job.status,error:job.error||null,videoReady:job.status==='zur_pruefung',approved:false});
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
server.listen(port,process.env.RML_BIND||'127.0.0.1',()=>console.log('RML editor: http://127.0.0.1:'+port));
