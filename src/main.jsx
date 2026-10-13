import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, UploadCloud, FileText, Headphones, Sparkles, Settings2, ChevronLeft, ChevronRight, Play, Pause, Square, SkipForward, SkipBack, CheckCircle2, AlertCircle, Loader2, Mic2, Download, Volume2, ExternalLink, X, Link2, ScanText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Client, handle_file } from '@gradio/client';
import { parsePdf, renderPdfPage } from './pdf';
import './style.css';

const pretty = s => s?.length > 200 ? s.slice(0,200)+'…' : s;
const DEFAULT_SPACE=import.meta.env.VITE_HF_SPACE_ID || '';

const KOKORO_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
function splitNarration(text, maxChars = 260) {
  const result = [];
  let chunk = '';
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    if ((chunk + ' ' + word).length > maxChars && chunk) {
      result.push(chunk);
      chunk = '';
    }
    if (word.length > maxChars) {
      for (let offset = 0; offset < word.length; offset += maxChars) {
        const part = word.slice(offset, offset + maxChars);
        if (chunk) { result.push(chunk); chunk = ''; }
        result.push(part);
      }
      continue;
    }
    chunk = chunk ? chunk + ' ' + word : word;
  }
  if (chunk) result.push(chunk);
  return result;
}
function pcmToWav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const label = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  label(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
  label(8, 'WAVE'); label(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); label(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, value < 0 ? Math.round(value * 32768) : Math.round(value * 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
async function generateBrowserSpeech(tts, text, voice) {
  const chunks = splitNarration(text);
  const buffers = [];
  let size = 0, rate = 24000;
  for (const chunk of chunks) {
    const audio = await tts.generate(chunk, { voice });
    const data = audio.data instanceof Float32Array ? audio.data : new Float32Array(audio.data);
    rate = audio.sampling_rate || rate;
    buffers.push(data);
    size += data.length;
  }
  const all = new Float32Array(size);
  let cursor = 0;
  for (const part of buffers) { all.set(part, cursor); cursor += part.length; }
  return pcmToWav(all, rate);
}

function App(){
  const [file,setFile]=useState(null),[data,setData]=useState(null),[page,setPage]=useState(1),[progress,setProgress]=useState(0),[parsing,setParsing]=useState(false),[error,setError]=useState('');
  const [active,setActive]=useState(null),[audioSrc,setAudioSrc]=useState(''),[playing,setPlaying]=useState(false),[generating,setGenerating]=useState(false),[queue,setQueue]=useState(false);
  const [language,setLanguage]=useState('en'),[mode,setMode]=useState('literature'),[speed,setSpeed]=useState(1),[skipRefs,setSkipRefs]=useState(true),[reference,setReference]=useState(null),[consent,setConsent]=useState(false);
  const [space,setSpace]=useState(()=>localStorage.getItem('pannarrate-space') || DEFAULT_SPACE),[editSpace,setEditSpace]=useState(false),[side,setSide]=useState(true),[voiceError,setVoiceError]=useState('');
  const [docScale,setDocScale]=useState(1.25),[viewport,setViewport]=useState(null);
  const [voicePreset,setVoicePreset]=useState('af_heart');
  const canvas=useRef(null), audio=useRef(null), input=useRef(null), abort=useRef(0), client=useRef(null), audioUrl=useRef(''), localModel=useRef(null);
  const reader = data?.segments ?? [];
  const filtered=useMemo(()=>reader.filter(s=>!skipRefs || mode==='proofread' || !/^(references|bibliography|works cited)\s*$/i.test(s.text)),[reader,skipRefs,mode]);
  const selected=reader.find(s=>s.id===active);
  const onFile=async f=>{ if(!f)return; setError('');setVoiceError('');setParsing(true);setData(null);setFile(f);setActive(null);setPage(1);setProgress(0);stopAudio();try {const d=await parsePdf(f,setProgress);setData(d);if(!d.segments.length)setError('No embedded text found. This PDF may be scanned; OCR support is planned.');}catch(e){setError(e.message || 'Unable to parse this PDF.');}finally{setParsing(false)} };
  const stopAudio=()=>{abort.current++;if(audio.current){audio.current.pause();audio.current.removeAttribute('src');audio.current.load();}if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current='';}setAudioSrc('');setPlaying(false);setQueue(false);setGenerating(false)};
  useEffect(()=>()=>{abort.current++;if(audioUrl.current)URL.revokeObjectURL(audioUrl.current)},[]);
  useEffect(()=>{let gone=false;if(!data||!canvas.current)return;renderPdfPage(data.doc,page,canvas.current,docScale).then(v=>{if(!gone)setViewport(v)}).catch(e=>setError('PDF render: '+e.message));return ()=>{gone=true}},[data,page,docScale]);
  useEffect(()=>{if(audio.current)audio.current.playbackRate=speed},[speed,audioSrc]);
  const changeSpace=e=>{let v=e.trim().replace(/^https:\/\/huggingface\.co\/spaces\//,'').replace(/^https:\/\//,'').replace(/\/$/,'');setSpace(v);localStorage.setItem('pannarrate-space',v);client.current=null;};
  const select=(s)=>{if(!s)return;stopAudio();setActive(s.id);setPage(s.page);};
  async function speak(s,autoplay=true){
    if (!s) return;
    const needsCloud = language !== 'en' || Boolean(reference);
    if (needsCloud && !space) {
      setVoiceError(language !== 'en'
        ? 'Kiswahili neural voice is not available in the local CPU engine yet. A separate multilingual voice service is required.'
        : 'Personal voice cloning needs an external neural voice service. Local Kokoro provides preset voices only.');
      return;
    }
    if (reference && !consent) { setVoiceError('Confirm you own this voice or have permission to clone it.'); return; }
    const token=++abort.current;
    setGenerating(true);setVoiceError('');setPlaying(false);
    try {
      let url;
      if (!needsCloud) {
        if (!localModel.current) {
          const { KokoroTTS } = await import('kokoro-js');
          if (token !== abort.current) return;
          localModel.current = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
            device: 'wasm',
            dtype: 'q8'
          });
        }
        if (token !== abort.current) return;
        const blob = await generateBrowserSpeech(localModel.current, s.text, voicePreset);
        if (token !== abort.current) return;
        if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
        url = URL.createObjectURL(blob);
        audioUrl.current = url;
      } else {
        const cl = client.current || await Client.connect(space);
        if(token !== abort.current)return;
        client.current=cl;
        const args={text:s.text.slice(0,500),language,reference: reference ? handle_file(reference): null,consent:reference ? consent : false};
        const result=await cl.predict('/narrate',args);
        if(token !== abort.current)return;
        const output=result?.data?.[0];
        url=typeof output==='string'?output:output?.url || output?.path;
        if(!url)throw new Error('Voice Space did not return an audio file. Check the Space logs.');
      }
      setAudioSrc(url);setActive(s.id);setPage(s.page);
      if(autoplay)setPlaying(true);
    }catch(e){
      if(token===abort.current){setVoiceError(e.message || String(e));setQueue(false);}
    }finally{if(token===abort.current)setGenerating(false)}
  }
  useEffect(()=>{if(audio.current&&audioSrc&&playing){audio.current.play().catch(()=>setPlaying(false))}},[audioSrc]);
  const togglePlay=()=>{if(!audioSrc){speak(selected||filtered[0]);return;}if(audio.current?.paused){audio.current.play().then(()=>setPlaying(true)).catch(e=>setVoiceError(e.message))}else{audio.current?.pause();setPlaying(false)}};
  const step=(delta)=>{const ix=filtered.findIndex(s=>s.id===active);const next=filtered[Math.max(0,Math.min(filtered.length-1,ix+delta))];if(next){select(next);speak(next)}};
  const ended=()=>{setPlaying(false);if(queue){const ix=filtered.findIndex(s=>s.id===active);const next=filtered[ix+1];if(next){speak(next)}else setQueue(false)}};
  const onDrop=e=>{e.preventDefault();onFile(e.dataTransfer.files?.[0])};
  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brandmark"><Headphones size={20}/></span><div><strong>PanNarrate</strong><small>SCIENTIFIC AUDIO READER</small></div></div><div className="topright"><span className="status"><span className={`dot ${space?'connected':'idle'}`}></span>{language==='en'&&!reference?'English neural voice · On-device CPU':space?'External voice endpoint set':'External voice not connected'}</span><button className="ghost" onClick={()=>setEditSpace(v=>!v)}><Settings2 size={17}/> <span>Voice engine</span></button><a className="github" target="_blank" rel="noreferrer" href="https://github.com/peterDataScientia/PanNarrate">GitHub <ExternalLink size={14}/></a></div></header>
    {editSpace&&<div className="settingpane"><div><strong>Neural voice engines</strong><p>English runs on your browser CPU with Kokoro, without a GPU, API key or account. The model downloads on first use, which may take time. External Hugging Face Space is optional and only for features such as Kiswahili or personal voice cloning, if a compatible server is available. PDFs stay local for text extraction.</p></div><div className="settinginputs"><input aria-label="Hugging Face Space ID" placeholder="your-hf-username/PanNarrate-Voice" value={space} onChange={e=>changeSpace(e.target.value)}/><button onClick={()=>setEditSpace(false)}>Save</button></div></div>}
    <div className="content">
     <aside className={`sidebar ${side?'':'closed'}`}><div className="sideinner"><div className="sideheading"><span>WORKSPACE</span><button className="iconbtn" title="Collapse sidebar" onClick={()=>setSide(false)}><PanelLeftClose size={17}/></button></div><button className="navitem selected"><BookOpen size={17}/> Document reader</button><div className="navgroup">YOUR DOCUMENT</div>{file?<div className="filechip"><FileText size={19}/><div><b>{file.name}</b><small>{data?.pageCount||'…'} pages</small></div><button title="Remove document" className="iconbtn" onClick={()=>{stopAudio();setFile(null);setData(null);setActive(null)}}><X size={15}/></button></div>:<div className="sidebarhint">Upload a PDF to begin reading.</div>}
       <div className="sidebarend"><span className="tinyicon"><Sparkles size={16}/></span><div><b>Built for researchers</b><p>Published papers · Manuscripts · Theses</p></div></div></div></aside>
     <main className="main">
      {!side&&<button className="showSide iconbtn" title="Show sidebar" onClick={()=>setSide(true)}><PanelLeftOpen size={19}/></button>}
      {!file&&!parsing?<div className="welcome"><div className="eyebrow">YOUR RESEARCH, OUT LOUD</div><h1>Give your papers<br/><em>a voice.</em></h1><p className="heroText">A focused workspace to read, review and listen to scientific documents. Your original PDF stays visible as you work.</p><div className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={onDrop} onClick={()=>input.current?.click()} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&input.current?.click()}><span className="uploadicon"><UploadCloud size={26}/></span><strong>Drop a research paper or manuscript here</strong><span>or click to browse your files</span><small>PDF only · Up to 35 MB · processed locally for text extraction</small></div><div className="benefits"><div><FileText size={18}/> Two-column aware extraction</div><div><Headphones size={18}/> English neural voice · no GPU</div><div><Mic2 size={18}/> Cloning needs an external engine</div></div></div>:
      <div className="readerlayout">
       <section className="pdfpanel"><div className="panehead"><div className="panelname"><FileText size={17}/><b>Document</b><span>{file?.name}</span></div><div className="tools"><span className="pager"><button aria-label="Previous page" onClick={()=>setPage(v=>Math.max(1,v-1))} disabled={page<=1}><ChevronLeft size={16}/></button>{page} / {data?.pageCount||'…'}<button aria-label="Next page" disabled={!data||page>=data.pageCount} onClick={()=>setPage(v=>Math.min(data.pageCount,v+1))}><ChevronRight size={16}/></button></span><select value={docScale} onChange={e=>setDocScale(Number(e.target.value))} aria-label="Zoom"><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></div></div>
         {parsing?<div className="loadpage"><Loader2 className="spin" size={34}/><b>Reading document structure…</b><span>{Math.round(progress*100)}%</span></div>:<div className="pdfscroll"><div className="pdfsheet" style={{width:viewport?.width}}><canvas ref={canvas} aria-label={`PDF page ${page}`}/>{selected?.page===page&&viewport&&<div className="pdfhighlights" style={{width:viewport.width,height:viewport.height}}>{selected.rects.map((r,i)=><div key={i} className="highlight" style={{left:r.x*docScale,top:r.top*docScale,width:r.width*docScale,height:r.height*docScale}}/>)}</div>}</div></div>}
       </section>
       <section className="transcript"><div className="panehead"><div className="panelname"><ScanText size={17}/><b>Reading text</b></div><span className="itemcount">{data?.segments.length||0} passages</span></div>
         <div className="readingmode"><button className={mode==='literature'?'active':''} onClick={()=>setMode('literature')}>Literature</button><button className={mode==='proofread'?'active':''} onClick={()=>{setMode('proofread');setSkipRefs(false)}}>Manuscript review</button></div><div className="readingoptions"><label><input type="checkbox" checked={skipRefs} onChange={e=>setSkipRefs(e.target.checked)}/> Skip reference heading</label><span>{data?.twoColPages||0} two-column pages detected</span></div>
         {error&&<div className="warn"><AlertCircle size={16}/>{error}</div>}
         <div className="transcriptbody">{reader.length?reader.map((s,i)=><button key={s.id} className={`passage ${active===s.id?'current':''}`} onClick={()=>select(s)}><span className="passagemeta">PAGE {s.page} · PASSAGE {i+1}</span><span>{pretty(s.text)}</span>{active===s.id&&<span className="readingtag"><Volume2 size={12}/> Selected</span>}</button>):<div className="emptytext">Extracted text will appear here. Click any passage to read it aloud.</div>}</div>
       </section>
      </div>}
      <input type="file" ref={input} accept=".pdf,application/pdf" hidden onChange={e=>onFile(e.target.files?.[0])}/>
     </main>
    </div>
    <footer className="player"><div className="now"><div className="wavebox"><Headphones size={20}/></div><div><b>{file?file.name:'No document loaded'}</b><small>{selected?`Page ${selected.page} · ${selected.text.slice(0,65)}`:'Choose a passage to start listening'}</small></div></div>
      <div className="playermain"><div className="transport"><button title="Previous passage" disabled={!reader.length||generating} onClick={()=>step(-1)}><SkipBack size={18}/></button><button className="play" title="Play / Pause" disabled={!reader.length||generating} onClick={togglePlay}>{generating?<Loader2 className="spin" size={21}/>:playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button><button title="Next passage" disabled={!reader.length||generating} onClick={()=>step(1)}><SkipForward size={18}/></button><button title="Stop" onClick={stopAudio}><Square size={14}/></button></div><div className="audioarea"><audio ref={audio} src={audioSrc||undefined} onEnded={ended} onPause={()=>setPlaying(false)} onPlay={()=>setPlaying(true)} controls={!!audioSrc}/><label className="autoplay"><input type="checkbox" checked={queue} onChange={e=>setQueue(e.target.checked)}/> Continue reading</label></div></div>
      <div className="playeropts"><select aria-label="Voice language" value={language} onChange={e=>{stopAudio();setLanguage(e.target.value)}}><option value="en">English</option><option value="sw">Kiswahili (external engine)</option></select>{language==='en'&&!reference&&<select aria-label="Narrator voice" value={voicePreset} onChange={e=>{stopAudio();setVoicePreset(e.target.value)}}><option value="af_heart">American · Heart</option><option value="af_bella">American · Bella</option><option value="am_michael">American · Michael</option><option value="bf_emma">British · Emma</option><option value="bm_george">British · George</option></select>}<select value={speed} aria-label="Playback speed" onChange={e=>setSpeed(Number(e.target.value))}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>{audioSrc&&<a href={audioSrc} target="_blank" rel="noreferrer" title="Open audio"><Download size={18}/></a>}</div>
    </footer>
    <div className="voicebar"><span><Mic2 size={16}/> Voice cloning requires external engine</span><input type="file" accept="audio/*" onChange={e=>{setReference(e.target.files?.[0]||null);stopAudio()}}/><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I own this voice or have explicit permission to clone it</label>{voiceError&&<span className="errortext"><AlertCircle size={15}/>{voiceError}</span>}</div>
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);
