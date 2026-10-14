// Runs Kokoro neural TTS outside the UI thread. The browser CPU is sufficient.
let modelPromise = null;
const modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX';
async function getModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      self.postMessage({type: 'stage', message: 'Loading neural speech engine…'});
      const { KokoroTTS } = await import('kokoro-js');
      return await KokoroTTS.from_pretrained(modelId, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (p) => {
          if (p.status === 'progress' && typeof p.progress === 'number') {
            self.postMessage({type: 'stage', message: 'Downloading AI model: ' + Math.round(p.progress) + '% (' + (p.file || 'model') + ')'});
          } else if (p.status === 'initiate') {
            self.postMessage({type: 'stage', message: 'Fetching ' + (p.file || 'speech model') + '…'});
          } else if (p.status === 'done') {
            self.postMessage({type: 'stage', message: 'Preparing neural voice…'});
          }
        }
      });
    })().catch(error => { modelPromise = null; throw error; });
  }
  return modelPromise;
}
self.onmessage = async (event) => {
  const {id, type, text, voice} = event.data || {};
  if (type !== 'generate' || typeof id !== 'number') return;
  try {
    if (!text || !text.trim()) throw Error('No text to read.');
    const tts = await getModel();
    self.postMessage({type: 'stage', message: 'Synthesizing speech on your CPU…'});
    const audio = await tts.generate(text, {voice: voice || 'af_heart'});
    // Use RawAudio's supported WAV serializer: its data layout is internal
    // to transformers.js and should not be guessed or reinterpreted here.
    const wavBlob = await audio.toBlob();
    if (!wavBlob || wavBlob.size <= 44) {
      const count = audio?.data?.length ?? 0;
      throw Error('Neural inference produced no waveform (' + count + ' PCM samples). Try another voice or check the browser runtime.');
    }
    const wav = await wavBlob.arrayBuffer();
    self.postMessage({type: 'result', id, wav}, [wav]);
  } catch (error) {
    self.postMessage({type: 'error', id, message: String(error?.message || error)});
  }
};
