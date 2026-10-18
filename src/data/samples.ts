import { Score } from '../types/music';

export const SAMPLE_ODE_TO_JOY: Score = {
  id: 'sample-ode-to-joy',
  title: 'Ode to Joy',
  composer: 'Ludwig van Beethoven',
  clef: 'treble',
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: 'C',
  tempo: 112,
  instrument: 'piano',
  createdAt: Date.now() - 100000,
  updatedAt: Date.now() - 100000,
  measures: [
    {
      id: 'm1',
      events: [
        { id: 'n1', step: 'e', octave: 4, duration: '4' },
        { id: 'n2', step: 'e', octave: 4, duration: '4' },
        { id: 'n3', step: 'f', octave: 4, duration: '4' },
        { id: 'n4', step: 'g', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm2',
      events: [
        { id: 'n5', step: 'g', octave: 4, duration: '4' },
        { id: 'n6', step: 'f', octave: 4, duration: '4' },
        { id: 'n7', step: 'e', octave: 4, duration: '4' },
        { id: 'n8', step: 'd', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm3',
      events: [
        { id: 'n9', step: 'c', octave: 4, duration: '4' },
        { id: 'n10', step: 'c', octave: 4, duration: '4' },
        { id: 'n11', step: 'd', octave: 4, duration: '4' },
        { id: 'n12', step: 'e', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm4',
      events: [
        { id: 'n13', step: 'e', octave: 4, duration: '4', dotted: true },
        { id: 'n14', step: 'd', octave: 4, duration: '8' },
        { id: 'n15', step: 'd', octave: 4, duration: '2' },
      ],
    },
  ],
};

export const SAMPLE_MINUET_IN_G: Score = {
  id: 'sample-minuet-g',
  title: 'Minuet in G',
  composer: 'Christian Petzold / J. S. Bach',
  clef: 'treble',
  timeSignature: { numerator: 3, denominator: 4 },
  keySignature: 'G',
  tempo: 120,
  instrument: 'strings',
  createdAt: Date.now() - 200000,
  updatedAt: Date.now() - 200000,
  measures: [
    {
      id: 'm-mg1',
      events: [
        { id: 'mg1', step: 'd', octave: 5, duration: '4' },
        { id: 'mg2', step: 'g', octave: 4, duration: '8' },
        { id: 'mg3', step: 'a', octave: 4, duration: '8' },
        { id: 'mg4', step: 'b', octave: 4, duration: '8' },
        { id: 'mg5', step: 'c', octave: 5, duration: '8' },
      ],
    },
    {
      id: 'm-mg2',
      events: [
        { id: 'mg6', step: 'd', octave: 5, duration: '4' },
        { id: 'mg7', step: 'g', octave: 4, duration: '4' },
        { id: 'mg8', step: 'g', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-mg3',
      events: [
        { id: 'mg9', step: 'e', octave: 5, duration: '4' },
        { id: 'mg10', step: 'c', octave: 5, duration: '8' },
        { id: 'mg11', step: 'd', octave: 5, duration: '8' },
        { id: 'mg12', step: 'e', octave: 5, duration: '8' },
        { id: 'mg13', step: 'f', octave: 5, accidental: '#', duration: '8' },
      ],
    },
    {
      id: 'm-mg4',
      events: [
        { id: 'mg14', step: 'g', octave: 5, duration: '4' },
        { id: 'mg15', step: 'g', octave: 4, duration: '4' },
        { id: 'mg16', step: 'g', octave: 4, duration: '4' },
      ],
    },
  ],
};

export const SAMPLE_LULLABY: Score = {
  id: 'sample-lullaby',
  title: 'Evening Lullaby',
  composer: 'Traditional',
  clef: 'treble',
  timeSignature: { numerator: 3, denominator: 4 },
  keySignature: 'C',
  tempo: 84,
  instrument: 'flute',
  createdAt: Date.now() - 300000,
  updatedAt: Date.now() - 300000,
  measures: [
    {
      id: 'm-l1',
      events: [
        { id: 'l1', step: 'e', octave: 4, duration: '4' },
        { id: 'l2', step: 'e', octave: 4, duration: '4' },
        { id: 'l3', step: 'g', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-l2',
      events: [
        { id: 'l4', step: 'e', octave: 4, duration: '4' },
        { id: 'l5', step: 'e', octave: 4, duration: '4' },
        { id: 'l6', step: 'g', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-l3',
      events: [
        { id: 'l7', step: 'e', octave: 4, duration: '4' },
        { id: 'l8', step: 'g', octave: 4, duration: '4' },
        { id: 'l9', step: 'c', octave: 5, duration: '4' },
      ],
    },
    {
      id: 'm-l4',
      events: [
        { id: 'l10', step: 'b', octave: 4, duration: '2', dotted: true },
      ],
    },
  ],
};

export function createBlankScore(): Score {
  return {
    id: `score-${Date.now()}`,
    title: 'Untitled Composition',
    composer: 'Anonymous',
    clef: 'treble',
    timeSignature: { numerator: 4, denominator: 4 },
    keySignature: 'C',
    tempo: 100,
    instrument: 'piano',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    measures: [
      {
        id: `m-${Date.now()}-1`,
        events: [],
      },
      {
        id: `m-${Date.now()}-2`,
        events: [],
      },
    ],
  };
}

export const SAMPLE_POP_PROGRESSION: Score = {
  id: 'sample-pop-chords',
  title: 'Pop Progression (I - V - vi - IV)',
  composer: 'Modern Pop',
  clef: 'treble',
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: 'C',
  tempo: 120,
  instrument: 'piano',
  createdAt: Date.now() - 400000,
  updatedAt: Date.now() - 400000,
  measures: [
    {
      id: 'm-pop1',
      events: [
        { id: 'pop1', step: 'c', octave: 4, duration: '4' },
        { id: 'pop2', step: 'e', octave: 4, duration: '4' },
        { id: 'pop3', step: 'g', octave: 4, duration: '4' },
        { id: 'pop4', step: 'e', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-pop2',
      events: [
        { id: 'pop5', step: 'g', octave: 4, duration: '4' },
        { id: 'pop6', step: 'd', octave: 4, duration: '4' },
        { id: 'pop7', step: 'b', octave: 3, duration: '4' },
        { id: 'pop8', step: 'd', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-pop3',
      events: [
        { id: 'pop9', step: 'a', octave: 4, duration: '4' },
        { id: 'pop10', step: 'e', octave: 4, duration: '4' },
        { id: 'pop11', step: 'c', octave: 4, duration: '4' },
        { id: 'pop12', step: 'e', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-pop4',
      events: [
        { id: 'pop13', step: 'f', octave: 4, duration: '4' },
        { id: 'pop14', step: 'a', octave: 4, duration: '4' },
        { id: 'pop15', step: 'c', octave: 5, duration: '4' },
        { id: 'pop16', step: 'a', octave: 4, duration: '4' },
      ],
    },
  ],
};

export const SAMPLE_JAZZ_PROGRESSION: Score = {
  id: 'sample-jazz-progression',
  title: 'Autumn ii - V - I Swing',
  composer: 'Jazz Standard',
  clef: 'treble',
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: 'C',
  tempo: 130,
  instrument: 'flute',
  createdAt: Date.now() - 500000,
  updatedAt: Date.now() - 500000,
  measures: [
    {
      id: 'm-jazz1',
      events: [
        { id: 'jz1', step: 'd', octave: 4, duration: '4' },
        { id: 'jz2', step: 'f', octave: 4, duration: '4' },
        { id: 'jz3', step: 'a', octave: 4, duration: '4' },
        { id: 'jz4', step: 'c', octave: 5, duration: '4' },
      ],
    },
    {
      id: 'm-jazz2',
      events: [
        { id: 'jz5', step: 'b', octave: 4, duration: '4' },
        { id: 'jz6', step: 'g', octave: 4, duration: '4' },
        { id: 'jz7', step: 'f', octave: 4, duration: '4' },
        { id: 'jz8', step: 'd', octave: 4, duration: '4' },
      ],
    },
    {
      id: 'm-jazz3',
      events: [
        { id: 'jz9', step: 'e', octave: 4, duration: '4' },
        { id: 'jz10', step: 'g', octave: 4, duration: '4' },
        { id: 'jz11', step: 'b', octave: 4, duration: '4' },
        { id: 'jz12', step: 'd', octave: 5, duration: '4' },
      ],
    },
    {
      id: 'm-jazz4',
      events: [
        { id: 'jz13', step: 'c', octave: 5, accidental: '#', duration: '4' },
        { id: 'jz14', step: 'a', octave: 4, duration: '4' },
        { id: 'jz15', step: 'g', octave: 4, duration: '4' },
        { id: 'jz16', step: 'e', octave: 4, duration: '4' },
      ],
    },
  ],
};

export interface StarterTemplate {
  id: string;
  name: string;
  genre: string;
  tempo: number;
  timeSignature: string;
  description: string;
  getScore: () => Score;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Score',
    genre: 'Custom',
    tempo: 100,
    timeSignature: '4/4',
    description: 'Clean empty staff ready for your own melodies',
    getScore: createBlankScore,
  },
  {
    id: 'ode-to-joy',
    name: 'Ode to Joy',
    genre: 'Classical',
    tempo: 112,
    timeSignature: '4/4',
    description: 'Beethoven’s iconic theme in C Major',
    getScore: () => ({ ...SAMPLE_ODE_TO_JOY, id: `score-${Date.now()}` }),
  },
  {
    id: 'minuet-g',
    name: 'Minuet in G',
    genre: 'Classical / Baroque',
    tempo: 120,
    timeSignature: '3/4',
    description: 'Bach / Petzold dance piece in 3/4 time',
    getScore: () => ({ ...SAMPLE_MINUET_IN_G, id: `score-${Date.now()}` }),
  },
  {
    id: 'pop-chords',
    name: 'Pop Four Chords',
    genre: 'Pop / Modern',
    tempo: 120,
    timeSignature: '4/4',
    description: 'Timeless I - V - vi - IV arpeggiated anthem',
    getScore: () => ({ ...SAMPLE_POP_PROGRESSION, id: `score-${Date.now()}` }),
  },
  {
    id: 'jazz-swing',
    name: 'Autumn ii - V - I',
    genre: 'Jazz Swing',
    tempo: 130,
    timeSignature: '4/4',
    description: 'Classic jazz turnaround progression',
    getScore: () => ({ ...SAMPLE_JAZZ_PROGRESSION, id: `score-${Date.now()}` }),
  },
  {
    id: 'lullaby',
    name: 'Evening Lullaby',
    genre: 'Folk / Traditional',
    tempo: 84,
    timeSignature: '3/4',
    description: 'Gentle, soothing melody in 3/4 time',
    getScore: () => ({ ...SAMPLE_LULLABY, id: `score-${Date.now()}` }),
  },
];

