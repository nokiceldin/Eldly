/** Compare the worker's cached entry bundle with the bundle this tab actually loaded. */
export function hasNewShell(worker:ServiceWorker|null,loaded:string|null):Promise<boolean>{
 if(!worker?.postMessage||!loaded||typeof MessageChannel==='undefined')return Promise.resolve(false);
 return new Promise(resolve=>{
  const channel=new MessageChannel();let done=false;
  const finish=(result:boolean)=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(result);};
  const timer=setTimeout(()=>finish(false),2000);
  channel.port1.onmessage=e=>finish(typeof e.data?.asset==='string'&&e.data.asset!==loaded);
  try{worker.postMessage({type:'myspace-shell-version'},[channel.port2]);}catch{finish(false);}
 });
}
