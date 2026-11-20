/**
 * Short confirmation sounds, made with the Web Audio API (no sound files).
 *
 * The tones sit above the strings' range, and the tuner ignores the microphone while one plays
 * (see `chimePlaying`), so a chime heard through the speakers doesn't show up as a note.
 */

let ctx: AudioContext | null = null;
let quietUntil = 0;

/** True while a chime is sounding (plus a short tail), so the tuner can skip those frames. */
export function chimePlaying(now = Date.now()): boolean {
  return now < quietUntil;
}

function hold(seconds: number) {
  quietUntil = Math.max(quietUntil, Date.now() + seconds * 1000 + 150);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** One soft bell tone: a quick attack and a gentle fade, with a quiet overtone for shimmer. */
function bell(c: AudioContext, frequency: number, at: number, length = 0.45, volume = 0.16) {
  const out = c.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(volume, at + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, at + length);
  out.connect(c.destination);
  for (const [mult, level] of [[1, 1], [2.76, 0.18]] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency * mult;
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

/** A string is in tune: two quick rising notes. */
export function playStringTuned() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  hold(0.6);
  bell(c, 1568, t, 0.3); // G6
  bell(c, 2093, t + 0.09, 0.5); // C7
}

/** Every string is in tune: a short rising arpeggio. */
export function playAllTuned() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.01;
  hold(1.2);
  [1568, 2093, 2637, 3136].forEach((f, i) => bell(c, f, t + i * 0.1, i === 3 ? 0.9 : 0.35, 0.14));
}
