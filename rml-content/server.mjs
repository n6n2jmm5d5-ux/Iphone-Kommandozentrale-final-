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
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&['/','/index.html','/app.js','/style.css'].includes(url.pathname)){
    const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1));
    return send(res,200,fs.readFileSync(file),{'content-type':mime[path.extname(file)]});
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
