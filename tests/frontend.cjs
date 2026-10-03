const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const fields=()=>Object.fromEntries(['text','worker','mode'].map(name=>[name,{name,value:name==='worker'?'auto':name==='mode'?'read-only':'',focus(){document.activeElement=this}}]));
let form=null;const plain=()=>({innerHTML:'',appendChild(){},querySelector(){return null},querySelectorAll(){return []}}),nodes=new Map();
const main={html:'',get innerHTML(){return this.html},set innerHTML(html){this.html=html;form=html.includes('id="taskForm"')?{fields:fields(),querySelector(selector){return this.fields[/name="([^"]+)"/.exec(selector)?.[1]]||null}}:null}};
const document={activeElement:null,querySelector(selector){if(selector==='#main')return main;if(selector==='#taskForm')return form;if(!nodes.has(selector))nodes.set(selector,plain());return nodes.get(selector)},querySelectorAll:()=>[],createElement:plain};
let rows=[{id:'saved',text:'Saved task',worker:'chatgpt',mode:'read-only',state:'done',done:true,result:'<script>unsafe()</script>',error:'',createdAt:'2026-01-01T00:00:00Z',history:[{state:'wait'},{state:'work'},{state:'done'}]}];
const writes=[],stored=new Map([['kz-tasks','obsolete fake task data']]);
const ctx={document,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>{writes.push(k);stored.set(k,v)},removeItem:k=>stored.delete(k)},crypto:webcrypto,navigator:{},setTimeout,clearTimeout,setInterval:()=>{},window:{addEventListener(){}},FormData:class{constructor(f){this.f=f}get(name){return this.f.fields[name]?.value}},fetch:async url=>new Response(JSON.stringify(url==='/api/tasks'?{ok:true,tasks:rows}:url==='/api/registry'?{agents:[{id:'chatgpt',available:true},{id:'claude',available:false}],skills:[]}:{ok:true}),{status:200,headers:{'content-type':'application/json'}})};
vm.createContext(ctx);for(const f of ['registry.js','app.js','agent-layer.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
(async()=>{
 await vm.runInContext('refreshBackend()',ctx);assert.equal(stored.has('kz-tasks'),false);assert.ok(!writes.includes('kz-tasks'));
 vm.runInContext("active='auftrag';render()",ctx);form.fields.text.value='Draft survives a task update';form.fields.worker.value='chatgpt';form.fields.mode.value='workspace-write';document.activeElement=form.fields.text;
 vm.runInContext('render()',ctx);assert.equal(form.fields.text.value,'Draft survives a task update');assert.equal(form.fields.mode.value,'workspace-write');assert.equal(document.activeElement,form.fields.text);
 vm.runInContext("applyTask({id:'saved',state:'work',result:'',history:[{state:'wait'},{state:'work'}]})",ctx);assert.equal(vm.runInContext("tasks.find(t=>t.id==='saved').state",ctx),'done');
 vm.runInContext("focusTask='saved';active='vorschau';render()",ctx);assert.ok(main.innerHTML.includes('&lt;script&gt;unsafe()&lt;/script&gt;'));assert.ok(!main.innerHTML.includes('<script>unsafe()'));
 vm.runInContext("active='ablage';render()",ctx);assert.ok(main.innerHTML.includes('&lt;script&gt;unsafe()&lt;/script&gt;'));
 console.log('PASS frontend single data source / draft preservation / stale-status rejection / HTML escaping in preview and archive');
})().catch(e=>{console.error(e.message);process.exitCode=1});
