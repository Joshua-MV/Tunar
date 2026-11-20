import { centsBetween, midiToFrequency, midiToNoteName, parseScientificPitch, type Spelling } from './notes';

/**
 * Instruments are described by data (string count, fret count, tunings), so adding bass
 * or ukulele means adding entries here — the tuner, fretboard and voicing code are generic.
 */
export type InstrumentId = 'guitar' | 'electric' | 'bass' | 'ukulele';

export interface Tuning {
  id: string;
  name: string;
  instrument: InstrumentId;
  /**
   * Scientific pitch notation, in the order the strings sit on the instrument (top string,
   * nearest your face, first). That's lowest-pitched first, except re-entrant ukulele (high G).
   */
  notes: readonly string[];
  spelling: Spelling;
}

export interface Instrument {
  id: InstrumentId;
  name: string;
  strings: number;
  frets: number;
  tunings: readonly Tuning[];
}

export const GUITAR_TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard', instrument: 'guitar', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], spelling: 'common' },
  { id: 'drop-d', name: 'Drop D', instrument: 'guitar', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'], spelling: 'common' },
  { id: 'half-down', name: 'Half-step down', instrument: 'guitar', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'], spelling: 'flats' },
  { id: 'full-down', name: 'Full-step down', instrument: 'guitar', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'], spelling: 'common' },
  { id: 'open-g', name: 'Open G', instrument: 'guitar', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'], spelling: 'common' },
  { id: 'open-d', name: 'Open D', instrument: 'guitar', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], spelling: 'common' },
  { id: 'dadgad', name: 'DADGAD', instrument: 'guitar', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'], spelling: 'common' },
  { id: 'drop-c', name: 'Drop C', instrument: 'guitar', notes: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'], spelling: 'common' },
];

/** Electric guitar: same strings and tunings as acoustic, with its own ids so each is remembered. */
export const ELECTRIC_TUNINGS: readonly Tuning[] = GUITAR_TUNINGS.map((t) => ({ ...t, id: `electric-${t.id}`, instrument: 'electric' }));

export const BASS_TUNINGS: readonly Tuning[] = [
  { id: 'bass-standard', name: 'Standard', instrument: 'bass', notes: ['E1', 'A1', 'D2', 'G2'], spelling: 'common' },
  { id: 'bass-drop-d', name: 'Drop D', instrument: 'bass', notes: ['D1', 'A1', 'D2', 'G2'], spelling: 'common' },
  { id: 'bass-half-down', name: 'Half-step down', instrument: 'bass', notes: ['Eb1', 'Ab1', 'Db2', 'Gb2'], spelling: 'flats' },
  { id: 'bass-5', name: '5-string', instrument: 'bass', notes: ['B0', 'E1', 'A1', 'D2', 'G2'], spelling: 'common' },
];

export const UKULELE_TUNINGS: readonly Tuning[] = [
  { id: 'uke-standard', name: 'Standard (high G)', instrument: 'ukulele', notes: ['G4', 'C4', 'E4', 'A4'], spelling: 'common' },
  { id: 'uke-low-g', name: 'Low G', instrument: 'ukulele', notes: ['G3', 'C4', 'E4', 'A4'], spelling: 'common' },
  { id: 'uke-d', name: 'D tuning', instrument: 'ukulele', notes: ['A4', 'D4', 'F#4', 'B4'], spelling: 'common' },
  { id: 'uke-baritone', name: 'Baritone', instrument: 'ukulele', notes: ['D3', 'G3', 'B3', 'E4'], spelling: 'common' },
];

/**
 * If every string is shifted by the same amount from standard tuning, that amount in semitones
 * (half-step down = -1, whole-step down = -2, standard = 0). Chord *shapes* then stay the
 * standard ones and are just named differently. Otherwise null (open/drop tunings change the shapes).
 */
export function uniformShift(tuning: Tuning): number | null {
  const std = tuningStrings(GUITAR_TUNINGS[0]);
  const t = tuningStrings(tuning);
  const d = t[0].midi - std[0].midi;
  return t.every((s, i) => s.midi - std[i].midi === d) ? d : null;
}

export function tuningById(id: string | undefined): Tuning {
  return GUITAR_TUNINGS.find((t) => t.id === id) ?? GUITAR_TUNINGS[0];
}

export const GUITAR: Instrument = { id: 'guitar', name: 'Acoustic', strings: 6, frets: 22, tunings: GUITAR_TUNINGS };
export const ELECTRIC: Instrument = { id: 'electric', name: 'Electric', strings: 6, frets: 24, tunings: ELECTRIC_TUNINGS };
export const BASS: Instrument = { id: 'bass', name: 'Bass', strings: 4, frets: 24, tunings: BASS_TUNINGS };
export const UKULELE: Instrument = { id: 'ukulele', name: 'Ukulele', strings: 4, frets: 18, tunings: UKULELE_TUNINGS };

/** Every instrument the tuner offers, in picker order. */
export const INSTRUMENTS: readonly Instrument[] = [GUITAR, ELECTRIC, BASS, UKULELE];
export const ALL_TUNINGS: readonly Tuning[] = INSTRUMENTS.flatMap((i) => i.tunings);

/** Any instrument's tuning by id; unknown ids fall back to standard acoustic guitar. */
export function anyTuningById(id: string | undefined): Tuning {
  return ALL_TUNINGS.find((t) => t.id === id) ?? GUITAR_TUNINGS[0];
}

export function instrumentOf(tuning: Tuning): Instrument {
  return INSTRUMENTS.find((i) => i.id === tuning.instrument) ?? GUITAR;
}

/** A built-in or saved custom tuning by id; unknown ids fall back to standard acoustic guitar. */
export function findTuning(id: string | undefined, custom: readonly Tuning[]): Tuning {
  return custom.find((t) => t.id === id) ?? anyTuningById(id);
}

// ---- Custom tunings ----

/** Lowest and highest notes a custom tuning may use: B0 (a 5-string bass) to C6. */
export const CUSTOM_MIN_MIDI = 23;
export const CUSTOM_MAX_MIDI = 84;
/** How far one string may move from the instrument's standard note, in half-steps. */
export const CUSTOM_MAX_SHIFT = 12;

/** MIDI number of a note like "F#3" (tunings only hold valid notes). */
export function parseNote(note: string): number {
  const midi = parseScientificPitch(note);
  if (midi === null) throw new Error(`Invalid note "${note}"`);
  return midi;
}

/** "F#3" style name for a MIDI note. */
export function noteFromMidi(midi: number): string {
  const { name, octave } = midiToNoteName(midi);
  return `${name}${octave}`;
}

/** The allowed range for one string of a custom tuning, based on where that string usually sits. */
export function customStringRange(standardMidi: number): { min: number; max: number } {
  return {
    min: Math.max(CUSTOM_MIN_MIDI, standardMidi - CUSTOM_MAX_SHIFT),
    max: Math.min(CUSTOM_MAX_MIDI, standardMidi + CUSTOM_MAX_SHIFT),
  };
}

/** Make a saved-tuning record. `id` stays the same when an existing one is edited. */
export function makeCustomTuning(id: string, name: string, instrument: InstrumentId, notes: readonly string[]): Tuning {
  return { id, name: name.trim().slice(0, 40) || 'My tuning', instrument, notes: [...notes], spelling: 'common' };
}

export interface TunedString {
  index: number;
  note: string;
  midi: number;
  frequency: number;
}

export function tuningStrings(tuning: Tuning, a4 = 440): TunedString[] {
  return tuning.notes.map((note, index) => {
    const midi = parseScientificPitch(note);
    if (midi === null) throw new Error(`Invalid note "${note}" in tuning ${tuning.id}`);
    return { index, note, midi, frequency: midiToFrequency(midi, a4) };
  });
}

/** Index of the string whose open pitch is closest (in cents) to the frequency. */
export function closestString(strings: readonly TunedString[], frequency: number): TunedString {
  let best = strings[0];
  let bestDistance = Infinity;
  for (const s of strings) {
    const d = Math.abs(centsBetween(frequency, s.frequency));
    if (d < bestDistance) {
      best = s;
      bestDistance = d;
    }
  }
  return best;
}
