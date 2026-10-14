// Page-first reading data. PDF's paragraph segmentation is only internal layout metadata.
export function buildPageReadings(data, skipReferenceHeadings=false) {
  if (!data) return [];
  const pages=Array.from({length:data.pageCount},(_,index)=>({
    id:'page-'+(index+1),page:index+1,text:'',paragraphs:[],rects:[]
  }));
  for(const segment of data.segments || []) {
    const page=pages[segment.page-1];
    if(!page || !segment.text?.trim()) continue;
    if(skipReferenceHeadings && /^(references|bibliography|works cited)\s*$/i.test(segment.text.trim()))continue;
    page.paragraphs.push(segment.text.trim());
    page.rects.push(...(segment.rects || []));
  }
  for(const page of pages)page.text=page.paragraphs.join(' ').replace(/\s+/g,' ').trim();
  return pages;
}

// The user reads a PAGE, never an isolated segment. Chunking here is an
// invisible transport accommodation for provider limits (Puter: <3000 chars).
// Prefer sentence endings when close to the limit, but preserve ALL words/order.
export function splitNarration(text, maxChars=2800) {
  const cleaned=(text || '').replace(/\s+/g,' ').trim();
  if(!cleaned)return [];
  const words=cleaned.split(' ');
  const parts=[];
  let current='';
  for(const word of words){
    if(word.length>maxChars){
      if(current){parts.push(current);current='';}
      for(let i=0;i<word.length;i+=maxChars)parts.push(word.slice(i,i+maxChars));
      continue;
    }
    const candidate=current ? current+' '+word : word;
    if(candidate.length<=maxChars){current=candidate;continue;}
    // Split at a natural sentence end if the boundary is not too far back.
    const match=[...current.matchAll(/[.!?][\u201d\u2019"')\]]*(?=\s|$)/g)].at(-1);
    const cut=match ? match.index+match[0].length : -1;
    if(cut>maxChars*0.58){
      parts.push(current.slice(0,cut).trim());
      current=(current.slice(cut).trim()+' '+word).trim();
    }else{
      parts.push(current);
      current=word;
    }
  }
  if(current)parts.push(current);
  return parts;
}
