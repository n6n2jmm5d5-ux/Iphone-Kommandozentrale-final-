const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {spawn}=require('node:child_process');
const {webcrypto}=require('node:crypto');
const port=3099,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.js'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prompt='Do not use tools, read files or change files. Reply with exactly KOMMANDOZENTRALE_INTEGRATION_OK and nothing else.';
const marker='KOMMANDOZENTRALE_INTEGRATION_OK';
async function post(data,headers={}){return fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)})}
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break}catch{}await sleep(100);if(i===99)throw Error('Server did not start')}
 for(const file of ['.git/config','server.js','package.json','tests/integration.cjs','%2e%2e%5cserver.js'])assert.equal((await fetch(base+'/'+file)).status,404);
 assert.equal((await post({id:'invalid',text:''})).status,400);
 assert.equal((await post({id:'invalid',text:prompt},{origin:'http://evil.example'})).status,403);
 const wrongHost=await new Promise((resolve,reject)=>{require('node:http').get({hostname:'127.0.0.1',port,path:'/api/health',headers:{host:'evil.example:3099'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});assert.equal(wrongHost,403);
 assert.equal((await fetch(base+'/api/tasks')).status,405);
 assert.equal((await post({id:'oversize',text:'x'.repeat(13000)})).status,400);
 const malformed=await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:'{'});assert.equal(malformed.status,400);
 console.log('PASS validation / same-origin / host / private files');
 const original=new Map(['server.js','app.js','agent-layer.js','index.html','sw.js'].map(f=>[f,fs.readFileSync(f)]));
 const pending=post({id:'backend-integration',text:prompt});
 for(let i=0;i<50;i++){const r=await fetch(base+'/api/tasks/backend-integration');if(r.status===200)break;await sleep(20)}
 assert.equal((await post({id:'backend-integration',text:prompt})).status,409);
 const response=await pending;const result=await response.json();
 assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.result,marker);assert.equal(result.state,'done');assert.equal(result.done,true);
 const repeat=await (await post({id:'backend-integration',text:prompt})).json();assert.equal(repeat.result,marker);
 assert.equal((await post({id:'backend-integration',text:'different prompt'})).status,409);
 console.log('PASS real backend marker / duplicate prevention / completed result reuse');
 const nodes=new Map();function node(){return {innerHTML:'',value:'',appendChild(){},querySelector(){return null},querySelectorAll(){return []}}}
 const document={querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},querySelectorAll:()=>[],createElement:node};
 const stored=new Map();let posted=0;
 const context={document,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},crypto:webcrypto,navigator:{},AbortController,setTimeout,clearTimeout,setInterval:()=>{},window:{addEventListener(){}},FormData:class {constructor(f){this.f=f}get(k){return this.f[k]}},fetch:(url,options)=>{if(url==='/api/tasks'&&options?.method==='POST')posted++;return fetch(base+url,options)}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);vm.runInContext(fs.readFileSync('agent-layer.js','utf8'),context);
 await vm.runInContext('refreshBackend()',context);
 vm.runInContext("active='auftrag';render()",context);
 const form=nodes.get('#taskForm');form.text=prompt;form.worker='chatgpt';form.onsubmit({preventDefault(){}});
 assert.equal(vm.runInContext('tasks[0].state',context),'work');assert.match(nodes.get('#main').innerHTML,/arbeitet/);
 form.onsubmit({preventDefault(){}});assert.equal(posted,1);
 for(let i=0;i<1500;i++){if(vm.runInContext('tasks[0].state',context)!=='work')break;await sleep(100)}
 const task=vm.runInContext('tasks[0]',context);assert.equal(task.state,'done',task.error);assert.equal(task.result,marker);assert.equal(task.done,true);
 assert.equal(JSON.parse(stored.get('kz-tasks'))[0].result,marker);
 vm.runInContext("focusTask=tasks[0].id;active='vorschau';render()",context);assert.match(nodes.get('#main').innerHTML,new RegExp(marker));
 vm.runInContext("active='ablage';render()",context);assert.match(nodes.get('#main').innerHTML,new RegExp(marker));
 assert.equal(vm.runInContext("sessions.find(s=>s.type==='chatgpt').state",context),'idle');
 console.log('PASS real frontend form -> HTTP -> Codex -> persisted done/result -> preview/archive');
 context.fetch=async()=>new Response(JSON.stringify({ok:false,state:'error',error:'Real backend failure fixture'}),{status:502,headers:{'content-type':'application/json'}});
 vm.runInContext("dispatchTask('Failure test','chatgpt')",context);await sleep(10);
 assert.equal(vm.runInContext('tasks[0].state',context),'error');assert.equal(vm.runInContext('tasks[0].done',context),false);assert.equal(vm.runInContext('tasks[0].result',context),undefined);
 vm.runInContext("dispatchTask('Claude unavailable','claude')",context);assert.equal(vm.runInContext('tasks[0].state',context),'error');
 console.log('PASS frontend failure handling (fixture) / Claude unavailable');
 for(const [f,b] of original)assert.ok(fs.readFileSync(f).equals(b),f+' changed during Codex test');
 console.log('PASS project files unchanged by test orders');
})().catch(e=>{console.error('FAIL '+e.message);process.exitCode=1}).finally(()=>{server.kill();server.stdout.destroy();server.stderr.destroy()});
