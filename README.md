# MusikFlo — Sheet Music Studio & Composer

MusikFlo is a browser-based music notation studio. You place notes on a real staff, hear
them immediately with synthesised instruments, and export your work in standard formats.
There is no account, no login and no MusikFlo server: scores are stored in your own browser
and every export is generated on your device.

Product of **Aztras AI Tech Solutions, Chennai, India**. Version **v1.0**.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build and preview:

```bash
npm run build        # writes dist/
npm run preview      # serves dist/ locally
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Production build into `dist/` (copies the transcription model first) |
| `npm run preview` | Serve the production build |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` |
| `npm test` | Vitest unit and component suite |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:fixtures` | Regenerate the audio test fixtures (WAV + MP3) |
| `npm run test:e2e` | Playwright browser suite against the built app |
| `npm run clean` | Remove `dist/` |

`npm run test:e2e` expects a production build to exist (`npm run build`), because the
Playwright config serves `dist/` through `vite preview`. Install the browser once with
`npx playwright install chromium`.

---

## Technology

- **React 19 + TypeScript + Vite** — application shell and build.
- **VexFlow 5** — music engraving into SVG.
- **Tone.js** — synthesised playback (no sampled audio is shipped).
- **Tailwind CSS v4** — styling, driven by CSS custom properties.
- **Motion (`motion/react`)** — restrained landing-page animation.
- **jsPDF / midi-writer-js** — PDF and MIDI export.
- **Lucide** — icons.
- **Vitest** — unit/component tests; **Playwright** — browser tests.

## Architecture

```
src/
  App.tsx                  hash routing, theme, draft recovery
  routing/routes.ts        typed hash routes + footer link table
  content/legal.ts         legal page copy (Privacy … Security)
  editor/editorReducer.ts  score + bounded history + single selection model
  score/geometry.ts        shared layout, staff-line and pointer geometry
  score/renderScore.ts     one engraving routine, SVG and canvas backends
  audioTranscription/      audio-to-sheet-music feature (see its own section)
  utils/notationUtils.ts   pitch ↔ VexFlow staff line mapping
  utils/importValidation.ts runtime validation for imported projects
  components/              ScoreCanvas, NotationPalette, Inspector, TopBar,
                           ScoreSetupStrip, TransportDock, LandingPage,
                           LegalPage, TranscribePage, AudioToScoreFlow,
                           ScorePreview, Footer, BrandMark, HelpModal
  storage/db.ts            IndexedDB with localStorage fallback
  audio/audioEngine.ts     playback timeline + tick subscribers
  audio/instruments.ts     voice definitions shared by live + offline render
  export/exporter.ts       MIDI, MusicXML, WAV, PDF, .musikflo
scripts/
  copy-model.mjs           pins the transcription model into public/model
  make-audio-fixtures.mjs  synthesises the WAV/MP3 test fixtures
