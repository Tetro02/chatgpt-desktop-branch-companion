(() => {
  'use strict';
  window.__branchCompanion?.dispose();
  const newPage=!window.__branchCompanionSession;
  window.__branchCompanionSession=true;
  const KEY = 'branch-companion.v1';
  const SELECTOR = '[data-chatgpt-selection-message-id],[data-local-conversation-final-assistant],[data-response-annotation-conversation][data-response-annotation-target]';
  const HOST_ID = 'branch-companion-host';
  const removers = [], markers = new Map();
  let disposed=false, candidate=null, busy=false, selecting=false, refreshTimer, scheduled=false, navigateCache=null, lastDeletion=null;
  let collapsed=new Set(), focusedKey=null, appearanceSignature='';
  const wasOpen=window.__branchCompanionPanelOpen===true;
  try {collapsed=new Set(JSON.parse(localStorage.getItem(KEY+'.collapsed')||'[]'));}catch{}
  let nodes=[],hasStoredNodes=false;
  try {const raw=localStorage.getItem(KEY),saved=JSON.parse(raw||'[]');if(raw!==null&&Array.isArray(saved)){hasStoredNodes=true;nodes=saved.filter(n=>n&&typeof n.id==='string'&&typeof n.quote==='string'&&typeof n.sourceId==='string'&&typeof n.messageId==='string');}}catch{}
  if(!hasStoredNodes && Array.isArray(window.__branchCompanionRestore))nodes=window.__branchCompanionRestore;
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function cleanId(id){if(typeof id!=='string')return null;let value=id.trim();while(/^(?:local|chatgpt|local-chatgpt):/i.test(value))value=value.replace(/^(?:local|chatgpt|local-chatgpt):/i,'');const uuid=value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);return uuid?.[0]||value||null;}
  for(const n of nodes){n.sourceId=cleanId(n.sourceId)||n.sourceId;if(n.targetId)n.targetId=cleanId(n.targetId)||n.targetId;}
  const host=document.createElement('div');host.id=HOST_ID;document.body.append(host);
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>
    :host{all:initial;--bg:#fff;--fg:#202123;--muted:#737373;--line:#dedede;--accent:#316bc4;--hover:#0000000d;--pressed:#00000018;--selected:#e8eef8;font-family:var(--native-font,system-ui,sans-serif);font-size:var(--native-size,13px);line-height:1.45;font-weight:400;letter-spacing:normal;color:var(--fg)}
    @media(prefers-color-scheme:dark){:host{--bg:#252525;--fg:#e5e5e5;--muted:#a1a1a1;--line:#424242;--accent:#a2c0ff;--hover:#ffffff0e;--pressed:#ffffff1a;--selected:#ffffff13}}
    *{box-sizing:border-box}button{font:inherit;letter-spacing:inherit;cursor:pointer;color:inherit;transition:background-color 90ms ease,color 90ms ease}button:focus-visible,.tree-row:focus-visible{outline:1px solid var(--accent);outline-offset:-1px}button:disabled{cursor:default;color:var(--muted)}button:not(:disabled):hover{background-color:var(--hover)}button:not(:disabled):active{background-color:var(--pressed)}[hidden]{display:none!important}svg{width:16px;height:16px;display:block;flex:none;pointer-events:none}
    .toggle,.panel,.floating,.marker,.notice{position:fixed;z-index:2147483600;background:var(--bg);color:var(--fg);border:1px solid var(--line);box-shadow:0 6px 24px #0002}
    .toggle{right:14px;top:100px;border-radius:8px;padding:8px 12px}.toggle[hidden]{display:none}
    .panel{right:14px;top:100px;width:320px;max-width:calc(100vw - 28px);max-height:calc(100vh - 120px);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}
    header{display:flex;align-items:center;justify-content:space-between;padding:9px 10px 9px 13px;border-bottom:1px solid var(--line);gap:8px}h2{font:inherit;font-weight:600;margin:0;white-space:nowrap}.heading-count{font-size:11px;font-weight:400;color:var(--muted);margin-left:7px}.toolbar,.actions{display:flex;align-items:center;flex:none;gap:2px}.plain,.icon-button{border:0;background:transparent;padding:4px;color:var(--muted);border-radius:4px}.icon-button{display:flex;align-items:center;justify-content:center;width:24px;height:24px}
    .list{padding:6px 6px 12px;overflow:auto;min-height:64px;scrollbar-width:thin}.empty{line-height:1.7;color:var(--muted);margin:8px}.tree-row{height:29px;display:flex;align-items:center;gap:3px;padding:0 3px;border-radius:3px;position:relative;cursor:pointer;outline:none;user-select:none}.tree-row:hover{background:var(--hover)}.tree-row[data-active="true"]{background:var(--selected)}.tree-row:focus-within{background:var(--selected)}.tree-row:active{background:var(--pressed)}.tree-row .chevron{width:18px;height:22px;padding:2px;flex:none}.chevron svg{width:14px;height:14px;transition:transform 90ms ease}.tree-row[aria-expanded="true"]>.chevron svg{transform:rotate(90deg)}.tree-row>.chevron.empty{visibility:hidden;margin:0}.entry-icon{color:var(--muted);margin-right:3px;flex:none}.tree-row[data-root="true"]>.entry-icon{color:var(--accent)}.tree-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;background:transparent;border:0;padding:0 3px;height:100%;font-weight:400}.tree-row .tree-label:hover{background:transparent}.tree-row[data-root="true"] .tree-label{font-weight:500}.tree-label:disabled{opacity:.6}.actions{visibility:hidden;gap:0}.tree-row:hover>.actions,.tree-row:focus-within>.actions{visibility:visible}.actions .icon-button{width:22px;height:22px}.actions .remove:hover{color:#e17474}.tree-children{margin-left:11px;padding-left:7px;border-left:1px solid var(--line)}.status-dot{width:5px;height:5px;border-radius:50%;background:var(--muted);flex:none;margin:0 4px}.status-dot.saved{background:var(--accent)}.status-dot.expired{background:transparent;border:1px solid var(--muted);width:6px;height:6px}.toggle,.floating{display:flex;align-items:center;gap:6px}.tree-caption{color:var(--muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .floating{border-radius:7px;padding:8px 12px;white-space:nowrap}.floating[hidden]{display:none}.marker{width:27px;height:25px;padding:0;border-radius:6px;color:var(--accent);font-size:15px;box-shadow:none}.notice{bottom:30px;left:50%;transform:translateX(-50%);max-width:540px;border-radius:8px;padding:10px 16px;font-size:13px;line-height:1.6}.notice[hidden]{display:none}
    footer{padding:8px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px;line-height:1.6}.notice{display:flex;align-items:center;gap:16px}.undo{color:var(--accent);white-space:nowrap;padding:4px 8px}.marker{display:flex;align-items:center;justify-content:center}.marker svg{width:15px;height:15px}@media(prefers-reduced-motion:reduce){button,.chevron svg{transition:none}}
  </style><button class="toggle" title="打开分支面板"></button><aside class="panel" hidden><header><h2>对话分支<span class="heading-count"></span></h2><div class="toolbar"><button class="icon-button collapse-all" aria-label="折叠全部" title="折叠全部"></button><button class="icon-button close" aria-label="收起分支面板" title="收起分支面板"></button></div></header><div class="list" role="tree" aria-label="对话分支"></div><footer>点击标题打开聊天，点击箭头展开子分支。<br>移除节点会连同子分支移出列表，聊天仍保留。</footer></aside><button class="floating" hidden></button><div class="notice" role="status" hidden><span class="notice-text"></span><button class="plain undo" hidden>撤销</button></div>`;
  const $=q=>shadow.querySelector(q),panel=$('.panel'),toggle=$('.toggle'),floating=$('.floating'),list=$('.list');
  const visible=e=>!!e&&e.isConnected&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0&&!e.closest('[inert],[hidden],[aria-hidden="true"]');
  const paths={branch:'M6 3v12m0-6h5a4 4 0 0 0 4-4V3 M4 3a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M4 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M13 3a2 2 0 1 0 4 0a2 2 0 1 0-4 0',chevron:'m7 4 6 6-6 6',folder:'M2 5h6l2 2h8v10H2V5Z',chat:'M3 3h14v11H8l-5 4V3Z',close:'m5 5 10 10M15 5 5 15',remove:'M4 5h12M8 5V3h4v2M6 5l1 12h6l1-12M9 8v6m2-6v6',back:'M9 5 4 10l5 5M4 10h8a4 4 0 0 1 4 4v2',collapse:'M6 3h11v11M3 6h11v11H3V6Zm3 6h5'};
  function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.4');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.chat);svg.append(path);return svg;}
  function iconButton(name,label,cls,click){const b=textButton('',cls,click);b.append(icon(name));b.title=label;b.setAttribute('aria-label',label);return b;}
  const nativeStyle=document.createElement('style');nativeStyle.id='branch-companion-native-style';nativeStyle.textContent='button[data-branch-companion="menu"]{cursor:pointer;white-space:nowrap;border:0;border-left:1px solid #8885;background-color:transparent;transition:background-color 90ms ease;display:inline-flex;align-items:center;gap:5px}button[data-branch-companion="menu"]:hover{background-color:var(--bc-hover,#8882)}button[data-branch-companion="menu"]:active{background-color:var(--bc-pressed,#8884)}button[data-branch-companion="menu"]:focus-visible{outline:2px solid currentColor;outline-offset:-2px}button[data-branch-companion="menu"] svg{width:14px;height:14px;flex:none}';document.head.append(nativeStyle);
  $('.collapse-all').append(icon('collapse'));$('.close').append(icon('close'));floating.append(icon('branch'),document.createTextNode('添加到新的分支'));floating.title='创建分支并引用选中文字';
  function syncAppearance(){const sample=document.querySelector('button[aria-label="隐藏侧边栏"],button[aria-label="显示侧边栏"]')||document.body,s=getComputedStyle(sample),sig=s.fontFamily+'|'+s.fontSize;if(sig===appearanceSignature)return;appearanceSignature=sig;host.style.setProperty('--native-font',s.fontFamily);host.style.setProperty('--native-size',Math.max(12,Math.min(14,parseFloat(s.fontSize)||13))+'px');}
  function on(t,event,fn,options){t.addEventListener(event,fn,options);removers.push(()=>t.removeEventListener(event,fn,options));}
  function textButton(label,cls,click){const b=document.createElement('button');b.textContent=label;b.className=cls;b.onclick=click;return b;}
  function note(text,undo=false){const n=$('.notice');$('.notice-text').textContent=text;$('.undo').hidden=!undo;n.hidden=false;clearTimeout(note.timer);note.timer=setTimeout(()=>n.hidden=true,undo?14000:6500);}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(nodes));}catch{note('本地保存失败，请导出分支记录。');}if(typeof window.__branchCompanionPersist==='function')window.__branchCompanionPersist(JSON.stringify({version:1,nodes}));render();schedule();}
  function fiber(el){for(let h=el;h;h=h.parentElement){const k=Object.keys(h).find(k=>k.startsWith('__reactFiber$'));if(k)return h[k];}return null;}
  function currentMessages(){return [...document.querySelectorAll(SELECTOR)].filter(e=>visible(e)&&(!e.matches('[data-local-conversation-final-assistant]')||!e.querySelector('[data-response-annotation-target]')));}
  function messageMeta(el){if(!el)return null;if(el.matches('[data-chatgpt-selection-message-id]'))return {sourceId:el.dataset.chatgptSelectionConversationId,messageId:el.dataset.chatgptSelectionMessageId,kind:'chatgpt'};const a=el.matches('[data-response-annotation-conversation][data-response-annotation-target]')?el:el.querySelector('[data-response-annotation-conversation][data-response-annotation-target]');return a?{sourceId:a.getAttribute('data-response-annotation-conversation'),messageId:a.getAttribute('data-response-annotation-target'),kind:'local'}:null;}
  function currentId(){const contentIds=[...new Set(currentMessages().map(e=>cleanId(messageMeta(e)?.sourceId)).filter(Boolean))],rows=[...document.querySelectorAll('[data-app-action-sidebar-thread-selected="true"][data-app-action-sidebar-thread-id]')].filter(visible),selected=cleanId(rows.at(-1)?.getAttribute('data-app-action-sidebar-thread-id'));if(selected&&contentIds.includes(selected))return selected;if(contentIds.length===1)return contentIds[0];return selected||contentIds.at(-1)||null;}
  function canonicalId(id){id=cleanId(id);const seen=new Set();while(id&&!seen.has(id)){seen.add(id);const n=nodes.find(n=>(cleanId(n.clientTargetId)===id&&cleanId(n.targetId)!==id)||(cleanId(n.clientSourceId)===id&&cleanId(n.sourceId)!==id));if(!n)break;id=cleanId(cleanId(n.clientTargetId)===id?n.targetId:n.sourceId);}return id;}
  function quoteTitle(quote){const title=quote.replace(/\s+/g,' ').trim();return title.length>42?title.slice(0,41)+'…':title||'新分支';}
  function allProps(){let f=fiber(document.querySelector('button[aria-label="隐藏侧边栏"],button[aria-label="显示侧边栏"]')||currentMessages().at(-1)||document.querySelector('[contenteditable="true"]')||document.body);if(!f)return [];while(f.return)f=f.return;f=f.stateNode?.current||f;const stack=[f],seen=new Set(),result=[];while(stack.length&&seen.size<50000){const n=stack.pop();if(!n||seen.has(n))continue;seen.add(n);if(n.child)stack.push(n.child);if(n.sibling)stack.push(n.sibling);if(n.memoizedProps&&typeof n.memoizedProps==='object')result.push(n.memoizedProps);}return result;}
  function navigation(){const props=allProps(),router=props.find(p=>typeof p.router?.navigate==='function'&&p.router.state?.location)?.router;const fn=router?(route=>router.navigate(route)):props.find(p=>typeof p.navigate==='function')?.navigate;if(fn)navigateCache=fn;return fn||navigateCache;}
  async function until(test,timeout=18000){const end=Date.now()+timeout;while(!disposed&&Date.now()<end){const value=test();if(value)return value;await new Promise(r=>setTimeout(r,160));}throw Error('客户端未返回目标聊天；请检查原生分叉结果，勿重复点击。');}
  async function jump(id,messageId,kind){if(!id)throw Error('分支尚未创建完成。');id=canonicalId(id);const related=nodes.find(n=>canonicalId(n.targetId)===id||canonicalId(n.sourceId)===id),route=(kind||related?.kind)==='local'?'/local/':'/c/';if(route==='/local/'&&!UUID.test(id))throw Error('分支聊天标识尚未准备好，请稍后重试。');if(canonicalId(currentId())!==id){const nav=navigation();if(!nav)throw Error('当前版本未找到原生导航入口。');nav(route+encodeURIComponent(id));await until(()=>canonicalId(currentId())===id,30000);}if(messageId){const n=nodes.find(n=>canonicalId(n.sourceId)===id&&n.messageId===messageId),r=n?restoreRange(n):null;const el=r?(r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentElement):currentMessages().find(e=>messageMeta(e)?.messageId===messageId);el?.scrollIntoView({block:'center',behavior:'instant'});}schedule();}
  async function safeJump(id,messageId){try{await jump(id,messageId);}catch(e){note(e.message);}}
  function captureSelection(){const s=getSelection();if(!s||s.isCollapsed||s.rangeCount!==1)return null;const range=s.getRangeAt(0),a=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement,b=range.endContainer.nodeType===1?range.endContainer:range.endContainer.parentElement;const source=a?.closest(SELECTOR);if(!source||source!==b?.closest(SELECTOR)||!visible(source))return null;const meta=messageMeta(source),quote=s.toString();if(!meta||!quote.trim()||quote.length>16000)return null;const prefixRange=document.createRange();prefixRange.selectNodeContents(source);prefixRange.setEnd(range.startContainer,range.startOffset);const start=prefixRange.toString().length,full=source.textContent;return {...meta,quote,start,prefix:full.slice(Math.max(0,start-50),start),suffix:full.slice(start+quote.length,start+quote.length+50),sourceTitle:document.title,range:range.cloneRange(),source};}
  function restoreRange(n){const source=currentMessages().find(e=>{const m=messageMeta(e);return canonicalId(m?.sourceId)===canonicalId(n.sourceId)&&m?.messageId===n.messageId;});if(!source)return null;const full=source.textContent;let start=n.start;if(full.slice(start,start+n.quote.length)!==n.quote){const positions=[];let pos=-1;while((pos=full.indexOf(n.quote,pos+1))!==-1)positions.push(pos);const good=positions.filter(i=>(!n.prefix||full.slice(Math.max(0,i-n.prefix.length),i)===n.prefix)&&(!n.suffix||full.slice(i+n.quote.length,i+n.quote.length+n.suffix.length)===n.suffix));if(good.length===1)start=good[0];else if(positions.length===1)start=positions[0];else return null;}
    const walker=document.createTreeWalker(source,NodeFilter.SHOW_TEXT),r=document.createRange();let offset=0,foundStart=false,t;while((t=walker.nextNode())){const end=offset+t.length;if(!foundStart&&start>=offset&&start<end){r.setStart(t,start-offset);foundStart=true;}if(foundStart&&start+n.quote.length<=end){r.setEnd(t,start+n.quote.length-offset);return r;}offset=end;}return null;
  }
  function localForkProps(source){const anchor=source?.querySelector('[data-response-annotation-conversation][data-response-annotation-target]')||source;for(let f=fiber(anchor);f;f=f.return){const p=f.memoizedProps;if(typeof p?.onFork==='function'&&p.forkDisabled!==true)return p;}return null;}
  function nativeMenu(){
    if(!candidate||selecting)return null;
    const selection=getSelection();if(!selection||selection.isCollapsed)return null;
    const live=captureSelection()||candidate;
    const menus=new Set(),namedMenus=new Set();let exact=null;
    for(const b of document.querySelectorAll('button')){
      if(b.dataset.branchCompanion||b.dataset.bookmarkCompanion||!visible(b))continue;
      const label=(b.getAttribute('aria-label')||b.textContent||'').replace(/\s+/g,'');
      if(/^(?:向ChatGPT提问|询问ChatGPT|AskChatGPT)$/i.test(label))namedMenus.add(b.parentElement);
      let f=fiber(b);for(let i=0;f&&i<12;i++,f=f.return){
        const p=f.memoizedProps;
        if(typeof p?.selectedText==='string'&&p.selectedText.trim()&&(typeof p.onAddSelectedText==='function'||typeof p.onOpenSideChat==='function')){
          menus.add(b.parentElement);if(p.selectedText===live.quote)exact=b.parentElement;break;
        }
      }
    }
    // KaTeX selection text includes visual glyphs and accessibility text, while
    // the native menu normalizes it. A unique active selection toolbar remains
    // the same toolbar even when those two string representations differ.
    return exact||(menus.size===1?[...menus][0]:null)||(namedMenus.size===1?[...namedMenus][0]:null);
  }
  function installMenu(){
    const menu=candidate&&!busy&&!selecting?nativeMenu():null;
    document.querySelectorAll('[data-branch-companion="menu"]').forEach(e=>{if(e.parentElement!==menu)e.remove();});
    if(!candidate||busy||selecting){floating.hidden=true;return;}
    if(menu){
      floating.hidden=true;
      if(!menu.querySelector('[data-branch-companion="menu"]')){
        const b=document.createElement('button'),existing=menu.querySelector('button'),style=getComputedStyle(existing||menu);
        b.dataset.branchCompanion='menu';b.className=existing?.className||'';
        b.append(icon('branch'),document.createTextNode('添加到新的分支'));
        for(const prop of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color'])b.style[prop]=style[prop];
        b.style.padding=style.padding;b.style.borderRadius=style.borderRadius;
        b.title='根据选中文字创建分支，保留到这条回答为止的上下文';
        b.setAttribute('aria-label','添加到新的分支');
        b.onpointerdown=e=>e.preventDefault();b.onclick=()=>createBranch().catch(e=>note(e.message));menu.append(b);
      }
    }else{
      const box=candidate.range.getBoundingClientRect();
      if(!box.width||box.bottom<0||box.top>innerHeight){floating.hidden=true;return;}
      floating.hidden=false;floating.style.left=Math.max(8,Math.min(innerWidth-220,box.right-180))+'px';floating.style.top=Math.min(innerHeight-45,box.bottom+9)+'px';
    }
  }
  function editorController(targetId){if(targetId&&canonicalId(currentId())!==canonicalId(targetId))return null;for(const el of document.querySelectorAll('[contenteditable="true"]')){if(!visible(el))continue;for(let f=fiber(el);f;f=f.return){const c=f.memoizedProps?.composerController;if(c&&typeof c.setText==='function'&&c.view?.dom?.isConnected&&visible(c.view.dom))return c;}}return null;}
  async function createBranch(){if(busy)return;const chosen=candidate||captureSelection();if(!chosen)throw Error('请先选择同一条回答中的文字。');const source=chosen.source||currentMessages().find(e=>{const m=messageMeta(e);return canonicalId(m?.sourceId)===canonicalId(chosen.sourceId)&&m?.messageId===chosen.messageId;});const p=chosen.kind==='local'?localForkProps(source):allProps().find(p=>typeof p.onFork==='function'&&typeof p.copyText==='string'&&p.copyText.includes(chosen.messageId)&&[chosen.sourceId,canonicalId(chosen.sourceId)].some(id=>p.threadId==='chatgpt:'+id));if(!p||p.forkDisabled)throw Error('当前回答没有可用的原生分叉入口。');const nav=navigation();if(!nav)throw Error('未找到聊天导航入口，暂不创建分支。');
    busy=true;floating.hidden=true;const n={id:crypto.randomUUID(),kind:chosen.kind,sourceId:canonicalId(chosen.sourceId),clientSourceId:chosen.sourceId,messageId:chosen.messageId,quote:chosen.quote,start:chosen.start,prefix:chosen.prefix,suffix:chosen.suffix,sourceTitle:chosen.sourceTitle,targetId:null,targetTitle:quoteTitle(chosen.quote),state:'creating',createdAt:new Date().toISOString()};nodes.push(n);persist();
    try{const forkResult=p.onFork();if(forkResult?.then)await forkResult;const id=await until(()=>{const id=canonicalId(currentId());return id&&id!==canonicalId(chosen.sourceId)&&currentMessages().some(e=>{const m=messageMeta(e);return canonicalId(m?.sourceId)===id&&m?.messageId===chosen.messageId;})?id:null;},30000);n.targetId=id;n.state='ready';const c=await until(()=>editorController(id),10000);if(c.getText().trim()===''){c.setText('关于这段内容：\n「'+chosen.quote+'」\n\n');c.focus('end');n.prefilled=true;}persist();setPanelOpen(true);candidate=null;getSelection()?.removeAllRanges();note('已开启分支，已保留此前上下文。直接输入追问即可。');}
    catch(e){n.state='uncertain';n.error=e.message;persist();throw e;}finally{busy=false;render();installMenu();}}
  function saveCollapsed(){try{localStorage.setItem(KEY+'.collapsed',JSON.stringify([...collapsed]));}catch{}}
  function openNode(n){if(n.state==='expired'){note('该草稿地址已失效，可用“回到原文”重新创建分支。');return;}safeJump(n.targetId);}
  function descendants(seed,sourceId){
    const found=new Set(seed),pending=sourceId?[canonicalId(sourceId)]:[];
    for(const id of seed){const n=nodes.find(n=>n.id===id);if(n?.targetId)pending.push(canonicalId(n.targetId));}
    const visited=new Set();
    while(pending.length){const source=pending.pop();if(visited.has(source))continue;visited.add(source);for(const n of nodes){if(canonicalId(n.sourceId)!==source)continue;found.add(n.id);if(n.targetId)pending.push(canonicalId(n.targetId));}}
    return found;
  }
  function removeIds(ids){
    if(busy){note('分支正在创建，请稍后移除。');return false;}
    const removed=nodes.map((n,index)=>({n,index})).filter(({n})=>ids.has(n.id));if(!removed.length)return false;
    lastDeletion=removed;nodes=nodes.filter(n=>!ids.has(n.id));persist();
    note('已从列表移除 '+removed.length+' 个分支，聊天仍保留。',true);return true;
  }
  function removeBranch(id){return removeIds(descendants(new Set([id])));}
  function removeSource(id){return removeIds(descendants(new Set(),id));}
  function undoRemove(){
    if(!lastDeletion)return false;
    for(const {n,index} of lastDeletion){if(!nodes.some(v=>v.id===n.id))nodes.splice(Math.min(index,nodes.length),0,n);}
    lastDeletion=null;persist();note('已恢复分支节点与原文标记。');return true;
  }
  function setPanelOpen(open){panel.hidden=!open;toggle.hidden=open;window.__branchCompanionPanelOpen=open;schedule();}
  function updateActive(){const id=canonicalId(currentId());for(const row of list.querySelectorAll('.tree-row'))row.dataset.active=String(!!id&&canonicalId(row.dataset.conversation)===id);}
  function render(){
    const focusWasInside=list.contains(shadow.activeElement),oldFocus=shadow.activeElement?.closest('.tree-row')?.dataset.key;
    const scroll=list.scrollTop;list.replaceChildren();toggle.replaceChildren(icon('branch'),document.createTextNode('分支'+(nodes.length?' '+nodes.length:'')));$('.heading-count').textContent=nodes.length?String(nodes.length):'';
    if(!nodes.length){const e=document.createElement('p');e.className='empty';e.textContent='在回答中选中文字，点击“添加到新的分支”。';list.append(e);return;}
    const groups=new Map(),incoming=new Set(),visited=new Set();
    for(const n of nodes){const id=canonicalId(n.sourceId);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(n);if(n.targetId)incoming.add(canonicalId(n.targetId));}
    function addRow(parent,{key,conversation,title,n=null,children=[],level=1,parentKey=null}){
      const item=document.createElement('div'),row=document.createElement('div');row.className='tree-row';row.dataset.key=key;row.dataset.conversation=conversation||'';row.dataset.root=String(!n);if(n)row.dataset.nodeId=n.id;if(parentKey)row.dataset.parentKey=parentKey;
      item.setAttribute('role','none');row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(level));row.setAttribute('aria-label',title);row.tabIndex=-1;
      const hasChildren=children.length>0,isOpen=!collapsed.has(key);
      if(hasChildren)row.setAttribute('aria-expanded',String(isOpen));
      const chevron=iconButton('chevron',isOpen?'折叠子分支':'展开子分支','icon-button chevron'+(hasChildren?'':' empty'),e=>{e.stopPropagation();changeExpanded();});chevron.tabIndex=-1;if(!hasChildren){chevron.disabled=true;chevron.setAttribute('aria-hidden','true');}
      const image=document.createElement('span');image.className='entry-icon';image.append(icon(!n||hasChildren?'folder':'chat'));
      const status=n?(n.state==='ready'?'已保存':n.state==='expired'?'草稿地址已失效':n.state==='uncertain'?'创建结果待确认':'正在创建'):'';
      const label=textButton(title,'tree-label '+(n?'target':'source'),e=>{e.stopPropagation();focusedKey=key;n?openNode(n):safeJump(conversation,children[0]?.messageId);});label.tabIndex=-1;label.title=n?title+'\n'+status+'\n引用：'+n.quote:title;label.disabled=!!n&&(!n.targetId||n.state==='expired');
      row.append(chevron,image,label);
      if(n){const dot=document.createElement('span');dot.className='status-dot '+(n.state==='expired'?'expired':n.targetId?'saved':'');dot.title=status;dot.setAttribute('aria-label',status);row.append(dot);}
      const actions=document.createElement('span');actions.className='actions';
      if(n){const back=iconButton('back','回到原文','icon-button back',e=>{e.stopPropagation();safeJump(n.sourceId,n.messageId);});actions.append(back);}
      const remove=iconButton('remove',n?'移除此分支及子分支（保留聊天）':'移除此分支树（保留聊天）','icon-button remove',e=>{e.stopPropagation();n?removeBranch(n.id):removeSource(conversation);});remove.disabled=busy;actions.append(remove);row.append(actions);item.append(row);parent.append(item);
      row.onclick=e=>{if(e.target.closest('button'))return;focusedKey=key;row.focus();n?openNode(n):safeJump(conversation,children[0]?.messageId);};
      row.onfocus=()=>{focusedKey=key;for(const r of list.querySelectorAll('.tree-row'))r.tabIndex=r===row?0:-1;};
      let group=null;
      function changeExpanded(force){if(!hasChildren)return;const open=force===undefined?collapsed.has(key):force;if(open)collapsed.delete(key);else collapsed.add(key);row.setAttribute('aria-expanded',String(open));chevron.title=open?'折叠子分支':'展开子分支';chevron.setAttribute('aria-label',chevron.title);group.hidden=!open;saveCollapsed();schedule();}
      row.onkeydown=e=>{
        if(e.target!==row)return;
        const rows=[...list.querySelectorAll('.tree-row')].filter(visible),index=rows.indexOf(row);let next=null;
        if(e.key==='ArrowDown')next=rows[Math.min(index+1,rows.length-1)];else if(e.key==='ArrowUp')next=rows[Math.max(0,index-1)];
        else if(e.key==='ArrowRight'){if(hasChildren&&collapsed.has(key))changeExpanded(true);else if(hasChildren)next=group.querySelector('.tree-row');}
        else if(e.key==='ArrowLeft'){if(hasChildren&&!collapsed.has(key))changeExpanded(false);else next=[...list.querySelectorAll('.tree-row')].find(r=>r.dataset.key===parentKey);}
        else if(e.key==='Home')next=rows[0];else if(e.key==='End')next=rows.at(-1);
        else if(e.key==='Enter'){n?openNode(n):safeJump(conversation,children[0]?.messageId);}
        else if(e.key==='Delete'){n?removeBranch(n.id):removeSource(conversation);}
        else return;e.preventDefault();next?.focus();
      };
      if(hasChildren){group=document.createElement('div');group.className='tree-children';group.setAttribute('role','group');group.hidden=!isOpen;item.append(group);for(const child of children){if(visited.has(child.id))continue;visited.add(child.id);const nested=(groups.get(canonicalId(child.targetId))||[]).filter(c=>!visited.has(c.id));addRow(group,{key:'branch:'+child.id,conversation:child.targetId,title:child.targetTitle||'新分支',n:child,children:nested,level:level+1,parentKey:key});}}
    }
    function addRoot(id){const children=(groups.get(id)||[]).filter(n=>!visited.has(n.id));if(!children.length)return;addRow(list,{key:'source:'+id,conversation:id,title:children[0].sourceTitle||'来源聊天',children});}
    for(const id of groups.keys())if(!incoming.has(id))addRoot(id);
    for(const n of nodes)if(!visited.has(n.id))addRoot(canonicalId(n.sourceId));
    const rows=[...list.querySelectorAll('.tree-row')],wanted=rows.find(r=>r.dataset.key===(oldFocus||focusedKey)&&visible(r))||rows.find(visible);if(wanted){wanted.tabIndex=0;if(focusWasInside)wanted.focus();}list.scrollTop=scroll;updateActive();
  }
  function updateMarkers(){const current=canonicalId(currentId()),occupied=new Map(),ids=new Set(nodes.map(n=>n.id));for(const [id,m]of markers)if(!ids.has(id)){m.remove();markers.delete(id);}for(const n of nodes){let marker=markers.get(n.id);const range=canonicalId(n.sourceId)===current?restoreRange(n):null;const boxes=range?[...range.getClientRects()].filter(r=>r.width>0&&r.height>0&&r.bottom>70&&r.top<innerHeight-35):[];const first=boxes[0];if(!first){if(marker)marker.hidden=true;continue;}const line=boxes.filter(r=>Math.abs(r.top-first.top)<3),right=Math.max(...line.map(r=>r.right));const group=n.messageId+':'+n.start,count=occupied.get(group)||0;occupied.set(group,count+1);if(!marker){marker=iconButton('branch','打开此处的对话分支','marker',()=>openNode(n));marker.dataset.nodeId=n.id;shadow.append(marker);markers.set(n.id,marker);}marker.hidden=false;marker.title='打开分支：'+n.quote.slice(0,100);marker.style.left=Math.min(innerWidth-35,panel.hidden?innerWidth:panel.getBoundingClientRect().left-33,right+5)+'px';marker.style.top=Math.min(innerHeight-30,Math.max(70,first.top-8)+count*28)+'px';}}
  function updateAliases(){const aliases=new Map();for(const el of [...currentMessages(),...document.querySelectorAll('[contenteditable="true"]')].filter(visible)){for(let f=fiber(el);f;f=f.return){const d=f.memoizedProps?.value?.chatGptSelectionContext?.conversationDetailsTarget;if(d?.clientConversationId&&d.serverConversationId)aliases.set(cleanId(d.clientConversationId),cleanId(d.serverConversationId));}}let changed=false;for(const n of nodes){const oldTarget=n.targetId,target=aliases.get(cleanId(oldTarget))||canonicalId(oldTarget);if(target&&target!==oldTarget){n.clientTargetId=n.clientTargetId||oldTarget;n.targetId=target;n.state='ready';changed=true;}const oldSource=n.sourceId,source=aliases.get(cleanId(oldSource))||canonicalId(oldSource);if(source&&source!==oldSource){n.clientSourceId=n.clientSourceId||oldSource;n.sourceId=source;changed=true;}}if(changed)persist();}
  function refresh(){if(disposed||!scheduled)return;scheduled=false;try{syncAppearance();updateAliases();updateActive();updateMarkers();installMenu();}catch(e){console.error('[branch-companion]',e);}}
  function schedule(){if(!scheduled&&!disposed){scheduled=true;requestAnimationFrame(refresh);setTimeout(refresh,120);}}
  on(toggle,'click',()=>setPanelOpen(true));on($('.close'),'click',()=>setPanelOpen(false));on($('.undo'),'click',undoRemove);
  on($('.collapse-all'),'click',()=>{for(const row of list.querySelectorAll('.tree-row[aria-expanded]'))collapsed.add(row.dataset.key);saveCollapsed();render();schedule();});
  on(floating,'pointerdown',e=>e.preventDefault());on(floating,'click',()=>createBranch().catch(e=>note(e.message)));
  on(document,'pointerdown',e=>{if(e.composedPath().includes(host)||e.target?.closest?.('[data-branch-companion="menu"],[data-bookmark-companion="menu"]'))return;if(e.button===0)selecting=true;candidate=null;schedule();},true);
  on(document,'pointerup',e=>{selecting=false;if(e.composedPath().includes(host))return;setTimeout(()=>{if(disposed)return;const c=captureSelection();if(c)candidate=c;schedule();},180);},true);
  on(document,'selectionchange',()=>{if(busy)return;const c=captureSelection();if(c)candidate=c;schedule();});
  on(window,'scroll',schedule,true);on(window,'resize',schedule);
  const observer=new MutationObserver(records=>{if(records.every(r=>r.target===host||host.contains(r.target)||r.target?.dataset?.branchCompanion))return;schedule();});observer.observe(document.body,{childList:true,subtree:true});
  refreshTimer=setInterval(schedule,900);
  const api={version:'0.4.6',debug:()=>({scheduled,busy,candidate:!!candidate,currentId:currentId(),visibleSelectedRows:[...document.querySelectorAll('[data-app-action-sidebar-thread-selected="true"][data-app-action-sidebar-thread-id]')].filter(visible).map(e=>e.getAttribute('data-app-action-sidebar-thread-id')),rect:candidate?candidate.range.getBoundingClientRect().toJSON():null,menuFound:!!nativeMenu(),visibility:document.visibilityState}),refresh:()=>{scheduled=true;refresh();},get nodes(){return JSON.parse(JSON.stringify(nodes));},get pendingSelection(){return candidate?{sourceId:candidate.sourceId,messageId:candidate.messageId,kind:candidate.kind,quote:candidate.quote}:null;},captureAnchor:()=>{const a=captureSelection();if(!a)return null;const {kind,sourceId,messageId,start,prefix,sourceTitle}=a;const quote=a.range.toString(),suffix=a.source.textContent.slice(start+quote.length,start+quote.length+50);return {kind,sourceId:canonicalId(sourceId),messageId,quote,start,prefix,suffix,sourceTitle};},resolveId:canonicalId,capture:()=>{candidate=captureSelection();schedule();return !!candidate;},createBranch,jump,selectionMenu:nativeMenu,get isSelecting(){return selecting;},show:()=>setPanelOpen(true),restoreRange,removeBranch,removeSource,undoRemove,
    dispose(){window.__branchCompanionPanelOpen=!panel.hidden;disposed=true;clearInterval(refreshTimer);clearTimeout(note.timer);observer.disconnect();removers.forEach(f=>f());document.querySelectorAll('[data-branch-companion="menu"]').forEach(e=>e.remove());nativeStyle.remove();host.remove();if(window.__branchCompanion===api)delete window.__branchCompanion;}};
  window.__branchCompanion=api;syncAppearance();render();setPanelOpen(wasOpen);schedule();return {installed:true,version:api.version,savedNodes:nodes.length};
})()
