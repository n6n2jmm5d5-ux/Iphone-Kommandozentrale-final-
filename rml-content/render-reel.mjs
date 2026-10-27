#!/usr/bin/env node
// Offline reel renderer. No API, no purchases, no automatic publishing.
// Usage: node render-reel.mjs approved-post.json output.mp4 [original-logo.png]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const [source,target,logo]=process.argv.slice(2);
if(!source||!target){console.error('Usage: node render-reel.mjs approved-post.json output.mp4 [logo.png]');process.exit(2)}
const post=JSON.parse(fs.readFileSync(source,'utf8'));
if(post.status!=='Freigegeben')throw Error('Only approved posts can be rendered');
const title=String(post.hook||post.title||'').trim();
if(!title||title.length>220)throw Error('Reel hook must contain 1–220 characters');
if(!/\.mp4$/i.test(target))throw Error('Output must be MP4');
if(logo&&!fs.existsSync(logo))throw Error('Original logo file not found');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rml-reel-'));
try{
  // drawtext receives text via UTF-8 file, not as command-line filter syntax.
  const wrap=(s,max=27)=>{const words=s.split(/\\s+/),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines.join('\\n')};
  const titlePath=path.join(tmp,'hook.txt');fs.writeFileSync(titlePath,wrap(title));
  const footerPath=path.join(tmp,'footer.txt');fs.writeFileSync(footerPath,'RESTAURANTS MIT LEIDENSCHAFT');
  const font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const text=(file,size,y,color)=>`drawtext=fontfile=${font}:textfile=${file}:fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:fix_bounds=1`;
  const vf=['drawbox=x=90:y=410:w=900:h=4:color=0xc6a366:t=fill',text(footerPath,37,330,'0xc6a366'),text(titlePath,56,780,'white'),'drawbox=x=90:y=1480:w=900:h=3:color=0xc6a366:t=fill'].join(',');
  const args=['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x101014:s=1080x1920:r=25:d=15'];
  if(logo)args.push('-loop','1','-i',logo);
  const filter=logo?`[0:v]${vf}[bg];[1:v]scale=220:-1[mark];[bg][mark]overlay=(W-w)/2:110,format=yuv420p[out]`:`[0:v]${vf},format=yuv420p[out]`;
  args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100','-filter_complex',filter,'-map','[out]','-map',logo?'2:a:0':'1:a:0','-c:v','libx264','-profile:v','main','-level:v','4.2','-pix_fmt','yuv420p','-preset','veryfast','-crf','23','-r','25','-c:a','aac','-b:a','96k','-ar','44100','-t','15','-shortest','-movflags','+faststart',target);
  const run=spawnSync('ffmpeg',args,{encoding:'utf8',maxBuffer:1024*1024*2});
  if(run.error||run.status!==0)throw Error(run.stderr||String(run.error));
  console.log(target);
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
