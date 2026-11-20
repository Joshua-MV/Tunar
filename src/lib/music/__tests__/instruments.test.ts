import { centsBetween } from '../notes';
import {
  ALL_TUNINGS, anyTuningById, BASS_TUNINGS, customStringRange, findTuning, INSTRUMENTS, instrumentOf, makeCustomTuning,
  noteFromMidi, parseNote, tuningStrings, UKULELE_TUNINGS,
} from '../instruments';
import { TunerEngine } from '../tuner';

const SR = 48000;
const N = 4096;

/** Plucked-string-like tone: fundamental plus decaying harmonics. */
function stringTone(freq: number, fundamental = 0.4, offset = 0): Float32Array {
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = (i + offset) / SR;
    let v = fundamental * Math.sin(2 * Math.PI * freq * t);
    for (let k = 2; k <= 8; k++) v += (1 / k) * Math.sin(2 * Math.PI * freq * k * t + k);
    out[i] = 0.3 * v;
  }
  return out;
}

/** Feed a few frames of a tone and return the last reading. */
function listen(engine: TunerEngine, freq: number) {
  let r = null;
  for (let f = 0; f < 6; f++) r = engine.process(stringTone(freq, 0.4, f * 1024), f * 21);
  return r;
}

describe('instruments', () => {
  it('offers acoustic, electric, bass and ukulele', () => {
    expect(INSTRUMENTS.map((i) => i.name)).toEqual(['Acoustic', 'Electric', 'Bass', 'Ukulele']);
  });

  it('gives every tuning a unique id and the right number of strings', () => {
    expect(new Set(ALL_TUNINGS.map((t) => t.id)).size).toBe(ALL_TUNINGS.length);
    for (const t of ALL_TUNINGS) {
      const inst = instrumentOf(t);
      if (t.id === 'bass-5') expect(t.notes).toHaveLength(5);
      else expect(t.notes).toHaveLength(inst.strings);
      expect(() => tuningStrings(t)).not.toThrow();
    }
  });

  it('falls back to standard guitar for an unknown tuning', () => {
    expect(anyTuningById('nope').id).toBe('standard');
    expect(anyTuningById('uke-standard').instrument).toBe('ukulele');
  });
});

describe('custom tunings', () => {
  it('turns notes into MIDI and back', () => {
    for (const n of ['B0', 'E2', 'F#3', 'C4', 'A4', 'C6']) expect(noteFromMidi(parseNote(n))).toBe(n);
  });

  it('lets each string move up to an octave from standard, within B0 to C6', () => {
    expect(customStringRange(parseNote('E2'))).toEqual({ min: parseNote('E1'), max: parseNote('E3') });
    expect(customStringRange(parseNote('B0')).min).toBe(parseNote('B0'));
    expect(customStringRange(parseNote('A4')).max).toBe(parseNote('A5'));
  });

  it('saves a named tuning that the tuner can use', () => {
    const mine = makeCustomTuning('custom-1', '  Open C  ', 'guitar', ['C2', 'G2', 'C3', 'G3', 'C4', 'E4']);
    expect(mine.name).toBe('Open C');
    expect(findTuning('custom-1', [mine])).toBe(mine);
    expect(findTuning('drop-d', [mine]).name).toBe('Drop D');
    const r = (() => {
      const engine = new TunerEngine({ sampleRate: SR, strings: tuningStrings(mine) });
      return listen(engine, 65.41); // C2
    })();
    expect(r!.target!.note).toBe('C2');
    expect(r!.state).toBe('in-tune');
  });

  it('gives an unnamed tuning a name', () => {
    expect(makeCustomTuning('x', '   ', 'bass', ['E1', 'A1', 'D2', 'G2']).name).toBe('My tuning');
  });
});

describe('tuning bass and ukulele', () => {
  it.each([
    ['bass low E (E1, 41 Hz)', 'bass-standard', 41.2, 0],
    ['bass G (G2)', 'bass-standard', 98, 3],
    ['5-string low B (B0, 31 Hz)', 'bass-5', 30.87, 0],
    ['ukulele high G (G4)', 'uke-standard', 392, 0],
    ['ukulele C (C4)', 'uke-standard', 261.63, 1],
    ['ukulele A (A4)', 'uke-standard', 440, 3],
  ])('hears %s and picks the right string', (_name, tuningId, freq, stringIndex) => {
    const strings = tuningStrings(anyTuningById(tuningId));
    const r = listen(new TunerEngine({ sampleRate: SR, strings }), freq);
    expect(r).not.toBeNull();
    expect(r!.target!.index).toBe(stringIndex);
    expect(Math.abs(centsBetween(r!.frequency, freq))).toBeLessThan(3);
    expect(r!.state).toBe('in-tune');
  });

  it('says a flat bass E is flat', () => {
    const strings = tuningStrings(BASS_TUNINGS[0]);
    const r = listen(new TunerEngine({ sampleRate: SR, strings }), 41.2 * 2 ** (-20 / 1200));
    expect(r!.target!.note).toBe('E1');
    expect(r!.state).toBe('flat');
  });

  it('keeps the ukulele strings in playing order (re-entrant high G first)', () => {
    expect(UKULELE_TUNINGS[0].notes).toEqual(['G4', 'C4', 'E4', 'A4']);
  });
});