```

### Coordinate model

`src/score/geometry.ts` is the single source of truth for layout and interaction:

1. **Score space** — SVG user units. VexFlow renders here and reports event geometry here.
2. **Display space** — the score SVG declares `viewBox="0 0 W H"` and is displayed at
   `width = W * zoom`. The viewBox is the *only* scaling mechanism; there is no CSS
   transform and no second zoom factor.
3. **Pointer conversion** uses the SVG's inverse screen CTM (`getScreenCTM().inverse()`),
   never a manual division by the zoom level.
4. **Overlays** live in a wrapper sized exactly `W * zoom` × `H * zoom` and are placed at
   `scoreCoordinate * zoom`. The row that holds them is `min-w-full` + `w-max`, so a score
   wider than the viewport scrolls to its true origin instead of being clipped.

The same layout constants (`MEASURES_PER_ROW`, `MEASURE_WIDTH`, `STAVE_HEIGHT`) drive
rendering, hit-testing, measure headers and line duplication, so the drawn staff and the
interactive staff cannot drift apart.

Event hit boxes are centred on the notehead and expanded by a *screen-space* slop at hit
time, so the touch target stays the same size at every zoom level.

### Pitch mapping

`utils/notationUtils.ts` documents and implements VexFlow's stave line coordinate space:

- line `0` is the **top** staff line, line `4` the bottom line;
- `0.5` is one diatonic step, so spaces are fractional lines;
- treble: line 0 = F5, line 4 = E4, line 5 (first ledger below) = middle C;
- bass: line 0 = A3, line 4 = G2, line −1 (first ledger above) = middle C.

`getPitchFromLine` and `getLineFromPitch` are exact inverses and are tested for every staff
line, space and ledger position in both clefs. The pointer's pitch is derived from the
*clicked measure's own* stave geometry, so the same relative staff position maps to the same
pitch on every system.

---

## Using the studio

### Tools

| Tool | Behaviour |
| --- | --- |
| **Select** | Click a note or rest to edit it. Clicking empty staff does nothing. |
| **Note** | Click empty staff to place a note. Clicking an existing event selects it instead of stacking a note on top of it. |
| **Rest** | Click empty staff to place a rest. Clicking an existing event selects it. |
| **Eraser** | Click a note or rest to delete it. Clicking empty staff does nothing. |

Placing your first note is one click: choose **Note**, pick a value, click the staff.

### Rhythmic values, accidentals and modifiers

Whole, half, quarter, eighth and sixteenth values; sharp, flat and explicit natural; and a
dotted modifier (+50% duration).

### Instruments

Every voice is a synthesiser, not a recording. Each one is described once in
`src/audio/instruments.ts` as a `VoiceSpec` (oscillator partials, amplitude
envelope, filter sweep, optional breath noise, detune and vibrato), and both the
live Tone.js engine and the offline WAV renderer build their sound from that same
spec. That is deliberate: they used to be written separately, and the offline
renderer had no `guitar` branch at all, so guitar exported as a byte-identical
copy of the piano.

| Instrument | General MIDI | Character |
| --- | --- | --- |
| Concert Grand Piano | 1 | Hammered attack, long warm decay |
| Plucked Acoustic Guitar | 25 | Fast filter sweep, quick decay, slight detune |
| Warm Chamber Strings | 49 | Detuned bowed ensemble, slow swell, vibrato |
| Silver Concert Flute | 74 | Sine tone with breath air and light vibrato |
| Indian Bansuri | 73 | Hollow bamboo flute: more breath, wider vibrato |
| Reed Clarinet | 72 | Odd harmonics from a pulse wave |

### Keyboard

| Shortcut | Action |
| --- | --- |
| `Space` | Play / stop |
| `Del` / `Backspace` | Delete the selected note or rest |
| `↑` / `↓` | Step the selected pitch |
| `Esc` | Deselect |
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Shift + Z`, `Ctrl/⌘ + Y` | Redo |
| `Ctrl/⌘ + D` | Duplicate the selected bar to the next bar |
| `Ctrl/⌘ + C`, `Ctrl/⌘ + V` | Copy / paste the selected bar |

Shortcuts are ignored while you are typing in a text field or while a control or dialog has
focus, so `Backspace` never deletes music while renaming a score.

### Editing rules worth knowing

- A click determines the note's **pitch**; engraving then justifies notes across the bar, so
  an inserted note's horizontal position is decided by the formatter rather than by the exact
  click x. The insertion *order* follows the click.
- **Editing while playing stops playback.** This is deliberate: it guarantees the visual
  playhead can never point at an index that no longer exists.
- Deleting an event selects its neighbour when one exists, so repeated deletions flow.

---

## Audio to sheet music

