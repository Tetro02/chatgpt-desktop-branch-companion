'use strict';
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const CDP=require('./cdp.cjs');const {BookmarkStore}=require('./bookmark-store.cjs');
(async()=>{
  for(const module of require('./assistant.config.cjs').modules)new vm.Script(fs.readFileSync(path.join(__dirname,module.file),'utf8'));
  const c=await CDP.connect();
  try{
    const live=await c.eval(`({nodes:window.__branchCompanion?.nodes||null,bookmarks:window.__bookmarkCompanion?.bookmarks||null})`);
    if(live.nodes){const file=path.join(__dirname,'branch-state.json');if(fs.existsSync(file))fs.copyFileSync(file,file+'.bak');fs.writeFileSync(file+'.tmp',JSON.stringify({version:1,nodes:live.nodes},null,2));fs.renameSync(file+'.tmp',file);}
    if(live.bookmarks)new BookmarkStore(path.join(__dirname,'bookmark-state.json')).save({version:1,bookmarks:live.bookmarks});
    await c.eval(`typeof window.__branchCompanionControl==='function'?window.__branchCompanionControl('stop'):(window.__gptAssistant?.dispose(),window.__bookmarkCompanion?.dispose(),window.__branchCompanion?.dispose());true`);
    await new Promise(r=>setTimeout(r,900));
    console.log(JSON.stringify({savedBranches:live.nodes?.length??null,savedBookmarks:live.bookmarks?.length??null,clientKeptRunning:true}));
  }finally{c.close();}
})().catch(e=>{console.error('接管未完成，尚未连接新版助手：'+e.message);process.exitCode=1;});
