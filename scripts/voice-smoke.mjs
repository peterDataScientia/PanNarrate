import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const started = Date.now();
let popups = 0;
const errors = [];
page.on('popup', popup => {
  popups++;
  console.log('AUTH/POPUP:', popup.url());
});
page.on('pageerror', error => {
  errors.push(error.message);
  console.log('PAGE ERROR:', error.message);
});

try {
  await page.goto('https://pan-narrate.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.getByRole('button', { name: /voice engine/i }).click();
  const selection = await page.getByLabel('Neural engine').inputValue();
  console.log('Selected voice engine:', selection);
  if (selection !== 'cloud') throw new Error('Hosted cloud engine is not selected as default');
  await page.getByRole('button', { name: 'Test English neural voice' }).click();
  let state = 'timeout';
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(1000);
    const read = await page.evaluate(() => ({
      error: document.querySelector('.errortext')?.innerText || '',
      stage: document.querySelector('.now small')?.innerText || '',
      audio: (() => {
        const a = document.querySelector('audio');
        return a ? { src: Boolean(a.src), duration: Number.isFinite(a.duration) ? a.duration : null, readyState: a.readyState } : null;
      })()
    }));
    if (i % 5 === 0) console.log('PROGRESS', i, JSON.stringify(read));
    if (read.error) { state = 'error'; console.log('TTS_ERROR:', read.error); break; }
    if (read.audio?.duration > 0) {
      console.log('TTS_PLAYABLE:', JSON.stringify(read.audio), 'elapsedSeconds:', (Date.now()-started)/1000);
      state = 'playable';
      break;
    }
    if (popups) { state = 'authentication_popup'; console.log('TTS_AUTH_REQUIRED: Puter showed a separate authentication popup'); break; }
  }
  console.log('VOICE_SMOKE_RESULT:', state, 'elapsedSeconds:', (Date.now()-started)/1000, 'popups:', popups, 'pageErrors:', JSON.stringify(errors));
  if (state !== 'playable') process.exitCode = 1;
} catch(error) {
  console.error('VOICE_SMOKE_FATAL:', error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
