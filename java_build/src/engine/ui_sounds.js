// Menu sounds for an action game: short and hard-edged, built from clicks, filtered noise and a square-wave blip.
// Generated in code, so they need no audio files. hover: a tick. select: a firm confirm. back: a softer, falling tick.

// Builds a mono buffer from a function of time (seconds) returning a sample in -1..1
function build(ctx, duration, sample) {
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(sr * duration), sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = sample(i / sr);
  return buffer;
}

// Square wave (a hard, buzzy tone) at frequency f
const square = (f, t) => (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1);

// Noise with a one-pole filter whose cutoff sweeps from c0 to c1 (Hz) over the sound: a moving "whoosh" or "tick"
function makeFilteredNoise(sr, duration, c0, c1) {
  let y = 0;
  return (t) => {
    const cutoff = c0 + (c1 - c0) * Math.min(1, t / duration);
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
    y += a * ((Math.random() * 2 - 1) - y);
    return y;
  };
}

export function createUiHover(ctx) {
  const duration = 0.035;
  const noise = makeFilteredNoise(ctx.sampleRate, duration, 6000, 9000);
  return build(ctx, duration, (t) => {
    const click = Math.exp(-t / 0.004) * noise(t) * 1.2;   // sharp transient
    const tone = square(2400, t) * Math.exp(-t / 0.01) * 0.12;
    return click + tone;
  });
}

// Select: the same click and square tick as the hover, but bigger: a longer, lower and louder version of it,
// with a deep body under the click so it hits harder.
export function createUiSelect(ctx) {
  const duration = 0.11;
  const noise = makeFilteredNoise(ctx.sampleRate, duration, 1500, 3000); // darker than the hover click, so no hiss
  return build(ctx, duration, (t) => {
    const click = Math.exp(-t / 0.007) * noise(t) * 1.6;          // the hover click, stronger and darker
    const tick = square(320, t) * Math.exp(-t / 0.03) * 0.15;     // the hover tick, pulled down into the low range
    const body = Math.sin(2 * Math.PI * 110 * t) * Math.exp(-t / 0.045) * 0.55; // deep body for the power
    return (click + tick + body) * 0.6; // a little above the hover level, peak kept under full scale
  });
}

export function createUiBack(ctx) {
  const duration = 0.09;
  const noise = makeFilteredNoise(ctx.sampleRate, duration, 3000, 500);
  return build(ctx, duration, (t) => {
    const tick = Math.exp(-t / 0.012) * noise(t) * 0.8;
    const pitch = 700 - 300 * Math.min(1, t / 0.05);       // falling, lower than select
    const blip = square(pitch, t) * Math.exp(-t / 0.025) * 0.15;
    return tick + blip;
  });
}
