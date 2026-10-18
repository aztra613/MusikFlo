import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function generateOgImage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1, // Exact 1200x630 pixels
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px;
      height: 630px;
      overflow: hidden;
      background: #FAF8F5;
      font-family: 'Manrope', -apple-system, sans-serif;
      color: #1A2724;
      display: flex;
      position: relative;
    }

    /* Subtle background texture: delicate staff lines and warm accents */
    .bg-staff {
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.35;
    }

    .ambient-glow {
      position: absolute;
      top: -120px;
      right: -80px;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(223, 238, 232, 0.7) 0%, rgba(250, 248, 245, 0) 70%);
      pointer-events: none;
    }

    .ambient-gold {
      position: absolute;
      bottom: -100px;
      left: 100px;
      width: 500px;
      height: 400px;
      background: radial-gradient(circle, rgba(246, 236, 218, 0.6) 0%, rgba(250, 248, 245, 0) 70%);
      pointer-events: none;
    }

    /* Left Section: Brand & Messaging */
    .left-col {
      width: 550px;
      height: 100%;
      padding: 56px 0 56px 64px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      z-index: 10;
    }

    .brand-header {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .logo-row {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #236D63;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(35, 109, 99, 0.25);
    }

    .brand-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #162421;
    }

    .pill-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: #DFEEE8;
      border: 1px solid rgba(35, 109, 99, 0.25);
      color: #1A5A52;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.2px;
      width: fit-content;
    }

    .pill-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #C78E3B;
    }

    .headline-block {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 4px;
    }

    .headline {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 54px;
      line-height: 1.05;
      font-weight: 700;
      color: #121E1B;
      letter-spacing: -1px;
    }

    .headline span.accent {
      color: #236D63;
      font-style: italic;
    }

    .subheadline {
      font-size: 18px;
      font-weight: 700;
      color: #236D63;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    .description {
      font-size: 16px;
      line-height: 1.5;
      color: #4D605B;
      font-weight: 500;
    }

    .feature-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag {
      padding: 6px 12px;
      border-radius: 8px;
      background: #FFFFFF;
      border: 1px solid #DCE3DF;
      color: #263834;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .tag svg {
      color: #236D63;
    }

    /* Right Section: Elevated App Mockup */
    .right-col {
      flex: 1;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 48px;
      padding-left: 20px;
      z-index: 10;
    }

    .mockup-window {
      width: 580px;
      background: #FFFFFF;
      border-radius: 16px;
      border: 1px solid #D5DDD8;
      box-shadow: 0 24px 60px -8px rgba(20, 36, 32, 0.14), 0 4px 16px rgba(20, 36, 32, 0.06);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .window-titlebar {
      height: 42px;
      background: #F4F6F4;
      border-bottom: 1px solid #DFE5E1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
    }

    .window-dots {
      display: flex;
      gap: 6px;
    }

    .window-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .dot-close { background: #E56860; }
    .dot-min { background: #F3B344; }
    .dot-max { background: #57C064; }

    .window-doc-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #556863;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-playing {
      padding: 2px 8px;
      border-radius: 9999px;
      background: #DFEEE8;
      color: #1A5A52;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .status-playing .live-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #236D63;
    }

    /* Score Paper Area */
    .score-paper {
      background: #FFFDF9;
      padding: 20px 24px 16px 24px;
      position: relative;
    }

    .score-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .bar-pill {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1A5A52;
      background: #EDF5F2;
      padding: 3px 10px;
      border-radius: 6px;
      border: 1px solid #D2E4DC;
    }

    .tool-active-pill {
      font-size: 11px;
      font-weight: 600;
      color: #637671;
      display: flex;
      gap: 12px;
    }

    .tool-active-pill span.active {
      color: #236D63;
      font-weight: 700;
    }

    /* SVG Staff Canvas */
    .stave-container {
      width: 100%;
      height: 155px;
      position: relative;
    }

    /* Bottom Transport Bar inside window */
    .transport-bar {
      height: 56px;
      background: #FAFBFA;
      border-top: 1px solid #DFE5E1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 18px;
    }

    .transport-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .play-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #236D63;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(35, 109, 99, 0.3);
    }

    .tempo-readout {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 600;
      color: #2D3E3A;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .instrument-pill {
      padding: 4px 10px;
      border-radius: 8px;
      background: #FFFFFF;
      border: 1px solid #D6DED9;
      font-size: 12px;
      font-weight: 600;
      color: #1A2724;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .instrument-pill .brass-star {
      color: #C78E3B;
    }
  </style>
</head>
<body>

  <!-- Ambient staff lines pattern in background -->
  <svg class="bg-staff" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="pat-staff" width="300" height="110" patternUnits="userSpaceOnUse">
        <line x1="0" y1="20" x2="300" y2="20" stroke="#CCD6D0" stroke-width="0.8" />
        <line x1="0" y1="30" x2="300" y2="30" stroke="#CCD6D0" stroke-width="0.8" />
        <line x1="0" y1="40" x2="300" y2="40" stroke="#CCD6D0" stroke-width="0.8" />
        <line x1="0" y1="50" x2="300" y2="50" stroke="#CCD6D0" stroke-width="0.8" />
        <line x1="0" y1="60" x2="300" y2="60" stroke="#CCD6D0" stroke-width="0.8" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#pat-staff)" />
  </svg>

  <div class="ambient-glow"></div>
  <div class="ambient-gold"></div>

  <!-- Left Column: Branding and Editorial Value -->
  <div class="left-col">
    <div class="brand-header">
      <div class="logo-row">
        <div class="brand-mark">
          <!-- MusikFlo exact BrandMark SVG -->
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <line x1="3" y1="7" x2="21" y2="7" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" />
            <line x1="3" y1="12" x2="21" y2="12" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" />
            <line x1="3" y1="17" x2="21" y2="17" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" />
            <ellipse cx="10" cy="12" rx="3.2" ry="2.3" transform="rotate(-20 10 12)" fill="#FFFFFF" />
            <line x1="12.5" y1="11" x2="12.5" y2="3.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>
        <span class="brand-title">MusikFlo</span>
      </div>

      <div class="pill-badge">
        <span class="dot"></span>
        <span>Free · Zero-Login · In-Browser Studio</span>
      </div>
    </div>

    <div class="headline-block">
      <h1 class="headline">
        Sheet Music <br>
        <span class="accent">Studio & Composer</span>
      </h1>
      <p class="subheadline">Create · Transcribe · Edit · Play · Share</p>
      <p class="description">Your music, your way — right in your browser. Compose visually on a real staff with instant playback and neural audio transcription.</p>
    </div>

    <div class="feature-tags">
      <div class="tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        <span>Live Synthesis</span>
      </div>
      <div class="tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
        <span>Audio to Score</span>
      </div>
      <div class="tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span>PDF & MIDI</span>
      </div>
    </div>
  </div>

  <!-- Right Column: Genuine Studio Window Mockup -->
  <div class="right-col">
    <div class="mockup-window">
      <!-- Title Bar -->
      <div class="window-titlebar">
        <div class="window-dots">
          <div class="window-dot dot-close"></div>
          <div class="window-dot dot-min"></div>
          <div class="window-dot dot-max"></div>
        </div>
        <div class="window-doc-title">
          <span>Ode to Joy — Beethoven</span>
        </div>
        <div class="status-playing">
          <span class="live-dot"></span>
          <span>PLAYING</span>
        </div>
      </div>

      <!-- Score Workspace -->
      <div class="score-paper">
        <div class="score-header-bar">
          <span class="bar-pill">Line 1 · Bars 1–2</span>
          <div class="tool-active-pill">
            <span class="active">✏️ Note (Quarter)</span>
            <span>4/4 Time</span>
            <span>C Major</span>
          </div>
        </div>

        <!-- Stave Render with authentic notation -->
        <div class="stave-container">
          <svg width="100%" height="150" viewBox="0 0 532 150">
            <!-- Stave Lines -->
            <line x1="16" y1="36" x2="516" y2="36" stroke="#9EABA4" stroke-width="1.2" />
            <line x1="16" y1="48" x2="516" y2="48" stroke="#9EABA4" stroke-width="1.2" />
            <line x1="16" y1="60" x2="516" y2="60" stroke="#9EABA4" stroke-width="1.2" />
            <line x1="16" y1="72" x2="516" y2="72" stroke="#9EABA4" stroke-width="1.2" />
            <line x1="16" y1="84" x2="516" y2="84" stroke="#9EABA4" stroke-width="1.2" />

            <!-- Start Barline & Middle Barline & End Barline -->
            <line x1="16" y1="36" x2="16" y2="84" stroke="#1E2B28" stroke-width="1.6" />
            <line x1="266" y1="36" x2="266" y2="84" stroke="#4B5E59" stroke-width="1.4" />
            <line x1="516" y1="36" x2="516" y2="84" stroke="#1E2B28" stroke-width="1.6" />

            <!-- Treble Clef Graphic -->
            <g transform="translate(24, 22) scale(0.65)">
              <path d="M19.5 73.2c-1.3-.8-2.1-2.4-2.1-4.1 0-2.8 2.2-5 5-5 2.5 0 4.5 1.8 4.9 4.2.8 4.2-2.1 8.2-6.3 8.8-1.5.2-1.5.2-1.5-3.9v-4.1l1.1.5c1.4.6 2.4 2 2.4 3.5 0 2-1.6 3.6-3.5 3.6-1.5 0-2.8-1-3.3-2.4-.4-1.2-.2-2.8.6-4.1 1.5-2.5 4.8-4.2 7.7-4.2 4.6 0 8.3 3.4 8.7 8 .3 3.6-1.4 7.2-4.4 9.1-2.6 1.7-6 2.1-8.7 1.1-3.6-1.3-6.1-4.7-6.2-8.5-.1-4.5 2.5-8.8 6.5-10.7 2.1-1 4.5-1.4 6.8-1.1l.9.1.5-2.2c1.7-7.8 3.5-15.6 5.2-23.4.6-2.8 1.2-5.7 1.8-8.5.5-2.4.9-4.8 1.4-7.2.3-1.6.6-3.2.9-4.8.4-2.1.8-4.3 1.2-6.4.5-2.6.9-5.2 1.4-7.8.3-1.6.6-3.2.9-4.8.2-1.1.5-2.2.7-3.3.3-1.4.5-2.8.8-4.2.2-1.1.4-2.2.6-3.3.4-2 .8-4 1.2-6 .5-2.4.9-4.8 1.4-7.2.3-1.6.6-3.2.9-4.8.4-2.1.8-4.2 1.2-6.3.3-1.6.6-3.2.9-4.8.3-1.6.6-3.2.9-4.8.2-1.1.4-2.2.6-3.3.3-1.6.6-3.2.9-4.8" fill="none"/>
              <!-- Elegant Treble Clef Path -->
              <text x="0" y="76" font-family="'Instrument Serif', serif" font-size="78" font-weight="bold" fill="#1C2B27">𝄞</text>
            </g>

            <!-- Time Signature 4/4 -->
            <text x="64" y="58" font-family="'Manrope', sans-serif" font-weight="800" font-size="20" fill="#1C2B27">4</text>
            <text x="64" y="80" font-family="'Manrope', sans-serif" font-weight="800" font-size="20" fill="#1C2B27">4</text>

            <!-- Measure 1 Notes: E4, E4, F4, G4 (Ode to Joy) -->
            <!-- Note 1: E4 (line 4 = 84px) -->
            <g transform="translate(105, 0)">
              <ellipse cx="10" cy="84" rx="6.5" ry="4.5" transform="rotate(-20 10 84)" fill="#1C2B27" />
              <line x1="16" y1="84" x2="16" y2="44" stroke="#1C2B27" stroke-width="1.8" />
            </g>
            <!-- Note 2: E4 -->
            <g transform="translate(145, 0)">
              <ellipse cx="10" cy="84" rx="6.5" ry="4.5" transform="rotate(-20 10 84)" fill="#1C2B27" />
              <line x1="16" y1="84" x2="16" y2="44" stroke="#1C2B27" stroke-width="1.8" />
            </g>
            <!-- Note 3: F4 (space 3 = 78px) -->
            <g transform="translate(185, 0)">
              <ellipse cx="10" cy="78" rx="6.5" ry="4.5" transform="rotate(-20 10 78)" fill="#1C2B27" />
              <line x1="16" y1="78" x2="16" y2="38" stroke="#1C2B27" stroke-width="1.8" />
            </g>
            <!-- Note 4: G4 (line 3 = 72px) -->
            <g transform="translate(225, 0)">
              <ellipse cx="10" cy="72" rx="6.5" ry="4.5" transform="rotate(-20 10 72)" fill="#1C2B27" />
              <line x1="16" y1="72" x2="16" y2="32" stroke="#1C2B27" stroke-width="1.8" />
            </g>

            <!-- Playhead Box highlight over active note in Bar 2 -->
            <rect x="335" y="24" width="36" height="74" rx="6" fill="rgba(35, 109, 99, 0.12)" stroke="#236D63" stroke-width="1.5" stroke-dasharray="3 2" />

            <!-- Measure 2 Notes: G4, F4, E4, D4 -->
            <!-- Note 5: G4 (72px) -->
            <g transform="translate(295, 0)">
              <ellipse cx="10" cy="72" rx="6.5" ry="4.5" transform="rotate(-20 10 72)" fill="#1C2B27" />
              <line x1="16" y1="72" x2="16" y2="32" stroke="#1C2B27" stroke-width="1.8" />
            </g>
            <!-- Note 6: F4 (78px - active playing!) -->
            <g transform="translate(340, 0)">
              <ellipse cx="10" cy="78" rx="6.8" ry="4.8" transform="rotate(-20 10 78)" fill="#236D63" />
              <line x1="16" y1="78" x2="16" y2="38" stroke="#236D63" stroke-width="2.2" />
              <circle cx="10" cy="78" r="9" fill="none" stroke="#236D63" stroke-width="1" opacity="0.6" />
            </g>
            <!-- Note 7: E4 (84px) -->
            <g transform="translate(385, 0)">
              <ellipse cx="10" cy="84" rx="6.5" ry="4.5" transform="rotate(-20 10 84)" fill="#1C2B27" />
              <line x1="16" y1="84" x2="16" y2="44" stroke="#1C2B27" stroke-width="1.8" />
            </g>
            <!-- Note 8: D4 (space below line 4 = 90px) -->
            <g transform="translate(430, 0)">
              <ellipse cx="10" cy="90" rx="6.5" ry="4.5" transform="rotate(-20 10 90)" fill="#1C2B27" />
              <line x1="16" y1="90" x2="16" y2="50" stroke="#1C2B27" stroke-width="1.8" />
            </g>

            <!-- Subtle Bar indicators -->
            <text x="165" y="112" font-family="'Manrope', sans-serif" font-weight="600" font-size="11" fill="#758A84">Bar 1</text>
            <text x="385" y="112" font-family="'Manrope', sans-serif" font-weight="700" font-size="11" fill="#236D63">Bar 2 (Active)</text>
          </svg>
        </div>
      </div>

      <!-- Transport Bar -->
      <div class="transport-bar">
        <div class="transport-controls">
          <div class="play-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
          </div>
          <div class="tempo-readout">
            <span style="color:#7D918B">BAR</span>
            <span style="color:#1B2C28">2</span>
            <span style="color:#CBD5D0">·</span>
            <span style="color:#7D918B">BPM</span>
            <span style="color:#1B2C28">112</span>
          </div>
        </div>

        <div class="instrument-pill">
          <span class="brass-star">★</span>
          <span>Grand Piano</span>
        </div>
      </div>
    </div>
  </div>

</body>
</html>
`;

  await page.setContent(html);
  await page.waitForTimeout(600); // Allow web fonts to render crisply

  // 1. Primary PNG
  await page.screenshot({ path: 'public/og-image.png', type: 'png' });
  // 2. High-performance JPEG under 200KB for WhatsApp
  await page.screenshot({ path: 'public/og-image.jpg', type: 'jpeg', quality: 86 });
  // 3. Descriptive named files as requested in Phase 5
  await page.screenshot({ path: 'public/musikflo-og.png', type: 'png' });
  await page.screenshot({ path: 'public/musikflo-og.jpg', type: 'jpeg', quality: 86 });

  await browser.close();

  const pngStats = fs.statSync('public/og-image.png');
  const jpgStats = fs.statSync('public/og-image.jpg');
  console.log('✓ Successfully created OG images:');
  console.log('  public/og-image.png:', (pngStats.size / 1024).toFixed(1), 'KB');
  console.log('  public/og-image.jpg:', (jpgStats.size / 1024).toFixed(1), 'KB');
  console.log('  public/musikflo-og.png');
  console.log('  public/musikflo-og.jpg');
}

generateOgImage().catch(console.error);
