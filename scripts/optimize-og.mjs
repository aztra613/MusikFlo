import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const rawPath = path.resolve('public/og-image.png');
  const buffer = fs.readFileSync(rawPath);
  const base64 = buffer.toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: 1200px; height: 630px; overflow: hidden; background: #0d1b1e; }
          img { width: 1200px; height: 630px; object-fit: cover; display: block; }
        </style>
      </head>
      <body>
        <img src="data:image/png;base64,${base64}" />
      </body>
    </html>
  `);

  await page.waitForTimeout(300);

  // JPEG is the universal standard for WhatsApp and Facebook Open Graph (< 200KB)
  await page.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 82 });

  await browser.close();

  const jpgSize = fs.statSync('public/og-image.jpg').size;
  console.log('Generated public/og-image.jpg:', (jpgSize / 1024).toFixed(1), 'KB');
}

main().catch(console.error);
