import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageReadings, splitNarration } from '../src/reading.js';

test('full PDF page joins ALL paragraphs without truncating to one passage', () => {
  const data={
    pageCount:2,
    segments:[
      {page:1,id:'1-0',text:'Introduction. This study investigates molecular mechanisms.',rects:[{x:5}]},
      {page:1,id:'1-1',text:'Results. Receptor dynamics were stable after equilibration.',rects:[{x:6}]},
      {page:2,id:'2-0',text:'Discussion. These results require biological validation.',rects:[{x:7}]}
    ]
  };
  const pages=buildPageReadings(data);
  assert.equal(pages.length,2);
  assert.equal(pages[0].text,'Introduction. This study investigates molecular mechanisms. Results. Receptor dynamics were stable after equilibration.');
  assert.equal(pages[0].paragraphs.length,2);
  assert.equal(pages[0].rects.length,2);
  assert.match(pages[1].text,/biological validation/);
});

test('all 9000+ characters of one long page survive TTS splitting in order', () => {
  const text=Array.from({length:190},(_,i)=>'Study result '+i+' demonstrates molecular binding stability and supports our analysis.').join(' ');
  const result=splitNarration(text,2800);
  assert.ok(text.length>9000,'test is long enough');
  assert.ok(result.length>1);
  assert.ok(result.every(part=>part.length>0&&part.length<3000));
  assert.equal(result.join(' '),text);
});

test('a normal PDF page fits one single cloud request',()=>{
  const text='First sentence. Second sentence. Finally the conclusion.';
  assert.deepEqual(splitNarration(text,2800),[text]);
});

test('empty pages keep correct page numbers and no text',()=>{
 const pages=buildPageReadings({pageCount:3,segments:[{page:2,text:'Page two',rects:[]}]});
 assert.equal(pages[0].text,'');
 assert.equal(pages[1].page,2);
 assert.equal(pages[2].id,'page-3');
});
