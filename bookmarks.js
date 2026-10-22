(() => {
  'use strict';
  window.__bookmarkCompanion?.dispose();
  const branch=window.__branchCompanion;
  if(!branch?.captureAnchor||!branch?.jump)throw Error('书签模块需要更新后的GPT助手。');
  // Preserve the historical storage namespace when adding modules or renaming the product.
  const KEY='branch-companion.bookmarks.v1',removers=[],timers=new Set();
  const SELECTOR='[data-chatgpt-selection-message-id],[data-response-annotation-conversation][data-response-annotation-target]';
  let disposed=false,selected=null,busy=false,removed=null,highlightTimer,noticeTimer,scanCancelled=false,menuButton=null;
  let bookmarks=[],query='',editId=null;
  try{const raw=localStorage.getItem(KEY);bookmarks=raw===null?(window.__bookmarkCompanionRestore?.bookmarks||[]):JSON.parse(raw);}catch{bookmarks=window.__bookmarkCompanionRestore?.bookmarks||[];}
  bookmarks=bookmarks.filter(b=>b&&typeof b.id==='string'&&typeof b.quote==='string');
  const host=document.createElement('div');host.id='bookmark-companion-host';document.body.append(host);const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>
    :host{all:initial;font:13px/1.5 system-ui,sans-serif;color:#242424;--bg:#fff;--fg:#242424;--muted:#737373;--line:#e3e3df;--hover:#00000009;--accent:#216d63}*{box-sizing:border-box}button,input{font:inherit;color:inherit}button{cursor:pointer}button:disabled{cursor:wait;opacity:.6}[hidden]{display:none!important}button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button{border:0;border-radius:5px;background:transparent}button:hover{background:var(--hover)}
    .toggle,.panel,.floating,.notice{position:fixed;z-index:2147483605;background:var(--bg);color:var(--fg);border:1px solid var(--line);box-shadow:0 8px 26px #0002}.toggle{top:151px;right:14px;padding:8px 12px;border-radius:8px;display:flex;align-items:center;gap:7px}.panel{top:100px;right:14px;width:360px;max-width:calc(100vw - 28px);max-height:calc(100vh - 120px);border-radius:10px;display:flex;flex-direction:column;overflow:hidden}.header{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--line)}h2{font:inherit;font-weight:600;flex:1;margin:0}.count{color:var(--muted);font-size:11px;margin-left:6px}.close{width:26px;height:26px}.search{margin:10px 12px;padding:7px 9px;min-width:0;border:1px solid var(--line);border-radius:6px;background:var(--bg)}.list{overflow:auto;padding:0 7px 8px;scrollbar-width:thin;min-height:80px}.item{padding:10px 7px;border-radius:6px}.item:hover{background:var(--hover)}.open{display:block;text-align:left;width:100%;padding:0}.label{display:block;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.quote{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;color:var(--muted);margin-top:4px;white-space:pre-wrap;word-break:break-word}.meta{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;margin-top:6px}.actions{display:flex;gap:3px;justify-content:flex-end;margin-top:5px}.actions button{font-size:11px;color:var(--muted);padding:3px 6px}.actions button:hover{color:var(--accent)}.empty{padding:12px;color:var(--muted);line-height:1.8}.footer{padding:9px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.floating{padding:7px 11px;border-radius:7px}.notice{bottom:32px;left:50%;transform:translateX(-50%);padding:10px 15px;border-radius:8px;max-width:min(620px,90vw);display:flex;align-items:center;gap:10px}.notice button{color:var(--accent);white-space:nowrap}.edit{display:flex;gap:5px;margin-bottom:7px}.edit input{min-width:0;flex:1;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:5px}.edit button{padding:4px}.result{color:var(--accent)}
    @media(prefers-color-scheme:dark){:host{--bg:#252525;--fg:#e8e8e8;--muted:#a2a2a2;--line:#444;--hover:#ffffff0d;--accent:#9fd5c5}}
    </style><button class="toggle" title="GPT助手：打开所有聊天的书签">▱ <span>书签</span><span class="toggle-count"></span></button><aside class="panel" aria-label="聊天书签" hidden><div class="header"><h2>GPT助手 · 书签 <span class="count"></span></h2><button class="close" aria-label="收起书签">×</button></div><input class="search" aria-label="搜索书签" placeholder="搜索标题、原文或聊天"><div class="list"></div><div class="footer">选中一行文字 → 添加书签。<br>书签可跨聊天跳转；复制链接后可从其他地方打开。</div></aside><button class="floating" hidden>▱ 添加书签</button><div class="notice" role="status" hidden><span></span><button class="undo" hidden>撤销</button><button class="cancel" hidden>取消定位</button></div>`;
  const $=s=>root.querySelector(s),list=$('.list'),panel=$('.panel'),floating=$('.floating');
  const dockStyle=document.createElement('style');dockStyle.textContent=`.toggle,.panel{top:var(--bookmark-top,151px)}.panel{max-height:var(--bookmark-height,calc(100vh - 175px));transform-origin:top right}.list{min-height:0}.header,.search,.footer{flex-shrink:0}.panel:not([hidden]){animation:bookmark-expand 130ms ease-out}@keyframes bookmark-expand{from{opacity:.3;transform:translateY(-4px) scale(.985)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.panel:not([hidden]){animation:none}}`;root.append(dockStyle);
  const branchRoot=document.getElementById('branch-companion-host')?.shadowRoot,branchPanel=branchRoot?.querySelector('.panel'),branchToggle=branchRoot?.querySelector('.toggle');
  let layoutFrame=0;
  function layoutDock(){
    if(disposed)return;
    // Both helpers occupy one vertical dock. The bookmark header replaces its button
    // at the same anchor, rather than teleporting to the branch header's position.
    const gap=12,bottom=14;
    const nativeButtons=[...document.querySelectorAll('button,[role="button"]')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0&&r.right>innerWidth-380&&r.top>=85&&r.bottom<230);
    const top=Math.max(100,...nativeButtons.map(r=>Math.ceil(r.bottom)+gap)),available=Math.max(120,innerHeight-top-bottom),bookmarkReserve=panel.hidden?49:Math.min(290,available*.58);
    if(branchPanel)branchPanel.style.top=top+'px';if(branchToggle)branchToggle.style.top=top+'px';
    if(branchPanel)branchPanel.style.maxHeight=Math.max(60,available-bookmarkReserve-gap)+'px';
    const above=branchPanel&&!branchPanel.hidden?branchPanel:branchToggle;
    const anchor=Math.round(above?.getBoundingClientRect().bottom||136)+gap;
    host.style.setProperty('--bookmark-top',anchor+'px');
    host.style.setProperty('--bookmark-height',Math.max(80,innerHeight-anchor-bottom)+'px');
  }
  function scheduleLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;layoutDock();});}
  const dockResize=new ResizeObserver(scheduleLayout);if(branchPanel)dockResize.observe(branchPanel);if(branchToggle)dockResize.observe(branchToggle);
  const dockMutation=new MutationObserver(scheduleLayout);if(branchRoot)dockMutation.observe(branchRoot,{subtree:true,attributes:true,attributeFilter:['hidden']});
  const viewMutation=new MutationObserver(records=>{if(records.some(r=>!['bookmark-companion-host','branch-companion-host'].includes(r.target?.id)&&!r.target?.dataset?.bookmarkCompanion&&!r.target?.dataset?.branchCompanion))scheduleLayout();});viewMutation.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
  const on=(target,event,fn,options)=>{target.addEventListener(event,fn,options);removers.push(()=>target.removeEventListener(event,fn,options));};
  const delay=ms=>new Promise(resolve=>{const t=setTimeout(()=>{timers.delete(t);resolve();},ms);timers.add(t);});
  function clearHighlight(){clearTimeout(highlightTimer);CSS.highlights?.delete('companion-bookmark');}
  function note(text,{undo=false,cancel=false}={}){$('.notice span').textContent=text;$('.notice').hidden=false;$('.undo').hidden=!undo;$('.cancel').hidden=!cancel;clearTimeout(noticeTimer);if(!cancel)noticeTimer=setTimeout(()=>$('.notice').hidden=true,undo?14000:6500);}
  function save(){const payload={version:1,bookmarks};try{localStorage.setItem(KEY,JSON.stringify(bookmarks));}catch{note('浏览器存储未写入，正在尝试文件备份。');}if(typeof window.__bookmarkCompanionPersist==='function')window.__bookmarkCompanionPersist(JSON.stringify(payload));render();}
  function show(open=true){panel.hidden=!open;$('.toggle').hidden=open;window.__bookmarkCompanionPanelOpen=open;layoutDock();}
  function makeButton(text,fn,title){const b=document.createElement('button');b.textContent=text;b.onclick=fn;if(title)b.title=title;return b;}
  const HTML_TAGS=new Set('span div p strong b em i u s small sub sup code pre kbd br blockquote ul ol li h1 h2 h3 h4 h5 h6 table thead tbody tr th td'.split(' '));
  const MATH_TAGS=new Set('math mrow mi mn mo mtext mspace msub msup msubsup mfrac msqrt mroot munder mover munderover mtable mtr mtd menclose mpadded mphantom mmultiscripts mprescripts none semantics'.split(' '));
  const MATH_ATTRS=new Set('display mathvariant stretchy fence separator form largeop movablelimits accent accentunder linethickness columnalign rowalign columnspacing rowspacing subscriptshift superscriptshift'.split(' '));
  function safePreview(input){
    const fragment=typeof input==='string'?new DOMParser().parseFromString(input,'text/html').body:input;
    const out=document.createDocumentFragment();
    function append(node,parent){
      if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.textContent));return;}
      if(node.nodeType!==Node.ELEMENT_NODE){for(const child of node.childNodes)append(child,parent);return;}
      const tag=node.localName.toLowerCase();if(['script','style','iframe','object','embed','img','svg','annotation','annotation-xml'].includes(tag)||node.classList.contains('katex-html'))return;
      if(node.classList.contains('katex')){const math=node.querySelector('math');if(math){append(math,parent);return;}}
      if(!HTML_TAGS.has(tag)&&!MATH_TAGS.has(tag)){for(const child of node.childNodes)append(child,parent);return;}
      const el=MATH_TAGS.has(tag)?document.createElementNS('http://www.w3.org/1998/Math/MathML',tag):document.createElement(tag);
      if(MATH_TAGS.has(tag))for(const attr of node.attributes)if(MATH_ATTRS.has(attr.name)&&attr.value.length<100)el.setAttribute(attr.name,attr.value);
      for(const child of node.childNodes)append(child,el);parent.append(el);
    }
    for(const child of fragment.childNodes)append(child,out);return out;
  }
  function formattedRange(range){
    const common=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement,formula=common.closest?.('.katex');
    let fragment;if(formula?.querySelector('math')){fragment=document.createDocumentFragment();fragment.append(formula.querySelector('math').cloneNode(true));}else{
      fragment=range.cloneContents();
      const sourceMath=[...(common.querySelectorAll?.('.katex')||[])].filter(k=>range.intersectsNode(k));
      [...fragment.querySelectorAll('.katex')].forEach((k,index)=>{if(!k.querySelector('math')&&sourceMath[index]?.querySelector('math'))k.replaceChildren(sourceMath[index].querySelector('math').cloneNode(true));});
    }
    const box=document.createElement('div'),heading=common.closest?.('h1,h2,h3,h4,h5,h6,strong,b,em,i,code');
    if(heading&&!formula){const wrapper=document.createElement(/^h[1-6]$/.test(heading.localName)?'strong':heading.localName);wrapper.append(safePreview(fragment));box.append(wrapper);}else box.append(safePreview(fragment));
    return box.innerHTML.slice(0,200000);
  }
  function enrich(anchor){const source=message(anchor),range=source?rangeIn(source,anchor):null;return range?formattedRange(range):null;}
  function render(){
    const scroll=list.scrollTop;list.replaceChildren();$('.count').textContent=String(bookmarks.length);$('.toggle-count').textContent=bookmarks.length?String(bookmarks.length):'';
    const q=query.trim().toLocaleLowerCase(),items=bookmarks.filter(b=>!q||[b.label,b.quote,b.sourceTitle].some(t=>t.toLocaleLowerCase().includes(q))).slice().reverse();
    if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent=q?'没有匹配的书签。':'在聊天中选中要保存的那一行，点击“添加书签”。这里会显示所有聊天的书签。';list.append(p);}
    for(const b of items){const row=document.createElement('div');row.className='item';row.dataset.bookmarkId=b.id;
      if(editId===b.id){const form=document.createElement('form');form.className='edit';const input=document.createElement('input');input.maxLength=160;input.value=b.label;input.setAttribute('aria-label','书签名称');const ok=makeButton('保存',null);ok.type='submit';const cancel=makeButton('取消',()=>{editId=null;render();});cancel.type='button';form.append(input,ok,cancel);form.onsubmit=e=>{e.preventDefault();b.label=input.value.trim().slice(0,160)||b.quote.replace(/\s+/g,' ').slice(0,48);b.labelIsAutomatic=false;editId=null;save();};row.append(form);queueMicrotask(()=>{input.focus();input.select();});}
      const open=makeButton('',()=>jump(b.id).catch(()=>{}));open.className='open';open.disabled=busy;open.title='跳转到保存的这段原文';const label=document.createElement('span');label.className='label';const automatic=b.labelIsAutomatic??(b.label===b.quote.replace(/\s+/g,' ').trim().slice(0,48));if(automatic&&b.previewHTML){label.classList.add('rich');label.append(safePreview(b.previewHTML));}else label.textContent=b.label;const quote=document.createElement('span');quote.className='quote rich';if(b.previewHTML)quote.append(safePreview(b.previewHTML));else quote.textContent=b.quote;open.append(label,quote);row.append(open);
      const meta=document.createElement('div');meta.className='meta';meta.textContent=b.sourceTitle||'来源聊天';row.append(meta);
      const actions=document.createElement('div');actions.className='actions';actions.append(makeButton('复制链接',()=>copyLink(b.id).catch(e=>note(e.message))),makeButton('重命名',()=>{editId=b.id;render();}),makeButton('移除',()=>remove(b.id)));row.append(actions);list.append(row);
    }list.scrollTop=scroll;scheduleLayout();
  }
  function add(anchor=selected){if(!anchor?.quote?.trim())throw Error('请先选中同一条消息中的文字。');if(bookmarks.length>=2000)throw Error('书签已达到 2000 条，请先整理现有书签。');const existing=bookmarks.find(b=>b.sourceId===anchor.sourceId&&b.messageId===anchor.messageId&&b.start===anchor.start&&b.quote===anchor.quote);if(existing){show();note('这段原文已经保存。');return existing.id;}
    const b={id:crypto.randomUUID(),kind:anchor.kind,sourceId:anchor.sourceId,messageId:anchor.messageId,quote:anchor.quote,start:anchor.start,prefix:anchor.prefix,suffix:anchor.suffix,sourceTitle:(anchor.sourceTitle||'').slice(0,500),label:anchor.quote.replace(/\s+/g,' ').trim().slice(0,48),labelIsAutomatic:true,createdAt:new Date().toISOString()};const rich=enrich(b);if(rich)b.previewHTML=rich;if(JSON.stringify([...bookmarks,b]).length>3800000)throw Error('书签存储空间已满，请先整理现有书签。');bookmarks.push(b);save();selected=null;floating.hidden=true;getSelection()?.removeAllRanges();show();note('已保存这一段原文，可重命名或复制跳转链接。');return b.id;
  }
  function remove(id){const index=bookmarks.findIndex(b=>b.id===id);if(index<0)return;removed={bookmark:bookmarks[index],index};bookmarks.splice(index,1);save();note('已移除书签。',{undo:true});}
  function undo(){if(!removed)return;bookmarks.splice(Math.min(removed.index,bookmarks.length),0,removed.bookmark);removed=null;save();note('已恢复书签。');}
  function link(id){if(!bookmarks.some(b=>b.id===id))throw Error('书签不存在。');const base=window.__bookmarkCompanionLinkBase;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base||''))throw Error('链接服务尚未连接，请重新运行助手启动器。');return base+'/b/'+id;}
  async function copyLink(id){const value=link(id);await navigator.clipboard.writeText(value);note('已复制链接。保持助手运行，即可从其他地方打开。');return value;}
  function message(b){return [...document.querySelectorAll(SELECTOR)].find(e=>{if(!e.getBoundingClientRect().width)return false;const cloud=e.hasAttribute('data-chatgpt-selection-message-id'),source=cloud?e.dataset.chatgptSelectionConversationId:e.getAttribute('data-response-annotation-conversation'),mid=cloud?e.dataset.chatgptSelectionMessageId:e.getAttribute('data-response-annotation-target');return branch.resolveId(source)===branch.resolveId(b.sourceId)&&mid===b.messageId;});}
  function rangeIn(source,b){
    const text=source.textContent,quote=b.quote;let start=b.start;
    const context=i=>(!b.prefix||text.slice(Math.max(0,i-b.prefix.length),i)===b.prefix)&&(!b.suffix||text.slice(i+quote.length,i+quote.length+b.suffix.length)===b.suffix);
    if(text.slice(start,start+quote.length)!==quote||!context(start)){const found=[];for(let i=text.indexOf(quote);i!==-1;i=text.indexOf(quote,i+1))found.push(i);const exact=found.filter(context);if(exact.length===1)start=exact[0];else if(found.length===1)start=found[0];else return null;}
    const walker=document.createTreeWalker(source,NodeFilter.SHOW_TEXT),range=document.createRange();let offset=0,started=false,node;while(node=walker.nextNode()){const end=offset+node.length;if(!started&&start>=offset&&start<end){range.setStart(node,start-offset);started=true;}if(started&&start+quote.length<=end){range.setEnd(node,start+quote.length-offset);return range;}offset=end;}return null;
  }
  function scroller(el){for(let p=el?.parentElement;p;p=p.parentElement){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight+10)return p;}return document.scrollingElement;}
  async function locate(b){
    const deadline=Date.now()+30000;let scroll=null,stalls=0,lastHeight=-1,lastTop=-1;
    while(!disposed&&!scanCancelled&&Date.now()<deadline){const el=message(b);if(el){const range=rangeIn(el,b);if(!range)throw Error('找到消息，但原文已变化或位置不唯一，未跳到其他段落。');return range;}
      if(!scroll?.isConnected){const seed=[...document.querySelectorAll(SELECTOR)].find(e=>e.getBoundingClientRect().width);scroll=scroller(seed);}
      if(scroll){const same=scroll.scrollTop===lastTop&&scroll.scrollHeight===lastHeight;stalls=same?stalls+1:0;lastTop=scroll.scrollTop;lastHeight=scroll.scrollHeight;const step=Math.max(200,scroll.clientHeight*.7);scroll.scrollTop=Math.max(0,scroll.scrollTop-step);scroll.dispatchEvent(new Event('scroll',{bubbles:true}));if(stalls>=12)break;}
      await delay(200);
    }throw Error(scanCancelled?'已取消定位。':'未加载到目标消息。请确认聊天仍可访问；超长历史可能需要手动加载后重试。');
  }
  async function jump(id){const b=bookmarks.find(b=>b.id===id);if(!b)throw Error('书签不存在。');if(busy)throw Error('正在定位另一个书签，请稍后再试。');busy=true;scanCancelled=false;render();note('正在打开聊天并定位原文…',{cancel:true});
    try{await branch.jump(b.sourceId,null,b.kind);if(scanCancelled||disposed)throw Error('已取消定位。');const range=await locate(b);if(disposed||scanCancelled)throw Error('已取消定位。');const preview=formattedRange(range);if(preview!==b.previewHTML){b.previewHTML=preview;save();}const start=range.startContainer.parentElement;start.scrollIntoView({block:'center',behavior:'instant'});await delay(80);const box=range.getBoundingClientRect(),scroll=scroller(start);if(scroll&&box.height<innerHeight)scroll.scrollTop+=box.top-(innerHeight-box.height)/2;
      await delay(60);if(disposed||scanCancelled)throw Error('已取消定位。');clearHighlight();if(CSS.highlights&&typeof Highlight==='function'){CSS.highlights.set('companion-bookmark',new Highlight(range));highlightTimer=setTimeout(clearHighlight,1000);}else{const selection=getSelection();selection.removeAllRanges();selection.addRange(range);highlightTimer=setTimeout(()=>{if(selection.rangeCount===1&&selection.getRangeAt(0)===range)selection.removeAllRanges();},1000);}
      note('已定位到书签原文。');return {ok:true,id,sourceId:b.sourceId,messageId:b.messageId,quoteMatched:true};
    }catch(e){note(e.message);throw e;}finally{busy=false;render();}
  }
  const highlightStyle=document.createElement('style');highlightStyle.id='bookmark-companion-highlight';highlightStyle.textContent='::highlight(companion-bookmark){background:#ffe08acc;color:inherit}';document.head.append(highlightStyle);
  function capture(){const a=branch.captureAnchor();selected=a||null;return a;}
  function removeMenu(){menuButton?.remove();menuButton=null;}
  function selectionChanged(){
    if(busy)return;if(branch.isSelecting){floating.hidden=true;removeMenu();return;}const s=getSelection();if(!s||s.isCollapsed){floating.hidden=true;removeMenu();return;}const a=capture();if(!a){floating.hidden=true;removeMenu();return;}
    const menu=branch.selectionMenu?.();
    if(menu){
      floating.hidden=true;
      if(menuButton?.parentElement!==menu){
        removeMenu();const b=document.createElement('button'),sample=menu.querySelector('[data-branch-companion="menu"]')||menu.querySelector('button'),style=getComputedStyle(sample||menu);
        b.dataset.bookmarkCompanion='menu';b.className=sample?.className||'';b.title='保存选中文字的位置，之后可跨聊天跳回原文';b.setAttribute('aria-label','添加书签');
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');svg.innerHTML='<path d="M5 3h10v14l-5-3-5 3V3Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>';b.append(svg,document.createTextNode('添加书签'));
        for(const prop of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color','padding','borderRadius'])b.style[prop]=style[prop];
        b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{try{add();}catch(e){note(e.message);}};menu.append(b);menuButton=b;
      }
      return;
    }
    removeMenu();const range=s.getRangeAt(0),box=range.getBoundingClientRect();if(!box.width||box.bottom<0||box.top>innerHeight){floating.hidden=true;return;}
    floating.hidden=false;const bounds=floating.getBoundingClientRect();floating.style.left=Math.max(8,Math.min(innerWidth-bounds.width-8,box.left))+'px';floating.style.top=Math.max(65,box.top-bounds.height-10)+'px';
  }
  const menuStyle=document.createElement('style');menuStyle.id='bookmark-companion-menu-style';menuStyle.textContent='button[data-bookmark-companion="menu"]{cursor:pointer;white-space:nowrap;border:0;border-left:1px solid #8885;background-color:transparent;transition:background-color 90ms ease;display:inline-flex;align-items:center;gap:5px}button[data-bookmark-companion="menu"]:hover{background-color:var(--bc-hover,#8882)}button[data-bookmark-companion="menu"]:active{background-color:var(--bc-pressed,#8884)}button[data-bookmark-companion="menu"]:focus-visible{outline:2px solid currentColor;outline-offset:-2px}button[data-bookmark-companion="menu"] svg{width:14px;height:14px;flex:none}';document.head.append(menuStyle);
  const fallbackStyle=document.createElement('style');fallbackStyle.textContent='.floating:hover,.floating:active{background:var(--bg);box-shadow:0 6px 22px #0003,inset 0 0 0 999px var(--hover)}';root.append(fallbackStyle);
  const richStyle=document.createElement('style');richStyle.textContent='.quote.rich{display:block;line-height:1.8;max-height:5.4em;overflow:hidden;white-space:normal}.rich p,.rich div{margin:0}.rich h1,.rich h2,.rich h3,.rich h4,.rich h5,.rich h6{font:inherit;font-weight:600;margin:0}.rich math{font-family:"Cambria Math","STIX Two Math",serif;font-size:1.12em}.rich math[display="block"]{display:block;math-style:compact;margin:.15em 0}.rich code,.rich pre{font-family:ui-monospace,Consolas,monospace;font-size:.92em;white-space:pre-wrap}.rich code{background:var(--hover);border-radius:3px;padding:0 3px}.rich ul,.rich ol{padding-left:18px;margin:0}.rich table{border-collapse:collapse}.rich th,.rich td{padding:1px 4px;border:1px solid var(--line)}';root.append(richStyle);
  let menuFrame=0;
  const menuObserver=new MutationObserver(()=>{if(!menuFrame&&!disposed)menuFrame=requestAnimationFrame(()=>{menuFrame=0;selectionChanged();});});menuObserver.observe(document.body,{childList:true,subtree:true});
  on($('.toggle'),'click',()=>show());on($('.close'),'click',()=>show(false));on($('.search'),'input',e=>{query=e.target.value;render();});on($('.undo'),'click',undo);on($('.cancel'),'click',()=>{scanCancelled=true;});on(floating,'pointerdown',e=>e.preventDefault());on(floating,'click',()=>{try{add();}catch(e){note(e.message);}});
  on(document,'selectionchange',selectionChanged);on(document,'pointerup',e=>{if(e.composedPath().includes(host))return;setTimeout(()=>{if(!disposed)selectionChanged();},210);});on(window,'scroll',()=>{floating.hidden=true;},true);on(window,'wheel',clearHighlight,{capture:true,passive:true});on(window,'touchmove',clearHighlight,{capture:true,passive:true});on(document,'keydown',clearHighlight,true);on(document,'pointerdown',e=>{clearHighlight();if(!e.composedPath().includes(host))floating.hidden=true;},true);
  on(window,'resize',scheduleLayout);
  const api={version:'0.5.0',add,capture,jump,show,remove,undo,link,copyLink,rangeIn,layoutDock,safePreview,formattedRange,storageError:()=>note('书签文件保存失败，请检查助手连接窗口。'),get bookmarks(){return JSON.parse(JSON.stringify(bookmarks));},get busy(){return busy;},dispose(){disposed=true;scanCancelled=true;clearTimeout(highlightTimer);clearTimeout(noticeTimer);cancelAnimationFrame(layoutFrame);cancelAnimationFrame(menuFrame);menuObserver.disconnect();removeMenu();menuStyle.remove();dockResize.disconnect();dockMutation.disconnect();viewMutation.disconnect();if(branchPanel){branchPanel.style.maxHeight='';branchPanel.style.top='';}if(branchToggle)branchToggle.style.top='';removers.forEach(f=>f());CSS.highlights?.delete('companion-bookmark');highlightStyle.remove();host.remove();if(window.__bookmarkCompanion===api)delete window.__bookmarkCompanion;}};
  window.__bookmarkCompanion=api;for(const b of bookmarks)if(!b.previewHTML){const preview=enrich(b);if(preview)b.previewHTML=preview;}save();show(window.__bookmarkCompanionPanelOpen===true);return {installed:true,bookmarks:bookmarks.length,version:api.version};
})()
