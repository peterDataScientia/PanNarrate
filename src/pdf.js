import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const tidy = (s) => s.replace(/\s+/g, ' ').trim();
function makeLines(items, width, height) {
  const textItems = items.filter(i => typeof i.str === 'string' && tidy(i.str).length && i.transform);
  const lines = [];
  for (const i of textItems) {
    const x = i.transform[4];
    const y = height - i.transform[5];
    if (!(x >= 0 && x <= width + 30 && y >= -20 && y <= height + 20)) continue;
    const fontHeight = Math.max(6, Math.abs(i.transform[3]) || i.height || 10);
    let line = lines.find(l => Math.abs(l.y - y) < Math.min(3, fontHeight * 0.28) && Math.abs(l.fontHeight - fontHeight) < fontHeight * 0.6);
    if (!line) { line = { x, y, fontHeight, spans: [], page: null }; lines.push(line); }
    line.spans.push({ text: i.str, x, width: i.width || i.str.length * fontHeight / 2 });
    line.x = Math.min(line.x, x);
  }
  return lines.map(l => {
    l.spans.sort((a,b) => a.x - b.x);
    let text = '';
    let last = null;
    for (const s of l.spans) {
      if (last && s.x - last > Math.max(1.5, l.fontHeight * .12) && !text.endsWith(' ') && !s.text.startsWith(' ')) text += ' ';
      text += s.text;
      last = s.x + s.width;
    }
    l.text = tidy(text);
    l.right = Math.max(...l.spans.map(s => s.x + s.width));
    l.top = Math.max(0, l.y - l.fontHeight);
    l.height = l.fontHeight * 1.32;
    delete l.spans;
    return l;
  }).filter(l => l.text.length);
}
function orderLines(lines, width) {
  // Two-column heuristic: use only short body lines on opposite sides to infer columns.
  // Title and full-width headings are placed before column text on their vertical band.
  const middle = width / 2;
  const left = lines.filter(l => l.x < middle - 28 && l.right < middle + 18 && l.text.length > 20);
  const right = lines.filter(l => l.x > middle - 26 && l.text.length > 20);
  const twoColumns = left.length >= 5 && right.length >= 5;
  if (!twoColumns) return { ordered: [...lines].sort((a,b) => a.y - b.y || a.x - b.x), columns: 1 };
  const isWide = l => l.x < middle - 28 && l.right > middle + 18;
  const wide = lines.filter(isWide).sort((a,b) => a.y-b.y);
  const col = lines.filter(l => !isWide(l));
  // Common article layout: full-width title/header followed by 2-column body.
  const topWide = wide.filter(l => l.y <= Math.min(...col.map(x => x.y)) + 12);
  const rest = [...col, ...wide.filter(l => !topWide.includes(l))];
  const ordered = [
    ...topWide,
    ...rest.filter(l => l.x < middle-5).sort((a,b)=>a.y-b.y),
    ...rest.filter(l => l.x >= middle-5).sort((a,b)=>a.y-b.y),
  ];
  return { ordered, columns: 2 };
}
function paragraphs(ordered, page, width) {
  // Stable paragraph chunks, not unreliable word-to-speech timestamps.
  const out = [];
  let current = null;
  for (const l of ordered) {
    const segment = { page, text: l.text, rects: [{ x: l.x, top: l.top, width: Math.max(1,l.right-l.x), height: l.height }] };
    if (!current) { current = segment; continue; }
    const previous = current.rects[current.rects.length-1];
    const yDistance = l.top - (previous.top + previous.height);
    const sameZone = Math.abs(l.x - previous.x) < width * .2;
    const canJoin = sameZone && yDistance > -6 && yDistance < l.fontHeight * 1.3 && current.text.length + l.text.length < 420;
    if (canJoin) {
      current.text += (current.text.endsWith('-') ? '' : ' ') + l.text;
      current.rects.push(segment.rects[0]);
    } else { out.push(current); current = segment; }
  }
  if (current) out.push(current);
  return out.filter(p=>p.text.length > 2);
}
export async function parsePdf(file, onProgress=()=>{}) {
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Please select a PDF document.');
  if (file.size > 35*1024*1024) throw new Error('PDF too large. Maximum is 35 MB.');
  const raw = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: raw }).promise;
  const segments = [];
  const pageInfo = [];
  let twoColPages=0;
  for (let page=1; page<=doc.numPages; page++) {
    const p = await doc.getPage(page);
    const vp = p.getViewport({scale:1});
    const text = await p.getTextContent();
    const lines = makeLines(text.items, vp.width, vp.height);
    const { ordered, columns } = orderLines(lines, vp.width);
    if(columns===2) twoColPages++;
    const units=paragraphs(ordered,page,vp.width).map((s,i)=>({...s,id:`${page}-${i}`}));
    segments.push(...units);
    pageInfo.push({page,width:vp.width,height:vp.height,columns,lines:lines.length});
    onProgress(page/doc.numPages);
  }
  return { doc, pageCount:doc.numPages, segments, pageInfo, twoColPages };
}
export async function renderPdfPage(doc, page, canvas, scale=1.45) {
  if(!doc || !canvas) return null;
  const p = await doc.getPage(page);
  const viewport = p.getViewport({scale});
  const ratio = Math.min(window.devicePixelRatio || 1,2);
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  await p.render({canvasContext:canvas.getContext('2d'),viewport,transform: ratio!==1 ? [ratio,0,0,ratio,0,0] : null}).promise;
  return viewport;
}
