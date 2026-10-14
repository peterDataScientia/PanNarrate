import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.BASE_URL || 'https://pan-narrate.vercel.app/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
let popups=0;
page.on('popup',()=>{popups++;});
page.on('pageerror',e=>console.log('PAGE ERROR:',e.message));
await page.addInitScript(()=>{
  window.__freeSpoken=[];
  const natural={name:'Microsoft Aria Online (Natural)',lang:'en-US',voiceURI:'edge-natural-aria',default:true};
  class Utterance {constructor(text){this.text=text;this.rate=1;this.pitch=1;}}
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    getVoices:()=>[natural],
    addEventListener:()=>{},removeEventListener:()=>{},
    cancel:()=>{},pause:()=>{},resume:()=>{},
    speak(u){
      window.__freeSpoken.push({text:u.text,voice:u.voice?.name,rate:u.rate});
      Promise.resolve().then(()=>{u.onstart?.();u.onend?.();});
    },
    get speaking(){return false;},get paused(){return false;}
  }});
});
try {
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 await page.getByRole('button',{name:/voice engine/i}).click();
 assert.equal(await page.getByLabel('Neural engine').inputValue(),'browser');
 const choices=await page.getByLabel('Free voice').innerText();
 assert.match(choices,/Aria Online \(Natural\)/);
 await page.getByRole('button',{name:'Preview selected voice'}).click();
 await page.waitForFunction(()=>window.__freeSpoken?.length>0,{timeout:12000});
 const spoken=await page.evaluate(()=>window.__freeSpoken);
 assert.match(spoken[0].text,/molecular dynamics/i);
 assert.match(spoken[0].voice,/Aria Online \(Natural\)/);
 assert.equal(popups,0,'Free preview must not open Puter auth');
 console.log('FREE_PREVIEW_PASSED:',spoken.length,'utterances; zero cloud sign-in or credit requests');
 await page.getByLabel('Neural engine').selectOption('cloud');
 await page.getByRole('button',{name:'Preview selected voice'}).click();
 const warn=await page.locator('.errortext').innerText({timeout:5000});
 assert.match(warn,/metered credits/i);
 assert.equal(popups,0,'Cloud without explicit credit opt-in must not open login');
 console.log('CLOUD_CHARGES_BLOCKED:',warn);
} catch(error){console.error('VOICE_SMOKE_FAILED:',error.message);process.exitCode=1;}
finally{await browser.close();}
