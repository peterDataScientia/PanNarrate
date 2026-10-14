import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOUD_VOICE_PROFILES, DEFAULT_CLOUD_VOICE, cloudVoiceOptions } from '../src/cloud-voices.js';

test('default narrator is expressive OpenAI TTS, not basic Joanna',()=>{
  assert.equal(DEFAULT_CLOUD_VOICE,'openai-marin');
  const settings=cloudVoiceOptions();
  assert.equal(settings.provider,'openai');
  assert.equal(settings.model,'gpt-4o-mini-tts');
  assert.equal(settings.voice,'marin');
  assert.match(settings.instructions,/scientific/i);
  assert.match(settings.instructions,/natural/i);
});
test('every available cloud profile has supported provider and model options',()=>{
 for(const p of CLOUD_VOICE_PROFILES){
  const args=cloudVoiceOptions(p.id);
  assert.equal(args.provider,p.provider);
  assert.ok(args.voice);
  if(args.provider==='openai')assert.equal(args.model,'gpt-4o-mini-tts');
  if(args.provider==='elevenlabs')assert.equal(args.model,'eleven_multilingual_v2');
 }
});
test('unrecognized voice IDs are refused, not accidentally billed',()=>{
 assert.throws(()=>cloudVoiceOptions('unknown-voice'),/Unknown cloud voice/);
});
