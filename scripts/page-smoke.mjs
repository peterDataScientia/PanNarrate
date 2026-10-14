import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({
 headless:true, args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']
});
const app=await browser.newPage();
const print=await browser.newPage();
const intro='The introduction gives an overview of receptor binding and computational analysis.';
const methods='Molecular dynamics simulations show changes in contact patterns and hydrogen bonding across time.';
const discussion='The discussion summarizes the main results and their implications for experimental validation.';
const conclusion='Further experiments will be necessary to examine the predicted binding effects.';
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
 await app.goto('https://pan-narrate.vercel.app/',{waitUntil:'domcontentloaded',timeout:45000});
 await app.locator('input[type="file"][accept*="pdf"]').first().setInputFiles({name:'full-page-qa.pdf',mimeType:'application/pdf',buffer:pdf});
 await app.locator('.fullpage').waitFor({state:'visible',timeout:50000});
 const firstText=await app.locator('.fullpage').innerText();
 console.log('First page transcript:',firstText.slice(0,500));
 assert.match(firstText,/The introduction gives an overview/);
 assert.match(firstText,/Molecular dynamics simulations show changes/);
 assert.doesNotMatch(firstText,/PASSAGE [0-9]+/i);
 await app.evaluate(()=>{
   const getAudio=()=>{
     const rate=8000,len=rate/4,buf=new ArrayBuffer(44+len*2),v=new DataView(buf);
     const str=(i,s)=>{for(let n=0;n<s.length;n++)v.setUint8(i+n,s.charCodeAt(n))};
     str(0,'RIFF');v.setUint32(4,36+len*2,true);str(8,'WAVE');str(12,'fmt ');
     v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
     v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);
     v.setUint16(32,2,true);v.setUint16(34,16,true);
     str(36,'data');v.setUint32(40,len*2,true);
     for(let i=0;i<len;i++)v.setInt16(44+i*2,Math.sin(2*Math.PI*440*i/rate)*5000,true);
     return new Audio(URL.createObjectURL(new Blob([buf],{type:'audio/wav'})));
   };
   window.__testVoiceCalls=[];
   window.puter={
     auth:{isSignedIn:()=>true},
     ai:{txt2speech:async (text,options)=>{
       window.__testVoiceCalls.push({text,options});
       return getAudio();
     }}
   };
 });
 await app.getByRole('button',{name:'Read full page'}).click();
 await app.waitForFunction(()=>window.__testVoiceCalls?.length>=1,{timeout:15000});
 const spoken=await app.evaluate(()=>window.__testVoiceCalls.map(v=>v.text).join(' '));
 console.log('Full page request characters:',spoken.length,'speech samples:',(await app.evaluate(()=>window.__testVoiceCalls)).length);
 const chosen=await app.evaluate(()=>window.__testVoiceCalls[0].options);
 assert.equal(chosen.provider,'openai');
 assert.equal(chosen.voice,'marin');
 assert.equal(chosen.model,'gpt-4o-mini-tts');
 assert.match(chosen.instructions,/academic/i);
 assert.ok(spoken.includes(intro),'did not read introduction');
 assert.ok(spoken.includes(methods),'did not read second paragraph');
 await app.getByRole('button',{name:'Next page',exact:true}).click();
 await app.locator('.fullpage').getByText(discussion,{exact:false}).waitFor({timeout:20000});
 const secondText=await app.locator('.fullpage').innerText();
 assert.match(secondText,/Further experiments will be necessary/);
 console.log('PAGE_SMOKE_PASSED: full page text, two paragraphs per page, full speech input and next page');
} catch(error) {
 console.error('PAGE_SMOKE_FAILED:',error.message);
 process.exitCode=1;
} finally {
 await browser.close();
}