Paste a short recording and get an editable score. Reachable from the landing page ("Convert audio to
sheet music") and from the studio top bar ("Transcribe audio"), which opens the same flow as an overlay so an
open composition is never unmounted.

The recording is decoded and analysed **entirely in the browser**. Its bytes are never uploaded, and there is
no transcription API or server component.

### How it works

```
src/audioTranscription/
  config.ts         limits, thresholds, model URL (all in one place)
  types.ts          result model, kept separate from the canonical Score
  audioDecode.ts    validate → decode (Web Audio) → mono + resample to 22.05 kHz
  modelRuntime.ts   lazy dynamic import of the runtime; cached model per tab
  transcribe.ts     orchestrates decode → inference → normalised events
  noteEvents.ts     sort/reject/normalise, overlap detection, melody reduction
  quantise.ts       rhythms → representable notation values → full measures
  scoreAdapter.ts   quantised plan → a brand-new canonical Score
```

Pipeline: **validate → decode → resample → lazy-load model → infer → normalise → quantise → adapt → review →
commit**. Inference output is never written into a project; it stays in a separate result model until the user
accepts it.

### The runtime

`@spotify/basic-pitch` **1.0.1** (Apache-2.0) with TensorFlow.js **3.21.0** (Apache-2.0) pinned through it. The
runtime is loaded with a dynamic `import()` only when a transcription starts, and the model is copied from the
pinned package into `public/model/` by `scripts/copy-model.mjs`, so it is served from this application and never
from a third-party CDN.

| Asset | Size |
| --- | --- |
| Transcription runtime chunk (TensorFlow.js + Basic Pitch) | 1.03 MB (257 KB gzip), lazy |
| `model.json` | 170 KB |
| `group1-shard1of1.bin` | 725 KB |

Both model files and the runtime chunk are well inside the Cloudflare Pages 25 MiB per-asset limit.

### Limits and measured behaviour

- 20 MiB source file and 60 seconds of decoded audio, configurable in `config.ts`. Both are checked before
  inference starts; file size alone is not treated as a memory estimate.
- Only one transcription runs at a time, and it can be cancelled. Cancellation stops the model's frame loop
  between frames, which is the only hook the runtime exposes.
- Measured in a production build on a **CPU-only backend** (headless Chromium, no GPU): a 2.4 s clip analysed in
  **18.6 s**, i.e. roughly 8x realtime; decode 2 ms, resample 36 ms, model load 440 ms. A GPU-accelerated browser
  is substantially faster. Clips over 20 s warn about this before starting rather than after.

### Accuracy, and what it deliberately does not do

Measured on the reference fixtures (`scripts/make-audio-fixtures.mjs`, original synthesised material):

| Fixture | Result |
| --- | --- |
| `melody.wav` — C4 D4 E4 G4 quarter notes at 100 BPM | 4 notes detected → `c4, d4, e4, g4`; tempo estimated 101 BPM |
| `melody.mp3` — the same melody, 128 kbps MP3 | identical output, proving the MP3 decode path |
| `chord.wav` — C4 + E4 + G4 sounding together | 3 notes detected, flagged as simultaneous, reduced to the highest (`g4`) only after an explicit choice |

- **Tempo** is estimated from the detected onsets, clamped to 40–240 BPM, and labelled as a suggestion.
- **Meter and key are never inferred.** The time signature is chosen by the user; MusikFlo does not claim meter
  inference from Basic Pitch.
- **Simultaneous notes are never flattened silently.** Overlaps are only reported as a chord when they are long
  enough to be one (≥150 ms and ≥30% of the shorter note), so a legato tail is not mislabelled. When they are
  real, the user chooses between melody reduction and keeping every detected note, the counts are shown, and the
  raw timings are always available as a MIDI download.
- **Rhythm is quantised** to the chosen grid, and every duration is one the score model can express exactly — the
  plan and the engraved score cannot disagree. Notes that would cross a barline are shortened and the number is
  reported; bars are completed with rests so the result passes the studio's own rhythmic validation.
- Audio is bounded by explicit limits, and the raw audio buffer, object URL and note events are released on
  cancel and on close. Nothing is persisted except an accepted score.

### Entry points, routes and data

- Route: `#transcribe` (direct refresh and browser back/forward work; the studio route is untouched).
- Accepted transcriptions always create a **new project id**. The composition already open is flushed to
  IndexedDB first and stays available from the new **Recent** menu, so nothing is lost.
- The studio top bar gained "Transcribe audio" and "Recent"; the narrow-screen toolbar carries both entry points
  when the top bar collapses.

---

## Theme and notation tokens

Themes are driven by CSS custom properties in `src/index.css` (`:root` for light, `.dark` for
dark) and mapped into Tailwind through `@theme`.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--paper` | `#FFFDF7` | `#151E1B` | score surface |
| `--staff-line` | `#C6CFC9` | `#84958B` | staff lines, ledger lines, barlines |
| `--notation-ink` | `#192522` | `#F2F5F0` | noteheads, stems, clefs, signatures |
| `--playhead` | `#187D6D` | `#8ADBC8` | sounding note and playhead |
| `--brass` | `#C78E3B` | `#E0B05D` | selected note |
| `--primary` | `#236D63` | `#83C9B8` | accents and placement preview |

The dark staff-line value was raised from `#46564F`, which sat too close to the dark paper and
made the staff read as invisible. `#84958B` against `#151E1B` is roughly 5.4:1.

VexFlow draws into SVG rather than using CSS classes, so theme colours are applied through the
VexFlow API in `ScoreCanvas`: the stave context stroke, every stave modifier, and the
ledger-line style are all set explicitly, because VexFlow's defaults include a hard-coded dark
stroke for staff lines and `#444` for ledger lines.

The footer uses a deliberate deep-ink surface (`--footer-*`) in both themes, including the
footer focus ring.

---

## Storage and privacy

- Scores are saved to **IndexedDB** (`musikflo_db` → `scores`, `metadata`) with a
  **localStorage** fallback (`musikflo_score_<id>`, `musikflo_latest_id`).
- `localStorage` also holds `musikflo_theme` and `musikflo_dismissed_hint`.
- Autosave is debounced (800 ms) off the editor revision. Failure is reported as a visible
  **"Could not save"** state rather than a false "Saved".
- Application code makes **no** network requests and sets **no** cookies. The page does load
  Manrope and Instrument Serif from Google Fonts, which are ordinary external requests.
- Locally stored scores are not encrypted, and clearing site data deletes them. Export a
  `.musikflo` backup for anything important.

Full detail is on the in-app **Privacy**, **Cookies** and **Security** pages.

Audio transcription follows the same rule: the recording is decoded and analysed in the page, its
bytes are never uploaded, and the resulting note events live only in memory until you accept them.
See the audio-to-sheet-music section above.

## Routes

Routing is hash-based, so the static build needs no SPA rewrite rules:

`#home`, `#studio`, `#transcribe`, `#privacy`, `#terms`, `#cookies`, `#disclaimer`, `#contact`,
`#licenses`, `#accessibility`, `#security`, plus the landing section anchors `#features`,
`#how-it-works`, `#instruments`, `#exports`.

Unknown fragments resolve to the landing page, so the rendered view can never disagree with
the URL. Deep links, refresh and back/forward all work on any static host.

## Exports

| Format | Notes |
| --- | --- |
| `.mid` | Pitches, tempo and durations. Rests are zero-velocity notes using velocity `'0'`, because midi-writer-js treats a numeric `0` as falsy and substitutes a *sounding* note. |
| `.musicxml` | MusicXML 3.1, including the selected key signature. |
| `.wav` | 16-bit 44.1 kHz stereo PCM, rendered offline from the score timeline. The voice comes from the same table the live engine uses, so the exported audio matches the selected instrument. |
| `.pdf` | Single-page printable manuscript. The score is re-engraved through the canvas backend of the shared renderer with a fixed print palette, so the glyphs are present and dark in either UI theme. |
| `.musikflo` | Full project JSON, re-openable on any device. |

Imports are validated against a runtime schema with size and range limits before they reach
the editor.

---

## Testing

```bash
npm run typecheck     # tsc --noEmit
npm test              # Vitest: unit + component
npm run build
npm run test:e2e      # Playwright: desktop + mobile, against dist/
```

Unit tests cover pitch mapping (every line, space and ledger position in both clefs, middle C,
inverse round-trips), shared layout and hit-test geometry, the editor reducer (history bounds,
no-op rejection, selection reconciliation), import validation, export output (MusicXML key
signatures; MIDI rest timing parsed back out of the file), storage behaviour including
total-failure reporting, and route/footer/legal rendering.

Browser tests exercise what a compiler cannot: which event a click selects, that clicking an
existing note never duplicates it, that the Select tool never inserts, eraser behaviour, visible
and keyboard deletion, undo/redo, middle C placement with its ledger label in both clefs,
identical pitch on every staff row, zoom and resize behaviour, dark-mode staff-line colour and
contrast, theme switching without altering the music, playhead behaviour, every footer route,
deep-link refresh, reduced-motion behaviour, and the responsive layout.

The browser tests read the score back out of IndexedDB, which verifies the persistence layer and
the editor state together without adding test-only markup to the application.

For audio-to-sheet-music the suite runs **real inference in the production build**: the model is
fetched from this application, the fixture is decoded (WAV and MP3), and the accepted score is read
back from IndexedDB so a wrong pitch cannot pass. It also asserts that no non-GET request is ever
made (no audio upload), that the model is not downloaded before a transcription starts, that a
rejected file never reaches inference, and that accepting a transcription leaves the previously
open composition intact and re-openable.

---

## Deployment

`npm run build` emits a static `dist/` that can be served from any static host (Cloudflare
Pages, Netlify, GitHub Pages, S3). Because routing is hash-based, no redirect or rewrite
configuration is required. Serve over HTTPS.

---

## Known limitations

- Monophonic melodic notation: one staff, one event per position, no chords, multiple voices,
  lyrics, dynamics, articulation or repeats.
- Audio transcription is an estimate, and it is scoped to short, clear, melody-focused clips of one
  instrument. Tempo is suggested rather than detected with confidence, and meter and key are never
  inferred.
- Transcription speed depends on the device. Measured at roughly 8x realtime on a CPU-only backend;
  a GPU-accelerated browser is much faster.
- A transcription that contains genuine simultaneities cannot be notated faithfully; the raw timings
  are offered as a MIDI download instead of being silently discarded.
- `tied` is stored in the project data but does not yet affect playback or export.
- The key signature is engraved and exported but does not implicitly alter pitches; playback
  uses each note's own accidental.
- Instruments are synthesised oscillator and envelope models, not sampled recordings.
- An empty or partly filled bar does not insert silence during playback.
- PDF export produces a single page, so a long composition is scaled down rather than paginated.

## Items requiring confirmation before public release

- **Contact channel.** No public support, privacy or legal contact address is configured. The
  Contact page states this explicitly; add monitored addresses before publishing.
- **First-party licence.** The source in this repository is released under MIT (see `LICENSE`).
  Confirm the copyright holder line and any additional notices you require.
- **Sample transcription provenance.** The bundled demo melodies are long-established works
  ("Ode to Joy" by Beethoven; the "Minuet in G" attributed to Christian Petzold and linked to
  J. S. Bach) plus one piece labelled "Traditional". The provenance of these specific
  transcriptions is not documented — confirm their rights or replace them.
- **Deployment-host disclosure.** Cookie and logging behaviour of your hosting provider and CDN
  is outside this codebase; review it before publishing.
