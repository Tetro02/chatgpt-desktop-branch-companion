'use strict';
const fs=require('node:fs');
const http=require('node:http');
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validState(value){
  if(value?.version!==1||!Array.isArray(value.bookmarks)||value.bookmarks.length>2000)return false;
  const ids=new Set();
  return value.bookmarks.every(b=>{
    if(!b||!UUID.test(b.id)||ids.has(b.id))return false;ids.add(b.id);
    return ['sourceId','messageId','quote','label','sourceTitle','prefix','suffix','createdAt'].every(k=>typeof b[k]==='string')
      &&b.sourceId.length>0&&b.sourceId.length<=200&&b.messageId.length>0&&b.messageId.length<=300
      &&b.quote.length>0&&b.quote.length<=16000&&b.label.length<=160&&b.sourceTitle.length<=500
      &&b.prefix.length<=100&&b.suffix.length<=100&&b.createdAt.length<=50
      &&Number.isSafeInteger(b.start)&&b.start>=0&&['local','chatgpt'].includes(b.kind)
      &&(b.previewHTML===undefined||(typeof b.previewHTML==='string'&&b.previewHTML.length<=200000));
  });
}
class BookmarkStore{
  constructor(file){this.file=file;this.state={version:1,bookmarks:[]};this.last='';if(fs.existsSync(file)){const value=JSON.parse(fs.readFileSync(file,'utf8'));if(!validState(value))throw Error('书签记录格式无效，已停止加载以保留原文件。');this.state=value;}}
  save(value){if(!validState(value))throw Error('书签记录格式无效。');const data=JSON.stringify(value,null,2);if(data===this.last)return;if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.bak');fs.writeFileSync(this.file+'.tmp',data,'utf8');fs.renameSync(this.file+'.tmp',this.file);this.state=JSON.parse(JSON.stringify(value));this.last=data;}
  find(id){return this.state.bookmarks.find(b=>b.id===id);}
}
function startBridge({store,jump,port=19348}){
  const origin='http://127.0.0.1:'+port;
  // Link IDs are opaque capabilities; the HTTP service never lists or returns saved text.
  const server=http.createServer(async(req,res)=>{
    const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
    function reply(code,body,type){res.writeHead(code,{...headers,...(type?{'Content-Type':type}:{})});res.end(body);}
    if(req.headers.host!=='127.0.0.1:'+port)return reply(403,'仅允许本机访问。');
    const url=new URL(req.url,origin),match=url.pathname.match(/^\/b\/([0-9a-f-]{36})$/i);
    if(!match||!UUID.test(match[1])||url.search)return reply(404,'书签不存在。');
    const bookmark=store.find(match[1]);if(!bookmark)return reply(404,'此书签已被移除，或不属于当前助手。');
    if(req.method==='POST'){
      if(req.headers.origin!==origin||req.headers['x-bookmark-jump']!=='1')return reply(403,'请通过书签链接打开。');
      if(req.headers['content-length']&&req.headers['content-length']!=='0')return reply(400,'不接受请求内容。');
      try{await jump(bookmark.id);reply(200,JSON.stringify({ok:true}),'application/json');}catch{reply(409,JSON.stringify({ok:false,error:'定位未完成。请查看桌面端提示，确认目标聊天和消息仍可访问。'}),'application/json');}
      return;
    }
    if(req.method!=='GET')return reply(405,'仅支持打开书签。');
    if(req.headers['sec-fetch-dest']&&req.headers['sec-fetch-dest']!=='document')return reply(403,'请直接打开书签链接。');
    const nonce=crypto.randomBytes(18).toString('base64');
    headers['Content-Security-Policy']=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
    reply(200,`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>跳转到聊天书签</title><style nonce="${nonce}">body{font:16px/1.7 system-ui;margin:12vh auto;padding:24px;max-width:580px;color:#333;background:#f7f7f5}button{font:inherit;padding:7px 18px;cursor:pointer}small{color:#777}</style><h1>聊天书签</h1><p id="status" role="status">正在定位桌面端中的原文…</p><button id="retry" hidden>重试</button><p><small>助手需要保持运行。定位完成后可关闭此页面。</small></p><script nonce="${nonce}">const s=document.getElementById('status'),b=document.getElementById('retry');async function go(){b.hidden=true;s.textContent='正在定位桌面端中的原文…';try{const r=await fetch(location.pathname,{method:'POST',headers:{'X-Bookmark-Jump':'1'}}),d=await r.json();if(!d.ok)throw Error(d.error);s.textContent='已跳转到指定原文。请切回 ChatGPT 桌面端。';}catch(e){s.textContent=e.message||'连接失败，请确认助手仍在运行。';b.hidden=false;}}b.onclick=go;go();</script></html>`);
  });
  return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve({server,origin,close:()=>new Promise(r=>server.close(r))});});});
}
module.exports={validState,BookmarkStore,startBridge};
