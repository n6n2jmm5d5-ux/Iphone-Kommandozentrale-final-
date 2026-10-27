#!/usr/bin/env node
// Self-contained test: creates two actual moving videos, edits them, probes output.
// No network access, stock footage, publishing or account secrets required.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rml-smoke-'));
const run=(bin,args)=>{const p=spawnSync(bin,args,{encoding:'utf8',timeout:120000});if(p.error||p.status!==0)throw Error(bin+': '+(p.stderr||p.error||p.status));return p.stdout};
try{
 for(let i=0;i<2;i++)run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',i?'testsrc2=size=360x640:rate=25':'testsrc=size=360x640:rate=25','-t','2','-an','-pix_fmt','yuv420p','-c:v','libx264','-preset','ultrafast',path.join(dir,'scene'+i+'.mp4')]);
 const output=path.join(dir,'draft.mp4');
 run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(dir,'scene0.mp4'),'-i',path.join(dir,'scene1.mp4'),'-filter_complex','[0:v][1:v]xfade=transition=fade:duration=0.5:offset=1.5,format=yuv420p[v]','-map','[v]','-c:v','libx264','-preset','ultrafast','-movflags','+faststart',output]);
 const data=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
 const video=data.streams.find(s=>s.codec_type==='video');
 if(video?.codec_name!=='h264'||video.width!==360||video.height!==640||Math.abs(Number(data.format.duration)-3.5)>0.2)throw Error('Output failed validation');
 console.log(JSON.stringify({passed:true,codec:video.codec_name,width:video.width,height:video.height,duration:Number(data.format.duration),bytes:fs.statSync(output).size}));
}finally{fs.rmSync(dir,{recursive:true,force:true})}
