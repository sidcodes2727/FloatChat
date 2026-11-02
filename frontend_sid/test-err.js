const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  await page.goto('http://localhost:5173/First-react-app', {waitUntil: 'networkidle0'});
  const body = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT:", body);
  await browser.close();
})();
