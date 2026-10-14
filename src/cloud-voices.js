// Verified Puter text-to-speech providers and model/voice identifiers.
// Provider calls consume the signed-in listener's Puter allowance/credits.
export const CLOUD_VOICE_PROFILES = Object.freeze([
  {id:'openai-marin', label:'Marin · OpenAI · expressive', provider:'openai'},
  {id:'openai-cedar', label:'Cedar · OpenAI · deeper', provider:'openai'},
  {id:'openai-nova', label:'Nova · OpenAI · bright', provider:'openai'},
  {id:'eleven-rachel', label:'Rachel · ElevenLabs · natural', provider:'elevenlabs'},
  {id:'eleven-bella', label:'Bella · ElevenLabs · warm', provider:'elevenlabs'},
  {id:'polly-joanna', label:'Joanna · Polly · basic', provider:'aws-polly'}
]);
export const DEFAULT_CLOUD_VOICE = 'openai-marin';
const ACADEMIC_INSTRUCTIONS =
  'Read as a natural, engaging academic audiobook narrator. Use a warm, calm, conversational tone with smooth pacing, varied intonation and meaningful pauses at sentence boundaries. Clearly articulate scientific names, chemical terminology, abbreviations and numerical measurements. Avoid robotic cadence, exaggerated enthusiasm, and theatrical delivery. Do not add or omit words.';

export function cloudVoiceOptions(profileId=DEFAULT_CLOUD_VOICE) {
  switch(profileId) {
    case 'openai-marin':
      return {provider:'openai',model:'gpt-4o-mini-tts',voice:'marin',response_format:'mp3',instructions:ACADEMIC_INSTRUCTIONS};
    case 'openai-cedar':
      return {provider:'openai',model:'gpt-4o-mini-tts',voice:'cedar',response_format:'mp3',instructions:ACADEMIC_INSTRUCTIONS};
    case 'openai-nova':
      return {provider:'openai',model:'gpt-4o-mini-tts',voice:'nova',response_format:'mp3',instructions:ACADEMIC_INSTRUCTIONS};
    case 'eleven-rachel':
      return {provider:'elevenlabs',model:'eleven_multilingual_v2',voice:'21m00Tcm4TlvDq8ikWAM',output_format:'mp3_44100_128'};
    case 'eleven-bella':
      return {provider:'elevenlabs',model:'eleven_multilingual_v2',voice:'Bella',output_format:'mp3_44100_128'};
    case 'polly-joanna':
      return {provider:'aws-polly',engine:'neural',voice:'Joanna',language:'en-US'};
    default:
      throw new Error('Unknown cloud voice selection');
  }
}
export const ACADEMIC_VOICE_PREVIEW =
  'In this study, molecular dynamics simulations were performed over one hundred nanoseconds. Protein-ligand interactions remained stable, and hydrogen bonding contributed to the overall binding mechanism.';
