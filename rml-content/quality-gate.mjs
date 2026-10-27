import {spawnSync} from 'node:child_process';
const files=process.argv.slice(2);
if(!files.length)process.exit(2);
let bad=false;
for(const file of files){
 const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=width,height,codec_type:format=duration','-of','json',file],{encoding:'utf8'});
 if(probe.status!==0){console.error(file,'ffprobe failed');bad=true;continue}
 const info=JSON.parse(probe.stdout),v=info.streams.find(s=>s.codec_type==='video');
 const reasons=[];
 if(!v||Math.min(v.width,v.height)<720)reasons.push('resolution');
 if(Number(info.format.duration)<6)reasons.push('duration');
 const sample=spawnSync('ffmpeg',['-v','error','-i',file,'-vf','fps=1,scale=64:64,format=gray','-t','6','-f','framemd5','-'],{encoding:'utf8',maxBuffer:1000000});
 const hashes=sample.stdout.split('\n').filter(x=>/^\d+,/.test(x.trim())).map(x=>x.split(',').at(-1).trim());
 if(sample.status!==0||new Set(hashes).size<3)reasons.push('motion');
 console.log(JSON.stringify({file,passed:!reasons.length,reasons,frames:hashes.length}));
 if(reasons.length)bad=true;
}
if(bad)process.exitCode=1;
