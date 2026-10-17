**MUSIKFLO**

**Audio-to-Sheet Music**

**Product Requirements Document**

An additive, browser-local transcription workflow for the existing MusikFlo music studio, designed for static deployment on Cloudflare Pages without login or a processing backend.

|     |
|-----|

| **Document field** | **Value**                                                                      |
|--------------------|--------------------------------------------------------------------------------|
| Product            | MusikFlo — Audio-to-Sheet Music                                                |
| Document type      | Companion feature PRD; does not replace the core MusikFlo PRD                  |
| Version / status   | 1.0 / Draft for implementation                                                 |
| Date               | 16 October 2026                                                                |
| Deployment target  | Static Vite build on Cloudflare Pages (\`\*.pages.dev\`)                       |
| Access model       | No login; audio analysed in the user’s browser                                 |
| Primary users      | Beginners, students, hobby musicians, songwriters                              |
| Core promise       | Upload an audio clip, review an estimated melody score, edit it, and export it |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Non-regression is a release requirement</strong></p>
<p>The audio-transcription feature must be added as an isolated workflow. Existing landing/studio navigation, local project persistence, themes, score rendering, note selection and deletion, C4 pitch mapping, transport, export behaviour, and footer/legal routes must continue to work. If a change risks any of these, stop and design a compatible adapter or migration before implementation.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# **1. Executive summary**

MusikFlo will gain an “Audio to sheet music” feature that accepts a local MP3 or WAV recording, estimates musical note events in the browser, converts the estimates into an editable MusikFlo score, and lets the user correct, play, and export the result. The initial release prioritises short, melody-focused recordings and single-line notation compatible with the current score model.

The feature is a transcription assistant, not a guarantee of perfect score reconstruction. Audio transcription estimates pitch events and timing; readable notation additionally requires rhythm quantisation, measure construction, clef selection, tempo handling, and human review.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Architecture decision</strong></p>
<p>Keep the existing React + TypeScript + Vite application and Cloudflare Pages static deployment. The audio file is decoded and processed client-side. No Python service, account, database, audio upload endpoint, or remote transcription API is required for the core workflow.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## **1.1 Product outcome**

- A visitor can upload an MP3/WAV, run transcription, review the generated score, open it as a new MusikFlo project, and export supported formats without registering.

- The feature preserves the current no-login privacy promise: the audio file is not sent to a MusikFlo server or remote AI service.

- Existing compositions are never silently replaced by transcription results.

- The interface clearly communicates uncertainty, quantisation, scope limits, local processing, and any browser/device constraints.

## **1.2 Recommended feature name**

Use “Audio to sheet music” as the user-facing name. In technical code, use a dedicated module and component such as \`AudioToScoreFlow\` and \`audioTranscription/\`. Avoid calling the feature “perfect song-to-sheet conversion” or implying full orchestral transcription.

# **2. Goals, non-goals and release boundary**

## **2.1 Goals**

- Accept local MP3 and WAV files supported by the browser’s Web Audio decoder.

- Preview the selected audio and allow the user to remove or replace it before analysis.

- Load the transcription model only when the user opens the feature or starts transcription; do not slow down ordinary landing-page or studio use.

- Run note estimation locally, with progress reporting and cancellation where the selected runtime supports it.

- Convert results into the existing score representation without corrupting musical timing or the original project.

- Provide an explicit review stage for tempo, meter, rhythm quantisation and note corrections.

- Open the result as a new composition only after user confirmation.

- Allow download of the supported project/MIDI/score outputs using existing export paths where they remain valid.

- Keep audio files and inferred note events local unless the user deliberately downloads or exports them.

## **2.2 Non-goals for v1**

- Perfect transcription of every complete commercial song, orchestra, vocal arrangement, drum part, or mixed recording.

- Automatic source separation of vocals, drums, bass, guitar, keyboard and other instruments.

- Automatic lyric transcription or optical music recognition from images.

- Cloud processing, mandatory login, a project database, server-side storage or paid API calls.

- Real-time transcription while the recording is playing.

- Replacing the current score model or redesigning the entire studio as a side effect of adding this feature.

- Automatically inferring every key signature, time signature, dynamic, articulation, or instrument assignment without validation.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Scope boundary</strong></p>
<p>V1 produces a melody-focused, editable score from short audio. Basic Pitch can estimate polyphonic note events, but the existing MusikFlo score model stores events sequentially and does not currently express simultaneous note onset/voice relationships. Do not silently serialize chords or discard overlapping events. If overlapping events cannot be represented, explicitly offer a documented melody-extraction option or retain the result as a transcription preview/MIDI export until polyphonic score support is implemented.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# **3. Target users and jobs-to-be-done**

| **User**                   | **Need**                                                                  | **Design response**                                                                 |
|----------------------------|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| Beginner / curious learner | Hear a melody and see what notes may have produced it.                    | Plain language, short workflow, visible limits, note labels and a correction step.  |
| Student                    | Transcribe a short practice clip and review its rhythm.                   | Audio preview, measure/beat display, quantisation controls, easy correction.        |
| Songwriter / hobbyist      | Capture a melodic idea without manually entering every note.              | Local upload, quick analysis, editable output, preserve project and export options. |
| Privacy-conscious user     | Use transcription without creating an account or uploading the recording. | Explicit on-device notice and no network upload of audio.                           |

# **4. UI/UX placement and navigation**

## **4.1 Landing page entry point**

Keep the current MusikFlo landing page, branding, theme palette, hero layout and CTA hierarchy. Add an understated secondary route to transcription; do not replace the primary “Start composing” action or make the landing page crowded.

| **Placement**           | **Required behaviour**                                                                                                                                                                                   |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Hero CTA row            | Retain the current primary “Start composing” button and the existing sample/demo action. Add “Convert audio to sheet music” as a secondary text link or quiet outlined button with an upload/audio icon. |
| Below-hero feature area | Add one concise feature block explaining: “Already have a recording? Turn a short melody into editable notation.” Include a “Choose audio” or “Transcribe a clip” action.                                |
| Mobile                  | Keep the transcription action discoverable without adding a third dominant hero button. It may wrap below the existing actions, preserving adequate touch targets.                                       |
| Theme / motion          | Use existing light/dark tokens and existing Motion conventions. Do not introduce a separate design language or autoplay a large animated waveform.                                                       |

## **4.2 Studio entry point**

Add a clear “Transcribe audio” action in the existing Studio TopBar, near current project creation/open/import actions. Do not replace “Open project” or conflate a native MusikFlo project import with audio transcription.

- On desktop, label the action “Transcribe audio” and use a small audio/upload icon.

- On tablet/mobile, place it inside the existing import or overflow menu if needed, with the full label available to assistive technology.

- The action opens a dedicated transcription flow (modal/page state) rather than opening the file picker with no explanation.

- If the application uses existing hash navigation, add the new state without breaking \`#studio\`, home navigation, direct refresh or browser back/forward behaviour.

## **4.3 Audio-to-score screen**

Use the current MusikFlo design tokens, typography, component radii, neutral surfaces, botanical teal, restrained brass and theme control. The workflow should feel like part of MusikFlo, not an embedded unrelated utility.

| **State**      | **Content and controls**                                                                                                                        | **Behaviour / safety**                                                                                                                                                                      |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Upload     | Title “Convert audio to sheet music”; drop zone; Browse files; accepted formats MP3/WAV; local-processing notice.                               | Do not start processing when a file is merely dropped. Validate type, size, decode support and duration first.                                                                              |
| 2\. Preview    | Filename, duration, file size, audio player, replace/remove buttons; optional start/end trim controls.                                          | Audio remains local. No automatic upload, cloud status or hidden retention.                                                                                                                 |
| 3\. Configure  | Mode “Melody-focused transcription”; duration/file-limit notice; tempo setting (suggested or manual); time signature; rhythm grid/quantisation. | Only expose auto-detected values when the estimator is implemented and tested. Meter defaults to 4/4 unless the user chooses otherwise; do not imply Basic Pitch directly infers meter/key. |
| 4\. Processing | Real progress state, “Loading transcription model” and “Analysing audio” stages where measurable, Cancel.                                       | Load model lazily. Handle failure, cancel, route change and memory exhaustion; do not show fabricated percent progress.                                                                     |
| 5\. Review     | Score preview, playback comparison, detected note list/summary, rhythm adjustment, warnings, “Open as new score”.                               | Explain that results are estimates. Do not silently discard overlapping notes or hide quantisation changes.                                                                                 |
| 6\. Complete   | Open as new composition, export available files, return to studio.                                                                              | Never overwrite active score without explicit confirmation. Preserve original score/draft.                                                                                                  |

## **4.4 Recommended screen copy**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Upload panel</strong></p>
<p>Convert a recording into editable notation. Choose a short MP3 or WAV clip. Your audio is analysed on this device and is not uploaded to a MusikFlo server.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Accuracy guidance</strong></p>
<p>Best results usually come from a clear, melody-focused recording. Mixed songs may contain overlapping instruments and can produce missing or extra notes. Review the score before exporting.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Model loading</strong></p>
<p>First use may download the transcription model. This may take time depending on your connection. The audio analysis itself runs in your browser.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# **5. Detailed functional requirements**

| **ID**  | **Area**            | **Priority** | **Acceptance requirement**                                                                                                                                                                                      |
|---------|---------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A2S-001 | Entry points        | Must         | Landing page and Studio provide a discoverable transcription action while preserving current primary composition and open/import actions.                                                                       |
| A2S-002 | File input          | Must         | Accept local MP3 and WAV files; show clear validation for unsupported format, unreadable audio, empty/corrupt files, oversize inputs and overlong clips.                                                        |
| A2S-003 | Initial constraints | Must         | Start with configurable pilot limits, suggested defaults: ≤20 MiB file and ≤60 seconds audio. Constants must be configurable and can change based on measured browser performance.                              |
| A2S-004 | Audio preview       | Must         | Decode and preview the selected clip before transcription; display filename and duration; allow replace/remove.                                                                                                 |
| A2S-005 | Privacy             | Must         | Audio bytes and raw audio buffers must not be sent to MusikFlo or third-party processing endpoints. Model assets may be fetched as static files.                                                                |
| A2S-006 | Model loading       | Must         | Lazy-load the approved transcription runtime and model on demand; show real loading state; reuse a ready model within the current tab where feasible.                                                           |
| A2S-007 | Inference           | Must         | Run transcription in-browser using an approved TypeScript-compatible runtime. Evaluate @spotify/basic-pitch during a feasibility spike; pin versions and verify browser compatibility before adoption.          |
| A2S-008 | Responsiveness      | Must         | Use a Web Worker if the runtime/input contract supports it. Otherwise provide a documented, tested browser-compatible approach that keeps the UI responsive. Do not claim worker execution unless verified.     |
| A2S-009 | Progress and cancel | Must         | Report measurable progress stages and permit cancellation where technically supported. On cancel, stop work, release references and return to a safe state.                                                     |
| A2S-010 | Preprocessing       | Must         | Use browser audio decoding; downmix/resample as required by the model; guard against clipping/empty content and clean up large buffers when no longer needed.                                                   |
| A2S-011 | Note events         | Must         | Retain raw predicted onset, end/duration, pitch and other useful available data in a temporary transcription result model before score conversion.                                                              |
| A2S-012 | Rhythm conversion   | Must         | Map estimated event times to supported note durations using explicit quantisation settings. Display when rhythm has been simplified; do not silently round away material timing information.                    |
| A2S-013 | Tempo / meter       | Must         | Allow tempo and meter adjustments before creating the score. Automatic tempo is optional and must be identified as an estimate. Meter/key inference is not claimed unless implemented and validated separately. |
| A2S-014 | Polyphonic output   | Must         | Detect or conservatively identify overlapping note events. Do not serialize simultaneous notes as sequential events or drop them without explicit user choice and a visible warning.                            |
| A2S-015 | Score adaptation    | Must         | Convert the accepted monophonic melody result into the existing canonical Score model through a dedicated adapter. Do not render transcription results as arbitrary SVG or bypass existing validation.          |
| A2S-016 | Review              | Must         | Show the score preview and at least a textual detected-event summary. Let the user correct important pitch/rhythm settings before committing to the main editor.                                                |
| A2S-017 | Safe open           | Must         | Create a new project from the accepted result with a new score ID. Preserve current project, undo/redo history as appropriate, and local saved state.                                                           |
| A2S-018 | Exports             | Must         | Reuse existing validated export flows for supported outputs. MIDI may preserve event timings better than quantised notation where the implementation supports it; explain format differences.                   |
| A2S-019 | Accessibility       | Must         | File selection supports keyboard activation; status changes are announced accessibly; all controls have labels; colour is not the sole status cue.                                                              |
| A2S-020 | Diagnostics         | Must         | Record development diagnostics without logging audio content or raw note sequences. Provide actionable user-facing errors without stack traces.                                                                 |

# **6. Transcription and notation pipeline**

Use a staged pipeline. Keep inference output separate from the final score until the user accepts it.

| **Stage**                | **Responsibility**           | **Requirements**                                                                                                                                                                        |
|--------------------------|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A. File validation       | AudioToScoreFlow             | Check MIME/extension as hints, actual decoding, size and duration. Reject unsupported/corrupt inputs with clear remediation.                                                            |
| B. Decode                | Browser Web Audio API        | Decode MP3/WAV where the browser supports them. Handle stereo safely; convert to the model input format and resample if required.                                                       |
| C. Model runtime         | Transcription adapter        | Lazy-load the pinned TypeScript-compatible model and model assets. Verify licensing, worker compatibility, output schema and production bundling.                                       |
| D. Inference             | Transcription worker/adapter | Estimate note events and preserve timing data. Progress callbacks must reflect real work. Catch memory/runtime errors.                                                                  |
| E. Normalise             | Transcription result model   | Sort events; normalise time units; reject impossible values; retain source timestamps before quantisation; identify overlaps and uncertainty where the model exposes usable confidence. |
| F. Quantise / build bars | Score conversion adapter     | Apply user-selected or clearly labelled estimated tempo, rhythm grid and meter. Map events to note/rest durations and measures; prevent overfull bars; preserve timing error summary.   |
| G. Review                | Result UI                    | Render the proposed score through the existing notation system, permit adjustments, and flag unsupported overlap/notation.                                                              |
| H. Commit                | Existing project model       | Only after explicit user action create a new score and save it through existing persistence; do not mutate the prior active score.                                                      |

## **6.1 Technology feasibility and package validation**

Candidate: \`@spotify/basic-pitch\` TypeScript package. Its documented API accepts browser audio data and produces note events; it supports polyphonic note estimation but works best on one instrument at a time. This is a candidate to evaluate, not an assumption that integration is already proven.

- Run a proof of concept with the project’s current Vite/TypeScript versions before wiring it into the production UI.

- Confirm the chosen package and inference runtime work in current desktop Chrome, Firefox, Edge and Safari where supported.

- Pin the exact package/runtime version and record Apache-2.0 licensing/attribution in the existing license inventory.

- Verify how model files are located, bundled, loaded, cached and served in a Cloudflare Pages production build.

- Do not download or run model files from an unpinned third-party CDN at runtime.

- If the candidate runtime is incompatible or too heavy, evaluate a maintained browser-compatible alternative; do not silently introduce a remote API or Python server.

## **6.2 Model assets and Cloudflare Pages limits**

Measure the actual emitted model/runtime asset sizes during the production build. Cloudflare Pages documents a 25 MiB maximum size for an individual site asset. Ensure every deployed file stays within the limit. If a model asset exceeds the limit, stop and document a deliberate alternative such as supported asset partitioning or separately hosted static model assets with correct CORS/cache headers. This must not introduce server-side transcription or force users to sign in.

## **6.3 Rhythm and musical correctness**

- The transcription model estimates pitches and note timing; it does not by itself guarantee readable score engraving or reliable key/time-signature inference.

- Allow the user to set or confirm BPM and meter. Default to a predictable meter such as 4/4 when no validated meter estimate is available.

- Offer supported rhythm quantisation settings, at minimum automatic/nearest supported grid and an explicit grid such as eighth or sixteenth note where implemented.

- Keep the raw estimated timing events available during review so changes can be re-quantised without rerunning inference.

- If the score model cannot represent overlaps, display an explicit decision: melody-only extraction with its limitations, or keep the result in preview/export form and defer opening a multi-voice score. Do not silently serialize a chord.

# **7. Data, privacy and local persistence**

## **7.1 Data handling**

| **Data**                  | **Where it lives**                                                          | **Policy**                                                                                               |
|---------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| Original audio file       | Temporary browser memory / object URL                                       | Never upload; release object URLs and buffers after use/cancel/close where safe.                         |
| Decoded audio buffer      | Browser memory                                                              | Temporary only; no autosave of large audio blobs by default.                                             |
| Raw transcription events  | In-memory result state until accepted/discarded                             | Do not place in analytics or logs. Persist only if needed for a deliberate recoverable conversion draft. |
| Accepted score            | Existing MusikFlo score model and IndexedDB project storage                 | Save as a new project using existing persistence and validation.                                         |
| Transcription model files | Static assets delivered by Pages or explicitly configured static asset host | May be cached locally where standards and storage limits permit; do not cache unbounded audio inputs.    |

## **7.2 Privacy language**

The upload panel may state that audio is analysed on the device only after network inspection confirms the implementation does not send source audio to a remote endpoint. Static model files may be requested from the configured asset host; that is not the same as uploading the user’s audio. Do not state “works offline on first use” unless the model is already cached or the offline path has been verified.

## **7.3 Resource guardrails**

- Initial configurable pilot limits: 20 MiB source file and 60 seconds decoded duration. These are starting limits, not permanent product guarantees; revise only after testing memory and latency on representative devices.

- Validate both file bytes and decoded duration; compressed file size alone is not a sufficient memory estimate.

- Allow one active transcription per tab. Disable duplicate submissions while processing.

- Provide cancellation and clear reset of the selected input and results.

- Handle tab closure, navigation, worker exceptions and browser storage pressure without corrupting the active composition.

- Do not persist source audio by default and do not silently re-run transcription after reload.

# **8. Error, loading and empty states**

| **Condition**                    | **User-facing response**                                                                                                        | **Required behaviour**                                                                            |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| Unsupported/corrupt file         | “This file could not be decoded. Try a standard MP3 or WAV file.”                                                               | Keep current score intact; allow file replacement.                                                |
| File too large / too long        | “This clip is above the current limit. Trim it or choose a shorter file.”                                                       | Show actual limit and detected value; do not start model inference.                               |
| First model load                 | “Preparing transcription engine…”                                                                                               | Show real network/loading state, retry and cancel if supported.                                   |
| No usable notes detected         | “No clear notes were detected. Try a cleaner or melody-focused recording.”                                                      | Do not create an empty or fake score without explanation.                                         |
| Overlapping notes found          | “This recording contains simultaneous notes. The current score editor cannot yet represent a complete multi-voice arrangement.” | Offer only a clearly labelled supported alternative; never silently flatten.                      |
| Inference failure / memory limit | “Transcription could not finish on this device. Try a shorter clip or close other tabs.”                                        | Release buffers; preserve project and permit retry.                                               |
| Cancelled                        | “Transcription cancelled.”                                                                                                      | Discard partial result unless the user explicitly elects to keep a recoverable preview.           |
| Quantisation changes timing      | “Rhythm has been simplified to the selected grid.”                                                                              | Let user change the grid or cancel; show a summary of the conversion.                             |
| Open as new score                | “Your transcription will open as a new composition. Your current project will be preserved.”                                    | If existing changes are unsaved, save/recover them or request explicit decision before switching. |

# **9. Non-regression requirements for the existing MusikFlo application**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Mandatory rule</strong></p>
<p>Treat this feature as additive. Do not rewrite App routing, ScoreCanvas, the canonical Score model, theme tokens, exporters, audio engine or IndexedDB layer simply to accommodate transcription. Use new modules and adapters first. Any required core-model change needs a documented compatibility plan and additional regression coverage.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Area**                   | **Pass condition**                                                                                                                                                                   |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Landing page and animation | Primary Start composing and Try sample actions still work; new audio CTA uses existing palette, typography and Motion approach; reduced-motion preference remains respected.         |
| Navigation / hash routes   | Existing landing and studio hash routes, back/forward navigation, theme state and refresh behaviour are preserved.                                                                   |
| Themes                     | Light and dark mode remain consistent across landing, studio, upload, preview, progress, review, errors and footer/legal routes. Staff and ledger lines remain visible in dark mode. |
| Note selection/insertion   | Selecting an existing note never inserts another note; empty-space click inserts only when the Note tool is active; Select and Eraser modes remain distinct.                         |
| C4 and pitch mapping       | C4 in treble clef uses the correct ledger line; bass mapping remains correct; adding measures/rows does not change pitch for equivalent staff positions.                             |
| Canvas geometry            | Zoom, viewport resize, hit-testing, hover labels, selected-note outline and playhead remain aligned.                                                                                 |
| Editing history            | Undo/redo, delete, duplicate and score reset continue to work; newly imported transcription creates a fresh project without damaging the old one.                                    |
| Playback                   | Existing Tone.js playback, play/pause/stop/restart, tempo, instrument selection and visual playhead remain functional after a new score is opened.                                   |
| Persistence                | Existing IndexedDB save/open/draft recovery remains operational. New score uses valid IDs and schema; no source audio is stored inadvertently.                                       |
| Exports                    | Existing supported MIDI/project/PDF/PNG/WAV/MP3 export flows continue to produce valid files. Unsupported outputs remain clearly disabled or documented.                             |
| Footer and legal routes    | Existing footer links and pages remain functional; no accidental removal during routing/UI changes.                                                                                  |
| Mobile / accessibility     | Tap-to-place, file picker, dialog focus, keyboard shortcuts and reduced-motion remain usable; no horizontal page overflow.                                                           |

# **10. Acceptance criteria and verification plan**

## **10.1 Functional acceptance tests**

1.  A user opens the feature from the landing page and from the Studio without signing in.

2.  A valid MP3 and a valid WAV are each selected, previewed, transcribed, reviewed and accepted as a new score.

3.  Invalid, unsupported, empty and oversized files are rejected with accurate guidance.

4.  The transcription model is loaded on demand; ordinary page load and manual composition do not wait for model download.

5.  The audio remains local. Network inspection confirms no source audio upload or external transcription request.

6.  Processing progress is tied to actual model/data stages; Cancel stops or safely abandons work and releases resources.

7.  Detected note times are converted according to explicit tempo/meter/quantisation choices and a visible summary identifies simplification.

8.  Overlapping events are not silently dropped or serialized. A documented safe choice is shown.

9.  Accepting a transcription creates a new score ID and never replaces an unsaved/current score without explicit protection.

10. The resulting score can be edited with existing tools, played through Tone.js, saved in IndexedDB and exported through supported existing exporters.

11. The user can delete/reset transcription input and results without deleting their existing compositions.

12. The model and runtime bundle are compatible with the Cloudflare Pages deployment limits and production headers/CORS if separate static assets are required.

## **10.2 Regression test matrix**

| **Test group**    | **Minimum coverage**                                                                                | **Release gate**                                     |
|-------------------|-----------------------------------------------------------------------------------------------------|------------------------------------------------------|
| Core editor       | Select existing note; place note on empty staff; delete via tool and keyboard; undo/redo.           | No selection click may cause insertion; all pass.    |
| Pitch/layout      | C4 ledger line; treble/bass staff; 1st, 2nd and later score rows; zoom and resize.                  | No pitch drift or hitbox misalignment.               |
| Themes            | All affected views in light/dark; score lines/glyphs/selection contrast.                            | No illegible staff elements.                         |
| Playback          | Known melody before/after transcription; play/pause/stop/seek where supported; instrument change.   | Existing playback still works and follows new score. |
| Persistence       | Save current score; begin transcription; cancel; accept result as new project; reload.              | Original project remains recoverable.                |
| Exports           | Export a known existing score and a transcribed score for each supported format.                    | No export regression or mislabeled file.             |
| Static deployment | Production build preview and Pages deployment; model fetch; direct route refresh; asset size audit. | No dev-only dependency or backend requirement.       |
| Accessibility     | Keyboard file selection, announced processing status, focus trapping/return, reduced motion.        | No critical keyboard or focus regressions.           |

## **10.3 Transcription quality checks**

Use a small test corpus of recordings owned by the team or explicitly licensed for testing. Include a clean monophonic melody, a sustained instrument with vibrato, a short piano phrase with overlapping notes, a noisy recording and a mixed recording. Record the reference pitches/timing and compare output in terms of missed notes, extra notes, pitch errors, onset/duration error, rhythm-quantisation error and time to result. Do not invent accuracy percentages before this evaluation.

# **11. Proposed implementation phases**

| **Phase**                       | **Work**                                                                                                                                                                        | **Exit gate**                                                                                                      |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 0\. Feasibility spike           | Install/pin candidate Basic Pitch TS runtime; decode MP3/WAV in browser; run one short reference clip; measure bundle/model size and inference time in a production-like build. | A real browser prototype returns note events. License/package/runtime compatibility and asset strategy documented. |
| 1\. Isolated UI flow            | Landing and TopBar entry points; upload, validation, preview, privacy copy, model loading/error/cancel states; existing theme integration.                                      | Flow is reachable, styled consistently and does not alter current project.                                         |
| 2\. Transcription engine        | Local preprocessing, model inference adapter/worker where supported, temporary result model, cleanup.                                                                           | Valid note events returned; browser remains usable; no audio network upload.                                       |
| 3\. Score conversion and review | Tempo/meter/grid controls, overlap detection and safe handling, score preview, correction/confirmation.                                                                         | No hidden timing simplification or unsupported polyphony loss.                                                     |
| 4\. New-project handoff         | Adapter to existing Score schema, new IDs, safe project switching, IndexedDB save, reuse exports.                                                                               | Transcription opens and can be edited/played/exported without damaging existing work.                              |
| 5\. Hardening                   | Full regression tests, accessibility, memory/performance, Pages asset limits, docs/licence updates.                                                                             | All mandatory gates pass; known limitations and test evidence documented.                                          |

# **12. Proposed success metrics**

Targets below are pilot hypotheses, not claims about current performance. Measure them on supported devices before public claims are made.

| **Metric**                  | **Initial target / observation**                                                                                               |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| Completion rate             | Measure percentage of users who complete upload → result review → open score; establish baseline before setting a hard target. |
| Time to first transcription | Report model-download time separately from inference time; measure warm and cold runs.                                         |
| Reliability                 | Track failures by stage and browser, without logging audio or musical content.                                                 |
| Score usefulness            | In a small user study, ask whether the generated melody is recognisable and how many corrections are required.                 |
| Resource usage              | Measure peak memory, CPU time and browser responsiveness for clips at the configured limit.                                    |
| Regression                  | 100% pass on the mandatory non-regression suite before release.                                                                |

# **13. Risks, constraints and mitigations**

| **Risk**                                     | **Impact**                                       | **Mitigation**                                                                                                                    |
|----------------------------------------------|--------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Model package/runtime compatibility          | Build fails or inference fails in some browsers. | Feasibility spike first; pin versions; browser E2E tests; no deployment until proven.                                             |
| Model asset exceeds Pages limit              | Static deployment fails.                         | Audit every emitted asset; keep each ≤25 MiB; evaluate supported partitioning or separate static asset hosting if needed.         |
| Inference performance / memory               | Long audio freezes or crashes a tab.             | Short v1 limits, lazy model loading, worker where supported, cancellation, cleanup, explicit errors.                              |
| Transcription inaccuracies                   | Misleading or unusable sheet.                    | Label output as estimated; short single-line scope; review/edit stage; quality corpus and correction metrics.                     |
| Polyphony not representable by current model | Chords get lost or serialized incorrectly.       | Overlap detection, explicit choice/warning, MIDI path where supported; defer full multi-voice score until the schema supports it. |
| Rhythm quantisation alters timing            | Score sounds different from source.              | User-visible grid/tempo, show simplification, retain raw event timing until acceptance.                                           |
| Existing editor regressions                  | Core composition becomes unreliable.             | Isolated module and adapter; regression gates for selection, deletion, pitch mapping, theme, playback, persistence and exports.   |
| Privacy claim is false                       | Loss of user trust.                              | Inspect network requests; prohibit audio uploads/remote transcription; privacy statement must match actual implementation.        |
| Sample/library licensing                     | Legal risk for commercial release.               | Record dependency/model licence and attribution; no extra bundled samples unless redistribution rights are verified.              |

# **14. Definition of done**

- The feature is reachable from both the landing page and the studio without altering current navigation semantics.

- MP3/WAV upload, validation, preview, model loading, transcription, review and new-score handoff work in a production-built browser application.

- The uploaded audio is not sent to a server or remote inference API.

- The result is explicitly treated as an estimate, and rhythm quantisation/polyphony limitations are visible.

- The current score is preserved; accepted transcription opens as a new project.

- The imported score remains editable, playable, locally saveable and exportable through the already-supported paths.

- All non-regression tests in Section 9/10 pass, including dark-mode staff visibility, selection-vs-insertion, deletion, C4 placement and pitch stability across rows.

- The static production build and Cloudflare Pages deployment are verified, including model asset size, loading and routes.

- README/help text, privacy copy, dependency licence notices, known limitations and test results are updated.

# **15. Command Code execution directive**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Implementation instruction</strong></p>
<p>Read the original MusikFlo PRD and this companion PRD, then inspect the current repository before changing code. Treat the companion PRD as additive. First prove the selected transcription runtime works in the actual browser/static build. Implement in phases, retain the current design system and working behaviour, and run the full regression matrix after every integration phase. Do not claim completion based on compilation alone.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Do not perform a broad rewrite. Create a dedicated audio-transcription module, a separate result model, and a tested adapter into the existing Score model. If the existing model cannot represent a detected result faithfully, preserve the data and explain the limitation rather than silently corrupting the score. Protect unsaved compositions. Never add login, a backend, or a remote transcription API unless the product owner explicitly changes the architecture.

# **Appendix A — Implementation references**

These references justify the proposed technical direction. Re-check them during implementation and record exact versions used in the repository.

**Spotify Basic Pitch TypeScript README —** [<u>https://github.com/spotify/basic-pitch-ts</u>](https://github.com/spotify/basic-pitch-ts)

> TypeScript audio-to-note-event transcription API, model input expectations, and statement that it works best on one instrument at a time.

**Spotify Basic Pitch npm package —** [<u>https://www.npmjs.com/package/@spotify/basic-pitch</u>](https://www.npmjs.com/package/@spotify/basic-pitch)

> Package metadata and Apache-2.0 licensing; verify the selected version and dependencies before use.

**Spotify Basic Pitch main repository —** [<u>https://github.com/spotify/basic-pitch</u>](https://github.com/spotify/basic-pitch)

> Project background, research paper and reference implementation.

**Cloudflare Pages platform limits —** [<u>https://developers.cloudflare.com/pages/platform/limits/</u>](https://developers.cloudflare.com/pages/platform/limits/)

> Current Pages asset and deployment limits; check during build.

**Web Audio API: AudioBuffer —** [<u>https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer</u>](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)

> Browser decoded audio interface.

# **Appendix B — Quick acceptance checklist**

> ☐ Upload CTA exists on landing page and in Studio TopBar / mobile import menu.
>
> ☐ Existing “Start composing”, “Try sample”, Studio navigation, theme toggle and footer still work.
>
> ☐ No source audio is uploaded over the network.
>
> ☐ Model is lazy-loaded and browser/static-bundle compatibility is proven.
>
> ☐ Progress, cancellation, errors and cleanup work.
>
> ☐ Detected note events are reviewed before score conversion.
>
> ☐ Overlapping notes are never silently discarded or serialized.
>
> ☐ Accepted result becomes a new project, preserving current score.
>
> ☐ Edit → playback → local save → export works for the converted score.
>
> ☐ Dark/light score rendering, note selection/deletion, C4 placement and later-row pitch mapping pass regression tests.
>
> ☐ Cloudflare Pages production build passes asset-size and direct-navigation checks.
>
> ☐ Known limitations and quality evaluation are documented honestly.
