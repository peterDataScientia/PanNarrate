import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
let popupUrl='';
page.on('popup', popup=>{popupUrl=popup.url();console.log('LOGIN POPUP:',popupUrl);});
page.on('pageerror',err=>console.log('PAGE ERROR:',err.message));
try {
  await page.goto('https://pan-narrate.vercel.app/',{waitUntil:'domcontentloaded',timeout:40000});
  await page.getByRole('button',{name:/voice engine/i}).click();
  const engine=await page.getByLabel('Neural engine').inputValue();
  if(engine!=='cloud')throw new Error('Expected Cloud neural as default, received: '+engine);
  await page.getByRole('button',{name:'Test English neural voice'}).click();
  const warning=await page.locator('.errortext').innerText({timeout:8000});
  console.log('Before authentication:',warning);
  if(!warning.includes('One-time Cloud Voice connection required'))throw new Error('Missing explicit sign-in notice');
  const running=await page.getByRole('button',{name:'Test English neural voice'}).isDisabled();
  if(running)throw new Error('Play is still spinning instead of showing login requirement');
  await page.getByRole('button',{name:'Connect Cloud Voice · one time'}).click();
  await page.waitForTimeout(1200);
  if(!popupUrl.includes('puter.com/action/sign-in'))throw new Error('One-time Puter authentication popup was not opened');
  console.log('AUTH HANDSHAKE PASSED. Real speech is not tested: it requires an authenticated human account.');
} catch(error){
  console.error('VOICE_SMOKE_FAILED:',error.message);
  process.exitCode=1;
} finally {await browser.close();}
