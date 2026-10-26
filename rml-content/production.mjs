#!/usr/bin/env node
// One-command pipeline: acquire legal footage -> verify -> cinematic draft -> approval.
// node production.mjs "Wer im Restaurant frisch kocht, ist noch lange kein guter Koch."
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
const topic=process.argv.slice(2).join(' ').trim();
if(!topic)throw Error('Bitte Thema angeben');
const root=path.dirname(new URL(import.meta.url).pathname);
const out=path.resolve(process.env.RML_OUTPUT||'./rml-productions');
await fs.mkdir(out,{recursive:true});
const job=await fs.mkdtemp(path.join(out,'job-'));
const run=(bin,args)=>new Promise((resolve,reject)=>{const p=spawn(bin,args,{stdio:['ignore','pipe','pipe']});let err='';p.stderr.on('data',d=>err+=d.toString().slice(-3000));p.on('error',reject);p.on('close',c=>c===0?resolve():reject(Error(bin+' exit '+c+': '+err)))});
const state={topic,createdAt:new Date().toISOString(),status:'beschaffung',approved:false,publicationAllowed:false,job};
const save=()=>fs.writeFile(path.join(job,'job.json'),JSON.stringify(state,null,2));
await save();
try{
 await run(process.execPath,[path.join(root,'auto-footage.mjs'),topic,'--out',job,'--count','5']);
 const manifest=JSON.parse(await fs.readFile(path.join(job,'sources.json'),'utf8'));
 if(manifest.selected.length!==5)throw Error('Nicht genug Clips');
 state.status='schnitt';await save();
 const inputs=[],filters=[],lengths=[];
 for(let i=0;i<5;i++){
  const file=path.join(job,manifest.selected[i].file);
  const probe=await new Promise((resolve,reject)=>{const p=spawn('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]);let s='';p.stdout.on('data',d=>s+=d);p.on('error',reject);p.on('close',c=>c===0?resolve(Number(s.trim())):reject(Error('ffprobe failed')))});
  if(probe<5.6)throw Error('Clip zu kurz: '+manifest.selected[i].title);
  lengths.push(6);
  inputs.push('-i',file);
  filters.push('['+i+':v]trim=duration=6,setpts=PTS-STARTPTS,fps=25,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p,eq=contrast=1.06:saturation=0.92[v'+i+']');
 }
 let last='v0';
 for(let i=1;i<5;i++){const next='x'+i;filters.push('['+last+'][v'+i+']xfade=transition=fade:duration=0.5:offset='+(i*5.5)+'['+next+']');last=next}
 const target=path.join(job,'entwurf.mp4');
 await run('ffmpeg',['-hide_banner','-loglevel','error','-y',...inputs,'-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-filter_complex',filters.join(';'),'-map','['+last+']','-map','5:a:0','-c:v','libx264','-preset','veryfast','-crf','21','-profile:v','main','-level:v','4.2','-pix_fmt','yuv420p','-r','25','-c:a','aac','-b:a','96k','-t','28','-movflags','+faststart',target]);
 state.status='wartet_auf_redaktionelle_pruefung';state.video=target;state.sources=path.join(job,'sources.json');state.note='Review scene relevance, license attribution and share-alike terms. No automatic publication.';await save();
 console.log(JSON.stringify(state,null,2));
}catch(e){state.status='fehler';state.error=e.message;await save();console.error(JSON.stringify(state,null,2));process.exitCode=1}
