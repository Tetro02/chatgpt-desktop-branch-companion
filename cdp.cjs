class CDP {
  static async connect(port=19347) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const t = targets.find(t=>t.type==='page' && t.url==='app://-/index.html');
    if (!t) throw Error('ChatGPT page not found');
    return CDP.target(t.webSocketDebuggerUrl);
  }
  static async target(url) {
    const c = new CDP(); c.socket = new WebSocket(url); c.pending=new Map();c.seq=0;
    await new Promise((r,j)=>{c.socket.onopen=r;c.socket.onerror=j;});
    c.socket.onmessage = e=>{const m=JSON.parse(e.data);if(c.pending.has(m.id)){c.pending.get(m.id)(m);c.pending.delete(m.id);}else if(m.method)c.onEvent?.(m.method,m.params);};
    return c;
  }
  call(method,params={}) {
    const id=++this.seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`Timeout ${method}`));},method==='Runtime.evaluate'?45000:15000);
      this.pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);});
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  async eval(expression) {
    const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;
  }
  close(){this.socket.close();}
}
module.exports=CDP;
if(require.main===module) (async()=>{const fs=require('node:fs');const c=await CDP.connect(Number(process.env.PROBE_PORT||19347));try{console.log(JSON.stringify(await c.eval(fs.readFileSync(process.argv[2],'utf8')),null,2));}finally{c.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
