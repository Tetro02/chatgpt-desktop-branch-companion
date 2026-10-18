const fs=require('node:fs');
const path=require('node:path');
const CDP=require('./cdp.cjs');
function option(name){return process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1);}
const root=__dirname,port=Number(option('--port')||19347),stateName=option('--state-file')||'branch-state.json';
if(!Number.isInteger(port)||port<1024||port>65535||!/^branch-state(?:-[a-z0-9]+)?\.json$/.test(stateName))throw Error('Invalid companion connection configuration');
const stateFile=path.join(root,stateName);
let c,stopping=false,last='',registration,sourceTimer,refreshing=false;
function validate(data){return data?.version===1&&Array.isArray(data.nodes)&&data.nodes.length<=500&&data.nodes.every(n=>n&&typeof n.id==='string'&&typeof n.quote==='string'&&n.quote.length<=16000&&typeof n.sourceId==='string'&&typeof n.messageId==='string'&&(!n.targetId||typeof n.targetId==='string'));}
async function main(){
 c=await CDP.connect(port);
 if(process.argv.includes('--remove')){console.log(await c.eval("typeof window.__branchCompanionControl==='function'?(window.__branchCompanionControl('stop'),true):(window.__branchCompanion?.dispose(),true)"));c.close();return;}
 let restored=[];if(fs.existsSync(stateFile)){const data=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(validate(data))restored=data.nodes;}
 await c.call('Runtime.enable');
 await c.call('Page.enable');
 await c.call('Runtime.addBinding',{name:'__branchCompanionPersist'});
 await c.call('Runtime.addBinding',{name:'__branchCompanionControl'});
 c.onEvent=(method,p)=>{if(method==='Runtime.bindingCalled'&&p.name==='__branchCompanionControl'&&p.payload==='stop'){stop();return;}if(method==='Runtime.bindingCalled'&&p.name==='__branchCompanionPersist'){if(p.payload.length>2000000)return;try{const data=JSON.parse(p.payload);if(validate(data)&&p.payload!==last){last=p.payload;restored=data.nodes;const tmp=stateFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,stateFile);}}catch(e){console.error('分支记录保存失败：'+e.message);}}};
 const sourceFile=path.join(root,'companion.js');
 let source=fs.readFileSync(sourceFile,'utf8');
 function bootstrap(code){return `if(location.origin==='app://-'){window.__branchCompanionRestore=${JSON.stringify(restored)};if(document.body){${code}}else document.addEventListener('DOMContentLoaded',()=>{${code}},{once:true});}`;}
 registration=await c.call('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap(source)});
 const restoreInitial=fs.existsSync(stateFile)?`localStorage.setItem('branch-companion.v1',${JSON.stringify(JSON.stringify(restored))});`:'';
 console.log(JSON.stringify(await c.eval(restoreInitial+source)));
 console.log('分支助手已连接。关闭本窗口或按 Ctrl+C 可移除界面，已保存的节点仍保留。');
 async function stop(){if(stopping)return;stopping=true;clearTimeout(sourceTimer);fs.unwatchFile(sourceFile);try{await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:registration.identifier});await c.eval('window.__branchCompanion?.dispose(); true');}catch{}c.close();setTimeout(()=>process.exit(),100);}
 async function updateSource(){if(stopping)return;if(refreshing){sourceTimer=setTimeout(updateSource,300);return;}refreshing=true;try{const next=fs.readFileSync(sourceFile,'utf8');if(next===source)return;new(require('node:vm').Script)(next);const added=await c.call('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap(next)});await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:registration.identifier});registration=added;await c.eval(next);source=next;console.log('分支助手界面已更新，现有草稿保持原样。');}catch(e){console.error('界面更新未完成：'+e.message);}finally{refreshing=false;}}
 fs.watchFile(sourceFile,{interval:800},()=>{clearTimeout(sourceTimer);sourceTimer=setTimeout(updateSource,200);});
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
 c.socket.onclose=()=>{if(!stopping)process.exit();};
}
main().catch(e=>{console.error(e.message);c?.close();process.exitCode=1;});
