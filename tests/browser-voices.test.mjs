import test from 'node:test';
import assert from 'node:assert/strict';
import { englishVoices, selectedBrowserVoice } from '../src/browser-voices.js';
const voices=[
 {name:'Microsoft David',lang:'en-US',voiceURI:'david',default:true},
 {name:'Microsoft Aria Online (Natural)',lang:'en-US',voiceURI:'aria',default:false},
 {name:'French voice',lang:'fr-FR',voiceURI:'french'},
 {name:'Microsoft undefined Online (Natural) - undefined',lang:'en-US',voiceURI:'broken'}
];
test('prefer online natural voice, ignore broken and non-English voices',()=>{
 const sorted=englishVoices(voices);
 assert.equal(sorted[0].name,'Microsoft Aria Online (Natural)');
 assert.equal(sorted.length,2);
});
test('user-selected voice respected',()=>{
 assert.equal(selectedBrowserVoice(voices,'david').name,'Microsoft David');
 assert.equal(selectedBrowserVoice(voices,'aria').name,'Microsoft Aria Online (Natural)');
});
