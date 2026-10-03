const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),{spawn}=require('node:child_process'),{randomUUID,webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),area=path.join(root,'.kz-test-real-'+randomUUID()),relative=path.relative(root,area),port=3099,base=`http://127.0.0.1:${port}`;
const outside=path.join(require('node:os').tmpdir(),'kz-outside-'+randomUUID()+'.txt');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let server;
async function start(extra={}){
 server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),KZ_DATA_DIR:relative+'/store',...extra},stdio:['ignore','pipe','pipe']});let startup='';server.stderr.on('data',d=>startup+=d);server.stdout.resume();
 for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)return}catch{}if(server.exitCode!==null)throw Error('Server startup failed: '+startup.slice(-1000));await sleep(100)}throw Error('Server did not start');
}
async function stop(){if(!server)return;const p=server;server=null;await new Promise(resolve=>{p.once('exit',resolve);p.kill()});await sleep(500)}
async function req(url,body){return fetch(base+url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})}
async function create(data){const r=await req('/api/tasks',data);const j=await r.json();assert.ok(r.ok,j.error||String(r.status));return j}
async function completed(id){for(let n=0;n<1500;n++){const j=await (await req('/api/tasks/'+id)).json();if(['done','error'].includes(j.state))return j;await sleep(100)}throw Error('Task timeout '+id)}
function frontend(){const nodes=new Map(),values=new Map();const make=()=>({innerHTML:'',value:'',appendChild(){},querySelector(){return null},querySelectorAll(){return []}});
 const document={querySelector:s=>{if(!nodes.has(s))nodes.set(s,make());return nodes.get(s)},querySelectorAll:()=>[],createElement:make};let posted=0;
 const ctx={document,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},crypto:webcrypto,navigator:{},setTimeout,clearTimeout,setInterval:()=>{},window:{addEventListener(){}},FormData:class{constructor(f){this.f=f}get(k){return this.f[k]}},fetch:(url,options)=>{if(url==='/api/tasks'&&options?.method==='POST')posted++;return fetch(base+url,options)}};
 vm.createContext(ctx);for(const f of ['registry.js','app.js','agent-layer.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 return {ctx,nodes,values,posted:()=>posted};
}
(async()=>{
 const original=new Map(['server.js','app.js','agent-layer.js','index.html','sw.js','registry.js','task-service.js','task-store.js','process-runner.js','package.json'].map(f=>[f,fs.readFileSync(path.join(root,f))]));
 fs.mkdirSync(area);await start();
 for(const file of ['.git/config','server.js','task-store.js',relative+'/store/tasks.json','%2e%2e%5cserver.js'])assert.equal((await req('/'+file)).status,404);
 for(const id of ['../bad','x/y','bad_id','x'.repeat(81)])assert.equal((await req('/api/tasks',{id,text:'x'})).status,400);
 assert.equal((await req('/api/tasks/bad_id')).status,400);
 const malformed=await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:'{'});assert.equal(malformed.status,400);
 assert.equal((await req('/api/tasks',{id:'unsafe-mode',text:'x',mode:'danger-full-access'})).status,400);
 assert.equal((await req('/api/tasks',{id:'large',text:'x'.repeat(12001)})).status,400);
 assert.equal((await req('/api/tasks',{id:'body-limit',text:'x'.repeat(70000)})).status,413);
 const evil=await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json',origin:'http://evil.example'},body:JSON.stringify({id:'evil',text:'x'})});assert.equal(evil.status,403);
 console.log('PASS traversal / invalid IDs / oversized bodies / origin / private store');
 const ui=frontend();await vm.runInContext('refreshBackend()',ui.ctx);vm.runInContext("active='auftrag';render()",ui.ctx);
 const form=ui.nodes.get('#taskForm');form.text='Do not use tools or modify files. Reply exactly KZ_READ_OK.';form.worker='chatgpt';form.mode='read-only';form.onsubmit({preventDefault(){}});form.onsubmit({preventDefault(){}});assert.equal(ui.posted(),1);
 const readId=vm.runInContext('tasks[0].id',ui.ctx);let j=await completed(readId);assert.equal(j.state,'done',j.error);assert.equal(j.result,'KZ_READ_OK');assert.deepEqual(j.history.map(x=>x.state),['wait','work','done']);await vm.runInContext('refreshTasks()',ui.ctx);assert.equal(ui.values.has('kz-tasks'),false);
 console.log('PASS A real read-only / frontend form / queue lifecycle / single backend source');
 const writeFile=path.join(area,'written.txt'),writePrompt=`Use apply_patch to create only the project file ${relative.replaceAll('\\','/')}/written.txt with exactly KZ_WRITE_OK followed by one newline. Do not modify any other file. Reply exactly KZ_WRITE_OK.`;
 j=await create({id:'write',text:writePrompt,mode:'workspace-write'});assert.equal(j.state,'wartet_auf_freigabe');await sleep(1000);assert.equal(fs.existsSync(writeFile),false);assert.equal((await (await req('/api/tasks/write')).json()).startedAt,null);
 await stop();await start();assert.equal((await (await req('/api/tasks/write')).json()).state,'wartet_auf_freigabe');assert.equal(fs.existsSync(writeFile),false);
 assert.equal((await req('/api/tasks/write/approve',{approved:false})).status,400);
 await req('/api/tasks/write/approve',{approved:true});await req('/api/tasks/write/approve',{approved:true});j=await completed('write');assert.equal(j.state,'done',j.error);assert.equal(fs.existsSync(writeFile),true,'Codex reported success without creating test file');assert.equal(fs.readFileSync(writeFile,'utf8'),'KZ_WRITE_OK\n');assert.equal(j.history.filter(h=>h.state==='work').length,1);assert.ok(j.execution.toolCalls>0);
 const mtime=fs.statSync(writeFile).mtimeMs;await create({id:'write',text:writePrompt,mode:'workspace-write'});await sleep(500);assert.equal(fs.statSync(writeFile).mtimeMs,mtime);fs.unlinkSync(writeFile);
 console.log('PASS B/D real project write / file content / cleanup / mandatory approval / exactly once');
 // Verify the OS sandbox directly, not merely the model's refusal to attempt a forbidden action.
 const {codexArguments}=await import('../task-service.js');const policies=codexArguments('workspace-write',root,'',path.join(area,'store'));const config=[];
 for(let i=0;i<policies.length;i++)if(policies[i]==='-c')config.push(policies[i],policies[++i]);
 const codex=process.env.PATH.split(path.delimiter).map(d=>path.join(d.replace(/^"|"$/g,''),'codex.exe')).find(f=>fs.existsSync(f));
 async function sandboxWrite(file){return new Promise(resolve=>{const child=spawn(codex,['sandbox','--permission-profile','kz_project','--cd',root,...config,'--',process.execPath,'-e','require("node:fs").writeFileSync('+JSON.stringify(file)+',"KZ_SANDBOX_PROBE")'],{cwd:root,env:{...process.env,CODEX_HOME:process.env.CODEX_HOME||path.join(require('node:os').homedir(),'.codex'),OPENAI_API_KEY:'',ANTHROPIC_API_KEY:''},shell:false,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const timer=setTimeout(()=>child.kill(),15000);child.on('error',()=>resolve({code:1,output:'Failed to launch sandbox'}));child.on('close',code=>{clearTimeout(timer);resolve({code,output})})})}
 const control=path.join(area,'sandbox-control.txt');const insideResult=await sandboxWrite(control);assert.equal(insideResult.code,0,'Native sandbox control write failed: '+insideResult.output.slice(-600));assert.equal(fs.readFileSync(control,'utf8'),'KZ_SANDBOX_PROBE');fs.unlinkSync(control);
 const storeProbe=path.join(area,'store','sandbox-probe.txt');const protectedResult=await sandboxWrite(storeProbe);assert.notEqual(protectedResult.code,0);assert.equal(fs.existsSync(storeProbe),false);
 const outsideResult=await sandboxWrite(outside);assert.notEqual(outsideResult.code,0,'Outside sandbox write exited successfully');assert.equal(fs.existsSync(outside),false,'Outside write succeeded: sandbox unsafe');assert.match(outsideResult.output,/EACCES|EPERM|access.*denied|permission denied|zugriff.*verweigert/i);
 console.log('PASS native Codex sandbox: inside control succeeds / actual outside write rejected');
 await stop();await start();j=await (await req('/api/tasks/'+readId)).json();assert.equal(j.result,'KZ_READ_OK');assert.equal((await (await req('/api/tasks/write')).json()).state,'done');
 const restored=frontend();await vm.runInContext('refreshBackend()',restored.ctx);vm.runInContext(`focusTask=${JSON.stringify(readId)};active='vorschau';render()`,restored.ctx);assert.match(restored.nodes.get('#main').innerHTML,/KZ_READ_OK/);vm.runInContext("active='ablage';render()",restored.ctx);assert.match(restored.nodes.get('#main').innerHTML,/KZ_READ_OK/);
 console.log('PASS C persistent completion / preview and archive after restart');
 await create({id:'interrupted',text:'Read-only test: spend a long time thinking, then generate an extensive ten thousand word analysis of queue durability. Do not use tools or modify files.'});
 for(let i=0;i<100;i++){j=await (await req('/api/tasks/interrupted')).json();if(j.state==='work')break;await sleep(50)}assert.equal(j.state,'work');await stop();await start();j=await (await req('/api/tasks/interrupted')).json();assert.equal(j.state,'error');assert.equal(j.done,false);assert.equal(j.result,'');
 console.log('PASS actual server termination during work / no false success after restart');
 await stop();await start({KZ_EXECUTION_TIMEOUT_MS:'1000'});await create({id:'intentional-failure',text:'Do not use tools. Produce a detailed fifty thousand word technical analysis before concluding. This test intentionally times out.'});j=await completed('intentional-failure');assert.equal(j.state,'error');assert.ok(j.execution.timedOut);assert.equal(j.done,false);assert.equal(j.result,'');await stop();await start();assert.equal((await (await req('/api/tasks/intentional-failure')).json()).state,'error');
 for(const [file,content] of original)assert.ok(fs.readFileSync(path.join(root,file)).equals(content),'Unexpected project modification: '+file);
 console.log('PASS E real Codex process timeout / persistent failure / project sources unchanged');
})().catch(e=>{console.error('FAIL '+e.message);process.exitCode=1}).finally(async()=>{await stop();if(fs.existsSync(outside))fs.unlinkSync(outside);if(path.dirname(area)===root&&path.basename(area).startsWith('.kz-test-real-'))fs.rmSync(area,{recursive:true,force:true})});
