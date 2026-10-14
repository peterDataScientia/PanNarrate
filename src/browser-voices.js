// Browser-native speech is free of PanNarrate/Puter API charges.
// In Microsoft Edge, Online (Natural) neural voices may be available.
export function englishVoices(voices) {
  return (voices||[]).filter(v=>/^en(?:[-_]|$)/i.test(v.lang||'') && !/undefined/i.test(v.name||''))
    .sort((a,b)=>scoreVoice(b)-scoreVoice(a)||a.name.localeCompare(b.name));
}
export function scoreVoice(voice) {
  const name=(voice?.name||'').toLowerCase();
  if(name.includes('online') && name.includes('natural'))return 100;
  if(name.includes('neural')||name.includes('natural'))return 80;
  if(name.includes('google') && name.includes('us english'))return 40;
  if(name.includes('microsoft'))return 30;
  if(name.includes('google'))return 20;
  return voice?.default?10:1;
}
export function selectedBrowserVoice(voices, preferred='') {
  const ranked=englishVoices(voices);
  return ranked.find(v=>v.voiceURI===preferred) || ranked.find(v=>v.name===preferred) || ranked[0] || null;
}
