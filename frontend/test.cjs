const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.setViewport({ width: 1400, height: 900 });

  console.log('Navigating to page...');
  await page.goto('http://localhost:5173/data-collection', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));

  console.log('=== Page loaded ===');

  // Get body content length
  const content = await page.content();
  console.log('Page content length:', content.length);

  // Check for app div
  const appDiv = await page.evaluate(() => {
    const app = document.getElementById('app');
    return app ? app.innerHTML.length : 0;
  });
  console.log('App div content length:', appDiv);

  // Get all elements
  const elements = await page.evaluate(() => document.querySelectorAll('*').length);
  console.log('Total elements:', elements);

  await browser.close();
})();
