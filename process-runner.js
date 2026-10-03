// The parent selects the executable and fixed arguments. No shell is involved.
// An IPC disconnect also stops Codex when the server is killed unexpectedly.
import {spawn} from 'node:child_process';
import path from 'node:path';
const [file,encoded]=process.argv.slice(2);
const args=JSON.parse(encoded);
if(!path.isAbsolute(file)||!Array.isArray(args)||args.some(a=>typeof a!=='string'))process.exit(1);
const child=spawn(file,args,{cwd:process.cwd(),env:process.env,shell:false,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
let stopping=false;
function stop(){
  if(stopping)return;stopping=true;
  if(process.platform==='win32'&&child.pid){
    const killer=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{shell:false,stdio:'ignore'});
    killer.on('error',()=>child.kill());
  }else if(child.pid){try{process.kill(-child.pid,'SIGKILL')}catch{child.kill()}}
}
process.on('disconnect',stop);process.on('message',message=>{if(message?.type==='stop')stop()});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
child.on('error',e=>{console.error(e.message);process.exit(1)});
child.on('close',code=>process.exit(code??1));
