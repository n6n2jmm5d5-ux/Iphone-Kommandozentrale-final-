const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('server.js','utf8');
const block=source.slice(source.indexOf('const executions='),source.indexOf('async function api('));
let reply={ok:true,code:0,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'real answer'}}),stderr:''},auth={connected:true,detail:'Logged in using ChatGPT'},captured;
const context={Map,Date,JSON,Error,clean:x=>String(x),body:async req=>req.data,json:(res,status,data)=>({status,...data}),authStatus:async()=>auth,root:'project',run:async(...args)=>{captured=args;return reply}};
vm.createContext(context);vm.runInContext(block,context);
const execute=vm.runInContext('executeTask',context);
const request=(id,text='--help; echo unsafe')=>({method:'POST',headers:{'content-type':'application/json'},data:{id,text}});
(async()=>{
let r=await execute(request('success'),{});assert.equal(r.state,'done');assert.equal(r.result,'real answer');
assert.equal(captured[0],'codex');assert.deepEqual(Array.from(captured[1]),['exec','--sandbox','read-only','--ephemeral','--ignore-user-config','--json','--','--help; echo unsafe']);assert.equal(captured[3],120000);
console.log('PASS fixed CLI / arguments / prompt separated by -- / read-only / timeout');
reply={ok:false,timeout:true,stdout:'',stderr:''};r=await execute(request('timeout'),{});assert.equal(r.status,502);assert.equal(r.state,'error');assert.match(r.error,/120 Sekunden/);assert.equal(r.done,false);
reply={ok:false,code:1,stdout:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'must not succeed'}}),stderr:'real error'};r=await execute(request('nonzero'),{});assert.equal(r.state,'error');assert.equal(r.result,'');assert.equal(r.error,'real error');
reply={ok:true,code:0,stdout:'',stderr:''};r=await execute(request('empty'),{});assert.equal(r.state,'error');assert.match(r.error,/keine Antwort/);
reply={ok:true,code:0,stdout:JSON.stringify({type:'turn.failed',error:{message:'real turn error'}}),stderr:''};r=await execute(request('failedturn'),{});assert.equal(r.state,'error');assert.equal(r.error,'real turn error');
auth={connected:true,detail:'Logged in using API key'};captured=null;r=await execute(request('apikey'),{});assert.equal(r.state,'error');assert.equal(captured,null);
console.log('PASS timeout / nonzero exit / empty output / failed turn / API-key auth rejected');
})().catch(e=>{console.error(e);process.exitCode=1});
