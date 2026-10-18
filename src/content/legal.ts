import { LegalRouteName, PRODUCT_OWNER, PRODUCT_OWNER_LOCATION, PRODUCT_VERSION } from '../routing/routes';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Rendered as a highlighted callout when the point needs extra emphasis. */
  callout?: string;
}

export interface LegalDocument {
  route: LegalRouteName;
  title: string;
  summary: string;
  sections: LegalSection[];
}

const OWNER = `${PRODUCT_OWNER}, ${PRODUCT_OWNER_LOCATION}`;

export const LEGAL_DOCUMENTS: Record<LegalRouteName, LegalDocument> = {
  privacy: {
    route: 'privacy',
    title: 'Privacy',
    summary: 'MusikFlo keeps your compositions in your own browser. This page describes exactly what is stored and what leaves your device.',
    sections: [
      {
        heading: 'Your music stays on your device',
        paragraphs: [
          'MusikFlo is a browser-only application with no account system and no MusikFlo server. Your scores are written to storage managed by your browser and are never uploaded to us.',
          'There is no sign-in, no profile, no sync service and no MusicXML/MIDI/PDF/WAV upload step. Exports are generated locally and saved through your browser as ordinary file downloads.',
        ],
      },
      {
        heading: 'Audio transcription',
        paragraphs: [
          'If you use "Convert audio to sheet music", the audio file you choose is decoded and analysed entirely inside your browser using an on-device model. The recording is never uploaded to us or to any third-party service, and no transcription API is called.',
          'Two things are downloaded so that this can work: the transcription runtime (a code bundle) and the model files, both served from this site rather than a third-party CDN. They are fetched the first time you start a transcription, not when you open the site.',
          'The audio itself, and the note events estimated from it, stay in memory for the session. They are not written to browser storage and are discarded when you leave the flow, unless you accept the result — which saves only the resulting score, exactly like any other project.',
        ],
      },
      {
        heading: 'What is stored locally',
        bullets: [
          'IndexedDB database "musikflo_db" stores your scores (title, composer, clef, time signature, key, tempo, instrument, measures, notes, identifiers and timestamps) in the "scores" object store, plus a "latest_draft_id" pointer in the "metadata" store.',
          'If IndexedDB is unavailable (for example in some restricted or private browsing modes), MusikFlo falls back to localStorage under the keys "musikflo_score_<id>" and "musikflo_latest_id".',
          'localStorage also holds "musikflo_theme" (your light/dark choice) and "musikflo_dismissed_hint" (whether you dismissed the first-run hint).',
        ],
      },
      {
        heading: 'What leaves your device',
        paragraphs: [
          'MusikFlo does not send your compositions anywhere. The application code contains no analytics, no advertising, no telemetry and no network calls that transmit project data.',
          'Two ordinary web requests do occur: your browser downloads the application itself from its hosting provider, and it downloads the Manrope and Instrument Serif web fonts from Google Fonts (fonts.googleapis.com and fonts.gstatic.com). Those requests necessarily disclose normal connection information such as your IP address and user agent to those providers, and their handling of it is governed by their own policies.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'MusikFlo does not set cookies and does not use cookie-based tracking. See the Cookies page for detail.',
        ],
      },
      {
        heading: 'Exporting or deleting your data',
        bullets: [
          'Export → Backup Project (.musikflo) downloads a complete, readable copy of a score.',
          'Export → Standard MIDI, MusicXML, WAV or PDF produces portable copies of your work.',
          'To erase your data, delete the individual scores you no longer want, or clear site data for this origin in your browser settings. Clearing site data removes every score stored by MusikFlo and cannot be undone.',
        ],
        callout:
          'Browser storage belongs to this specific browser profile and origin. It is not encrypted by MusikFlo, it can be evicted by your browser under storage pressure, and it is not available from another device or browser. Export important work.',
      },
      {
        heading: 'Compliance and absence of liability for user conduct',
        paragraphs: [
          'Because MusikFlo operates strictly inside your browser sandbox with zero server-side storage, we have zero knowledge, zero visibility, and zero custody of the audio recordings you process or the music you compose.',
          'MusikFlo does not and cannot monitor user conduct or verify copyright ownership of user materials. All legal responsibility and liability for files uploaded, transcribed, composed, or exported using this application rests solely and exclusively with the user. MusikFlo and its creators disclaim all liability for any illegal, infringing, or unauthorized activities conducted by users on their own devices.',
        ],
      },
    ],
  },

  terms: {
    route: 'terms',
    title: 'Terms of use',
    summary: 'Plain terms for using the MusikFlo browser application.',
    sections: [
      {
        heading: 'Using MusikFlo',
        paragraphs: [
          'MusikFlo is a browser-based music notation tool. You may use it to compose, play back and export music. You are responsible for the music you create and for how you use the files you export.',
        ],
      },
      {
        heading: 'Your work is yours',
        paragraphs: [
          'MusikFlo does not claim ownership of anything you compose. Because your scores never reach us, we hold no copy of them and grant you no licence over them. You are solely responsible for keeping your own backups.',
        ],
      },
      {
        heading: 'Provided as-is',
        paragraphs: [
          'MusikFlo is provided on an "as is" and "as available" basis, without warranties of any kind, whether express or implied, including fitness for a particular purpose or that notation, playback or exported files will be free of errors.',
          'MusikFlo is not a publisher, a distributor of your music, or a backup service. Browser storage can be cleared or evicted by your browser, and exported files can be lost or corrupted. Keep independent backups of anything important.',
        ],
      },
      {
        heading: 'Acceptable use & prohibition of illegal activity',
        paragraphs: [
          'You agree to use MusikFlo only for lawful purposes and in strict accordance with all applicable local, national, and international laws, regulations, and copyright statutes.',
          'Do not use MusikFlo to create, import, transcribe, export, or distribute any material you do not have the legal right to use, including copyrighted sound recordings, musical works, or intellectual property without proper authorization. You warrant that you possess all necessary rights, licenses, and permissions for any audio files or sheet music you process.',
          'You must not use the software to facilitate, generate, or propagate any defamatory, obscene, fraudulent, harmful, or otherwise unlawful material, nor attempt to interfere with the application or the hosting service that delivers it.',
        ],
      },
      {
        heading: 'Disclaimer of liability for illegal activities and user conduct',
        paragraphs: [
          'To the fullest extent permitted by applicable law, MusikFlo, its authors, developers, contributors, and Aztras AI Tech Solutions explicitly disclaim all liability and responsibility for any illegal, infringing, tortious, or unauthorized activities committed by users of the software.',
          'MusikFlo is a client-side software utility, not a content hosting provider, publisher, or legal arbiter. We do not review, endorse, or verify user content. You are solely and exclusively liable for any legal consequences, damages, claims, or penalties arising from your use of the software.',
        ],
      },
      {
        heading: 'Indemnification',
        paragraphs: [
          'You agree to defend, indemnify, and hold harmless MusikFlo, its creators, developers, contributors, and Aztras AI Tech Solutions from and against any and all claims, liabilities, damages, losses, judgements, costs, and expenses (including reasonable legal and attorney fees) arising out of or related to your use of the application, your compositions, your uploaded audio, your violation of these terms, or your infringement of any third-party rights.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'The application and these terms may change as MusikFlo develops. The version you are using is always the one delivered to your browser.',
        ],
        callout:
          'This page describes how the software behaves; it is not legal advice and it does not create a registered-company relationship, a support commitment or a service-level agreement.',
      },
    ],
  },

  cookies: {
    route: 'cookies',
    title: 'Cookies',
    summary: 'MusikFlo does not set cookies.',
    sections: [
      {
        heading: 'No application cookies',
        paragraphs: [
          'MusikFlo does not create, read or rely on cookies. Its source contains no cookie API usage, no consent manager, no analytics SDK and no tracking pixels.',
          'Preferences such as your light/dark theme and the dismissed first-run hint are kept in browser localStorage and IndexedDB, not in cookies.',
        ],
      },
      {
        heading: 'Third parties and hosting',
        paragraphs: [
          'MusikFlo loads web fonts from Google Fonts. Google may set its own cookies or receive request metadata when the fonts are fetched; that behaviour is controlled by Google, not by MusikFlo.',
          'Your hosting provider or CDN may also set cookies or log requests as part of delivering the site. Those are infrastructure-level behaviours outside the application code. If you deploy MusikFlo yourself, review your own host\'s cookie and logging configuration before publishing.',
        ],
      },
      {
        heading: 'If that changes',
        paragraphs: [
          'If a future version of MusikFlo introduces cookies or analytics, this page and the Privacy page will be updated to describe them before or at the time they are introduced.',
        ],
      },
    ],
  },

  disclaimer: {
    route: 'disclaimer',
    title: 'Disclaimer',
    summary: 'What MusikFlo does well, and where its limits are.',
    sections: [
      {
        heading: 'What MusikFlo supports',
        bullets: [
          'Monophonic melodic notation: a single staff, treble or bass clef, one note or rest per position, in sequence.',
          'Whole, half, quarter, eighth and sixteenth durations, dotted values, and sharp, flat or natural accidentals.',
          'Time signatures, a key signature, tempo, and live playback with a visual playhead.',
          'Six synthesised instrument voices: piano, plucked acoustic guitar, chamber strings, concert flute, Indian bansuri and clarinet.',
          'Exports: Standard MIDI, MusicXML 3.1, 16-bit 44.1 kHz WAV, PDF, and a native .musikflo project backup.',
        ],
      },
      {
        heading: 'Known limitations',
        bullets: [
          'The instruments are synthesised oscillator and envelope models generated in your browser. They are not recordings of real instruments.',
          'Audio transcription estimates note pitches and timings. It is a transcription assistant, not a guarantee of a correct score, and it works best on short, clear, melody-focused recordings of one instrument.',
          'The score editor writes a single line of music. A recording that contains genuinely simultaneous notes cannot be notated faithfully: you are offered an explicit choice between reducing it to a melody line or keeping the detected notes, and the raw timings remain available as a MIDI download.',
          'Rhythm is quantised to a chosen grid, which changes note lengths and onsets by a small amount. The conversion summary reports the mean and worst timing change.',
          'Tempo is estimated from the recording and is presented as a suggestion. Time signature and key signature are never inferred — the meter is chosen by you.',
          'Analysis runs on your device, so its speed depends on your hardware. A clip can take a while on a device without graphics acceleration.',
          'There is no support for chords, multiple simultaneous voices, lyrics, dynamics, articulation, repeats, multiple staves or key changes mid-piece.',
          'Ties are stored in the project data but do not yet affect playback or export.',
          'The key signature is engraved and exported, but it does not automatically apply accidentals to notes you place, and playback uses each note\'s own accidental.',
          'Playback follows your note events in order. Time signatures are used for notation and measure validation; an empty or partially filled measure does not insert silence.',
          'The metronome clicks on beats where notes begin. It is not an independent beat clock, so sustained notes and empty bars do not produce clicks on their later beats.',
          'PDF export renders the score onto a single page, so a very long composition is scaled down rather than paginated.',
        ],
      },
      {
        heading: 'Keep backups',
        paragraphs: [
          'Your work lives in your browser. Clearing site data, switching browser or device, or browser storage eviction will lose it. Export a .musikflo backup for anything you care about, and treat exported files as the authoritative copy.',
        ],
      },
      {
        heading: 'No liability for user content, uploads, or copyright infringement',
        paragraphs: [
          'MusikFlo is a neutral, self-contained, client-side software utility. The developers and publishers do not monitor, review, store, or verify the audio files users upload for transcription or the sheet music they compose.',
          'You are solely and exclusively responsible for ensuring that any audio recording, composition, or file you process with MusikFlo complies with applicable copyright and trademark laws, and that you possess all necessary rights or licenses. MusikFlo and Aztras AI Tech Solutions disclaim any and all liability for unauthorized transcription of copyrighted materials, intellectual property infringement, or any illegal conduct carried out by users.',
        ],
      },
    ],
  },

  contact: {
    route: 'contact',
    title: 'Contact',
    summary: 'How to reach the MusikFlo team and Aztras AI Tech Solutions.',
    sections: [
      {
        heading: 'Get in Touch',
        paragraphs: [
          'For feedback, support inquiries, collaboration proposals, or issue reports, you can reach us directly by email:',
          'zetaaztratech@gmail.com',
        ],
        callout:
          'Messages are monitored regularly. When submitting a bug or technical issue, please mention your browser, operating system, and steps to reproduce.',
      },
      {
        heading: 'Product & Organization',
        bullets: [
          `Product: MusikFlo · ${PRODUCT_VERSION}`,
          `Publisher: ${OWNER}`,
          'Primary Contact: zetaaztratech@gmail.com',
          'Architecture: 100% browser-native composition and synthesis with zero server storage of user music.',
        ],
      },
    ],
  },

  licenses: {
    route: 'licenses',
    title: 'Licenses',
    summary: 'Licences that apply to MusikFlo and to the third-party components it bundles.',
    sections: [
      {
        heading: 'MusikFlo source',
        paragraphs: [
          'The MusikFlo application source in this repository is released under the MIT License. The full licence text is included in the repository as LICENSE.',
        ],
      },
      {
        heading: 'Bundled libraries',
        paragraphs: [
          'These are the runtime libraries shipped in the production bundle, with the licence declared by each installed package:',
        ],
        bullets: [
          'React and React DOM — MIT',
          'VexFlow (music notation engraving) — MIT',
          'Tone.js (audio synthesis) — MIT',
          'jsPDF (PDF generation) — MIT',
          'midi-writer-js (MIDI writing) — MIT',
          'Lucide (icon set, via lucide-react) — ISC',
          'Motion (animation, via the motion package) — MIT',
          'Tailwind CSS — MIT',
          'Spotify Basic Pitch (audio-to-note transcription, @spotify/basic-pitch 1.0.1) — Apache-2.0, including the bundled model weights',
          'TensorFlow.js (@tensorflow/tfjs 3.21.0), used by Basic Pitch for inference — Apache-2.0',
          '@tonejs/midi, used by Basic Pitch for its output handling — MIT',
        ],
        callout:
          'The transcription runtime and model are loaded only when a transcription is started, and are served from this application rather than a third-party CDN.',
      },
      {
        heading: 'Development-only tools',
        paragraphs: [
          'The test suite generates its own audio fixtures with @breezystack/lamejs (LGPL-3.0), a pure-JavaScript MP3 encoder. It is a development dependency used only to build test fixtures; its code is not part of the application bundle and is not served to users.',
        ],
      },
      {
        heading: 'Fonts',
        bullets: [
          'Manrope and Instrument Serif are served by Google Fonts and are distributed by their authors under the SIL Open Font License 1.1.',
          'VexFlow ships its own music engraving fonts with its distribution; the engraving fonts and their notices are part of the VexFlow package rather than of MusikFlo. Consult the VexFlow distribution for the exact font notices.',
        ],
      },
      {
        heading: 'Included sample melodies',
        paragraphs: [
          'The studio includes demo melodies for illustration. The underlying compositions are long-established works ("Ode to Joy" by Ludwig van Beethoven, and the "Minuet in G" commonly attributed to Christian Petzold and linked to J. S. Bach), and one demo is labelled "Traditional".',
        ],
        callout:
          'The exact provenance and edition of these specific transcriptions is not documented in the repository. Confirm the transcription rights for each included melody, or replace the ones you cannot verify, before distributing MusikFlo commercially.',
      },
      {
        heading: 'No audio recordings',
        paragraphs: [
          'MusikFlo ships no recorded audio. Every instrument is a synthesiser built from a small voice definition — oscillator partials, an amplitude envelope, a filter sweep, and for the flutes a little breath noise. Live playback and WAV export use the same voice definitions, so the exported audio matches the instrument you selected.',
          'Because nothing is sampled, there are no sample-library or recording-performance rights to clear for playback or WAV export.',
        ],
      },
    ],
  },

  accessibility: {
    route: 'accessibility',
    title: 'Accessibility',
    summary: 'The accessibility support MusikFlo currently implements, and where it still falls short.',
    sections: [
      {
        heading: 'What is implemented',
        bullets: [
          'Every toolbar, palette and transport control is a real button or input with an accessible name, and the active entry tool and toggles expose their pressed state.',
          'Focus is visible on all interactive elements, and the score canvas, palette, inspector and transport can be reached and operated from the keyboard.',
          'Keyboard support includes pitch stepping, deletion of the selected event, undo and redo, measure duplication, copy and paste, and spacebar transport control.',
          'The light and dark themes are both designed for contrast, and staff lines, notes, ledger lines, barlines and rests remain visible in either theme.',
          'The audio-to-sheet-music flow is keyboard operable end to end: the file chooser is a button, processing status is announced, and progress is exposed as a progress bar with a text value rather than colour alone.',
          'The landing page respects the prefers-reduced-motion setting and suppresses entrance animation and decorative movement when it is enabled.',
          'The score, palette and inspector reflow for tablet and mobile widths with collapsible panels, and colour is never the only signal: selection also uses outlines and labels.',
        ],
      },
      {
        heading: 'Known limitations',
        bullets: [
          'The score canvas is rendered notation. Placing a note precisely on a staff position is fundamentally a pointing task, and there is no fully equivalent text-based note-entry mode yet.',
          'A screen reader can read the controls and the selected note\'s pitch, duration and accidental, but it cannot yet announce the full contents of a score as structured music.',
          'The playback timeline is shown visually; only transport state is currently exposed to assistive technology.',
        ],
      },
      {
        heading: 'Feedback',
        paragraphs: [
          'Accessibility reports, suggestions, and feedback are always welcome. Please email us at zetaaztratech@gmail.com with your feedback.',
        ],
      },
    ],
  },

  security: {
    route: 'security',
    title: 'Security',
    summary: 'MusikFlo is a client-side application. This page describes its actual security posture.',
    sections: [
      {
        heading: 'How the application is built',
        bullets: [
          'MusikFlo runs entirely in your browser as static HTML, CSS and JavaScript. There is no MusikFlo application server, no database server and no API that receives your work.',
          'There is no authentication, no session and no user account, so there are no credentials to leak or reset.',
          'Audio is synthesised locally with the Web Audio API, and every export format is generated locally on your device.',
          'Audio transcription runs locally too. The recording you choose is decoded and analysed in the page, and its bytes are never sent anywhere. Only the transcription runtime and model files are downloaded, from this site.',
          'Audio-to-sheet-music processing is bounded by explicit file-size and duration limits, and only one transcription runs at a time, so a single clip cannot exhaust the tab.',
        ],
      },
      {
        heading: 'Local data and its boundaries',
        bullets: [
          'Scores are stored in IndexedDB, with a localStorage fallback. This storage is scoped to the site origin and to your browser profile.',
          'Locally stored scores are not encrypted by MusikFlo. Anyone who can use your browser profile, or any script running on the same origin, can read them.',
          'Exported .musikflo files are plain, human-readable JSON containing your title, composer and score data.',
        ],
      },
      {
        heading: 'Reducing risk',
        bullets: [
          'Downloaded files go through your browser\'s normal download handling; scan them as you would any other file.',
          'Because MusikFlo is a static site, the most meaningful hardening is at the hosting layer: serve over HTTPS, keep the dependency tree current, and consider a Content-Security-Policy that restricts script and font origins.',
        ],
      },
      {
        heading: 'No external audit',
        paragraphs: [
          'MusikFlo has not undergone an independent security audit or penetration test, and this page makes no such claim. The statements above describe the implementation as it exists in this repository.',
        ],
        callout:
          'If you deploy a hosted instance, verify your own hosting provider\'s TLS, header and logging configuration. Those controls are outside the application source and are not covered by anything on this page.',
      },
    ],
  },
};
