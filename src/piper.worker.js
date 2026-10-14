// Low-latency neural narration with Piper TTS, executed off the main UI thread.
// Models are cached to the browser origin's private file system.
let piperPromise = null;
const DEFAULT_VOICE = 'en_US-hfc_female-medium';
function status(message) { self.postMessage({type:'stage',message}); }
async function getPiper() {
  if (!piperPromise) {
    status('Loading fast neural speech engine…');
    piperPromise = import('@mintplex-labs/piper-tts-web').catch(e=>{
      piperPromise=null;throw e;
    });
  }
  return piperPromise;
}
self.onmessage=async event=>{
  const {id,type,text,voice}=event.data || {};
  if(type!=='generate' || typeof id!=='number')return;
  try{
    if(!text?.trim())throw new Error('No text for narration.');
    const piper=await getPiper();
    status('Loading fast voice model (first run downloads and caches it)…');
    const output=await piper.predict({text,voiceId:voice||DEFAULT_VOICE}, progress=>{
      const total=Number(progress.total)||0;
      const loaded=Number(progress.loaded)||0;
      if(total>0)status('Downloading fast voice model: '+Math.round(loaded/total*100)+'%');
      else status('Downloading fast voice model…');
    });
    if(!(output instanceof Blob)||output.size<=44)throw new Error('Fast neural voice returned no audio.');
    status('Preparing playable audio…');
    const wav=await output.arrayBuffer();
    self.postMessage({type:'result',id,wav},[wav]);
  }catch(error){
    self.postMessage({type:'error',id,message:error?.message||String(error)});
  }
};
