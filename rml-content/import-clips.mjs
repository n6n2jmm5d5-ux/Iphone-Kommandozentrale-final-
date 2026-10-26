// Import five locally available licensed videos, with human license review before approval.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const [sourceDir,projectDir]=process.argv.slice(2);
if(!sourceDir||!projectDir)throw Error('Usage: node import-clips.mjs SOURCE_FOLDER PROJECT_FOLDER');
const source=path.resolve(sourceDir),dest=path.resolve(projectDir),clipsDir=path.join(dest,'clips');
const names=['messerarbeit','pfanne','anrichten','service','gericht'];
const texts=['FRISCH IST NICHT GENUG.','HITZE. TIMING. TECHNIK.','HANDWERK ZEIGT SICH IM DETAIL.','ERKENNST DU DEN UNTERSCHIED?','WAS MACHT EINEN GUTEN KOCH AUS?'];
fs.mkdirSync(clipsDir,{recursive:true});
const all=fs.readdirSync(source).filter(f=>/\.(mp4|mov|m4v)$/i.test(f)).sort();
if(all.length<5)throw Error('Five real video files are required; found '+all.length);
const clips=[];
for(let i=0;i<5;i++){
 const input=path.join(source,all[i]);
 const p=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,duration','-of','json',input],{encoding:'utf8'});
 if(p.status!==0)throw Error('Invalid video: '+input);
 const info=JSON.parse(p.stdout).streams?.[0],duration=Number(info?.duration)||0;
 if(duration<6.4)throw Error('Clip must be at least 6.4 seconds: '+input);
 const file=path.join(clipsDir,names[i]+'.mp4');fs.copyFileSync(input,file);
 clips.push({file:'clips/'+names[i]+'.mp4',seconds:6.4,overlay:texts[i],originalFilename:all[i]});
}
const manifest={status:'Entwurf',title:'Wer im Restaurant frisch kocht, ist noch lange kein guter Koch.',clips};
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({imported:clips.length,manifest:path.join(dest,'manifest.json'),status:'Awaiting human license review and approval'},null,2));
