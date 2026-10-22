'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const CDP=require('./cdp.cjs');
const {BookmarkStore,startBridge}=require('./bookmark-store.cjs');
function option(name){return process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1);}
const root=__dirname,port=Number(option('--port')||19347),linkPort=Number(option('--link-port')||19348),stateName=option('--state-file')||'branch-state.json';
if(![port,linkPort].every(p=>Number.isInteger(p)&&p>=1024&&p<=65535)||port===linkPort||!/^branch-state(?:-[a-z0-9]+)?\.json$/.test(stateName))throw Error('Invalid companion connection configuration');
const stateFile=path.join(root,stateName),bookmarkFile=path.join(root,'bookmark-state'+stateName.slice('branch-state'.length));
let c,stopping=false,last='',registration,sourceTimer,refreshing=false,bridge;
const sourceFiles=['companion.js','bookmarks.js'].map(f=>path.join(root,f));
function validate(data){return data?.version===1&&Array.isArray(data.nodes)&&data.nodes.length<=500&&data.nodes.every(n=>n&&typeof n.id==='string'&&typeof n.quote==='string'&&n.quote.length<=16000&&typeof n.sourceId==='string'&&typeof n.messageId==='string'&&(!n.targetId||typeof n.targetId==='string'));}
function readSource(){return sourceFiles.map(f=>{const text=fs.readFileSync(f,'utf8');new vm.Script(text);return text+';';}).join('\n');}
async function main(){
  c=await CDP.connect(port);
  if(process.argv.includes('--remove')){console.log(await c.eval("typeof window.__branchCompanionControl==='function'?(window.__branchCompanionControl('stop'),true):(window.__bookmarkCompanion?.dispose(),window.__branchCompanion?.dispose(),true)"));c.close();return;}
  let restored=[];if(fs.existsSync(stateFile)){const data=JSON.parse(fs.readFileSync(stateFile,'utf8'));if(!validate(data))throw Error('分支记录格式无效，已停止加载。');restored=data.nodes;}
  const store=new BookmarkStore(bookmarkFile);
  await c.call('Runtime.enable');await c.call('Page.enable');
  for(const name of ['__branchCompanionPersist','__branchCompanionControl','__bookmarkCompanionPersist'])await c.call('Runtime.addBinding',{name});
  c.onEvent=(method,p)=>{
    if(method!=='Runtime.bindingCalled')return;
    if(p.name==='__branchCompanionControl'&&p.payload==='stop'){stop();return;}
    if(p.name==='__bookmarkCompanionPersist'){
      if(p.payload.length>4000000)return;
      try{store.save(JSON.parse(p.payload));}catch(e){console.error('书签记录保存失败：'+e.message);c.eval("window.__bookmarkCompanion?.storageError?.()").catch(()=>{});}return;
    }
    if(p.name==='__branchCompanionPersist'){
      if(p.payload.length>2000000)return;
      try{const data=JSON.parse(p.payload);if(validate(data)&&p.payload!==last){const tmp=stateFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,stateFile);last=p.payload;restored=data.nodes;}}catch(e){console.error('分支记录保存失败：'+e.message);}
    }
  };
  bridge=await startBridge({store,port:linkPort,jump:async id=>{
    if(stopping)throw Error('助手已停止。');
    await c.call('Page.bringToFront');
    const result=await c.eval(`window.__bookmarkCompanion?window.__bookmarkCompanion.jump(${JSON.stringify(id)}):Promise.reject(Error('书签界面尚未准备好'))`);
    if(!result?.quoteMatched)throw Error('书签定位未确认。');return result;
  }});
  let source=readSource();
  function bootstrap(code){return `if(location.origin==='app://-'&&location.pathname==='/index.html'){window.__branchCompanionRestore=${JSON.stringify(restored)};window.__bookmarkCompanionRestore=${JSON.stringify(store.state)};window.__bookmarkCompanionLinkBase=${JSON.stringify(bridge.origin)};if(document.body){${code}}else document.addEventListener('DOMContentLoaded',()=>{${code}},{once:true});}`;}
  registration=await c.call('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap(source)});
  const restoreInitial=(fs.existsSync(stateFile)?`localStorage.setItem('branch-companion.v1',${JSON.stringify(JSON.stringify(restored))});`:'')+(fs.existsSync(bookmarkFile)?`localStorage.setItem('branch-companion.bookmarks.v1',${JSON.stringify(JSON.stringify(store.state.bookmarks))});`:'');
  await c.eval(restoreInitial+bootstrap(source));
  console.log('分支与书签助手已连接。书签链接服务：'+bridge.origin+'。关闭本窗口或按 Ctrl+C 可移除界面。');
  async function stop(){if(stopping)return;stopping=true;clearTimeout(sourceTimer);for(const file of sourceFiles)fs.unwatchFile(file);try{await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:registration.identifier});await c.eval('window.__bookmarkCompanion?.dispose();window.__branchCompanion?.dispose();true');}catch{}bridge?.server.close();c.close();setTimeout(()=>process.exit(),100);}
  async function updateSource(){if(stopping)return;if(refreshing){sourceTimer=setTimeout(updateSource,300);return;}refreshing=true;try{const next=readSource();if(next===source)return;const added=await c.call('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap(next)});await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:registration.identifier});registration=added;await c.eval(bootstrap(next));source=next;console.log('分支与书签界面已更新，现有草稿保持原样。');}catch(e){console.error('界面更新未完成：'+e.message);}finally{refreshing=false;}}
  for(const file of sourceFiles)fs.watchFile(file,{interval:800},()=>{clearTimeout(sourceTimer);sourceTimer=setTimeout(updateSource,200);});
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  c.socket.onclose=()=>{if(!stopping){bridge?.server.close();process.exit();}};
}
main().catch(e=>{console.error(e.message);bridge?.server.close();c?.close();process.exitCode=1;});
