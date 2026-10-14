import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.BASE_URL || 'https://pan-narrate.vercel.app/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const app=await browser.newPage();
const print=await browser.newPage();
const intro='The introduction gives an overview of receptor binding and computational analysis.';
const methods='Molecular dynamics simulations show changes in contact patterns and hydrogen bonding across time.';
const discussion='The discussion summarizes the main results and their implications for experimental validation.';
const conclusion='Further experiments will be necessary to examine the predicted binding effects.';
await app.addInitScript(()=>{
  window.__freeSpoken=[];
  const natural={name:'Microsoft Aria Online (Natural)',lang:'en-US',voiceURI:'edge-natural-aria',default:true};
  class Utterance {constructor(text){this.text=text;this.rate=1;this.pitch=1;}}
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
    getVoices:()=>[natural],addEventListener:()=>{},removeEventListener:()=>{},
    cancel:()=>{},pause:()=>{},resume:()=>{},
    speak(u){
      window.__freeSpoken.push(u.text);
      // Simulate speech events: validates UI transitions and page sequence without making paid TTS calls.
      setTimeout(()=>{u.onstart?.();setTimeout(()=>u.onend?.(),25);},10);
    },
    get speaking(){return false;},get paused(){return false;}
  }});
});
try {
 await print.setContent(`<style>
   @page{size:A4;margin:0}
   body{margin:0;font:18px Arial,sans-serif}
   section{height:970px;box-sizing:border-box;padding:65px 60px;break-after:page}
   p{line-height:1.5;margin:20px 0}
 </style>
 <section><h1>Introduction</h1><p>${intro}</p><p>${methods}</p></section>
 <section><h1>Discussion</h1><p>${discussion}</p><p>${conclusion}</p></section>`);
 const pdf=await print.pdf({format:'A4',printBackground:true});
 await app.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
 await app.locator('input[type="file"][accept*="pdf"]').first().setInputFiles({name:'full-page-qa.pdf',mimeType:'application/pdf',buffer:pdf});
 await app.locator('.fullpage').waitFor({state:'visible',timeout:40000});
 const firstText=await app.locator('.fullpage').innerText();
 assert.match(firstText,/The introduction gives an overview/);
 assert.match(firstText,/Molecular dynamics simulations show changes/);
 assert.doesNotMatch(firstText,/PASSAGE [0-9]+/i);
 assert.equal(await app.getByLabel('Neural engine').inputValue(),'browser');
 await app.getByRole('button',{name:'Read full page'}).click();
 await app.waitForFunction(()=>window.__freeSpoken?.join(' ').includes('hydrogen bonding'),{timeout:12000});
 const spoken=await app.evaluate(()=>window.__freeSpoken.join(' '));
 assert.ok(spoken.includes(intro),'first paragraph absent from speech');
 assert.ok(spoken.includes(methods),'second paragraph absent from speech');
 console.log('FREE_FULL_PAGE_PASSED:',spoken.length,'characters of free narration; no Puter API used');
 await app.getByRole('button',{name:'Next page',exact:true}).click();
 await app.locator('.fullpage').getByText(discussion,{exact:false}).waitFor({timeout:15000});
 const secondText=await app.locator('.fullpage').innerText();
 assert.match(secondText,/Further experiments will be necessary/);
 console.log('PAGE_NAVIGATION_PASSED: all second-page paragraphs visible');
} catch(error){console.error('PAGE_SMOKE_FAILED:',error.message);process.exitCode=1;}
finally{await browser.close();}
