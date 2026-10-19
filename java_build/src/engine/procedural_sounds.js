// Procedurally generated sound effects, used when no sound file is in the manifest.
// Each generator takes an AudioContext-like object and returns an AudioBuffer.

// One-pole lowpass: cheap enough to run per sample at generation time.
function lowpass(prev, x, cutoff, sampleRate) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  return prev + a * (x - prev);
}

// Gunshot layers, summed then soft-clipped:
//   crack  — very short, bright noise transient (the "snap")
//   body   — lowpassed noise with a quick decay (the "bang")
//   thump  — low sine whose pitch drops fast (the weight)
//   tail   — darker noise that rings out (the room)
//   clip   — optional short mechanical click after the shot (bolt/clip feel)
//   echo   — optional single delayed repeat (a sense of space)
export const GUNSHOT_PROFILES = {
  // The original generic gunshot, used by every weapon without its own profile.
  default: {
    duration: 0.25,
    crackGain: 0.6, crackDecay: 0.004,
    bodyGain: 0.7, bodyDecay: 0.022,
    thumpFrom: 155, thumpTo: 45, thumpSweep: 0.018, thumpGain: 0.8, thumpDecay: 0.05,
    tailGain: 0.25, tailDecay: 0.07,
    clip: null,
    echo: null,
  },
  // Braton: fast automatic rifle (~8.75 shots/s), so the shot is short enough not to
  // smear into the next one. Mechanical clip click and a light echo give it its character.
  // Whip-crack: a very sharp, bright transient with a second 'snap' from the tip,
  // almost no low thump, and a dry tail (no echo).
  braton: {
    duration: 0.12,
    crackCutoff: 3000, crackGain: 1.0, crackDecay: 0.0025,
    bodyGain: 0.25, bodyDecay: 0.008,
    thumpFrom: 220, thumpTo: 90, thumpSweep: 0.01, thumpGain: 0.25, thumpDecay: 0.015,
    tailGain: 0.05, tailDecay: 0.02,
    snap: { at: 0.018, gain: 0.9, decay: 0.002, cutoff: 4000 },
    clip: { at: 0.035, gain: 0.12, decay: 0.006, freq: 900 },
    echo: null,
  },
};

export function createGunshot(ctx, profile = GUNSHOT_PROFILES.default) {
  const p = profile;
  const sr = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.floor(sr * p.duration), sr);
  const data = buffer.getChannelData(0);

  let bodyLp = 0;
  let tailLp = 0;
  let clipLp = 0;
  let crackPrev = 0;
  let snapPrev = 0;
  let phase = 0;
  let clipPhase = 0;

  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = Math.random() * 2 - 1;

    // Crack: noise through a crude highpass (x - lowpass(x)) for brightness.
    crackPrev = lowpass(crackPrev, noise, p.crackCutoff ?? 1200, sr);
    const crack = (noise - crackPrev) * Math.exp(-t / p.crackDecay) * p.crackGain;

    let snap = 0;
    if (p.snap && t >= p.snap.at) {
      snapPrev = lowpass(snapPrev, noise, p.snap.cutoff, sr);
      snap = (noise - snapPrev) * Math.exp(-(t - p.snap.at) / p.snap.decay) * p.snap.gain;
    }

    bodyLp = lowpass(bodyLp, noise, 2500, sr);
    const body = bodyLp * Math.exp(-t / p.bodyDecay) * p.bodyGain;

    const freq = p.thumpTo + (p.thumpFrom - p.thumpTo) * Math.exp(-t / p.thumpSweep);
    phase += (2 * Math.PI * freq) / sr;
    const thump = Math.sin(phase) * Math.exp(-t / p.thumpDecay) * p.thumpGain;

    tailLp = lowpass(tailLp, noise, 600, sr);
    const tail = tailLp * Math.exp(-t / p.tailDecay) * p.tailGain;

    let clip = 0;
    if (p.clip && t >= p.clip.at) {
      const dt = t - p.clip.at;
      clipLp = lowpass(clipLp, noise, 1500, sr);
      clipPhase += (2 * Math.PI * p.clip.freq) / sr;
      const click = clipLp * 0.6 + Math.sin(clipPhase) * 0.4;
      clip = click * Math.exp(-dt / p.clip.decay) * p.clip.gain;
    }

    const mix = crack * 0.6 + snap * 0.6 + body + thump + tail + clip;
    data[i] = Math.tanh(mix * 1.4) * 0.8; // soft clip keeps the peaks punchy, not harsh
  }

  // Echo runs over the finished shot; each repeat feeds the next, so it decays naturally.
  if (p.echo) {
    const d = Math.floor(p.echo.delay * sr);
    for (let i = d; i < data.length; i++) {
      data[i] += data[i - d] * p.echo.gain;
    }
  }
  return buffer;
}

// Parry: metallic 'ting' with a descending pitch.
export function createParry(ctx) {
  const sampleRate = ctx.sampleRate;
  const duration = 0.15;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const freq = 2000 + 1500 * Math.exp(-t * 30); // descending pitch
    const tone = Math.sin(2 * Math.PI * freq * t);
    const decay = Math.exp(-t * 15);
    data[i] = tone * decay * 0.3;
  }
  return buffer;
}

// Countdown tick: a short, bright click (a clock or stopwatch tick).
export function createCountdownTick(ctx) {
  const sr = ctx.sampleRate;
  const duration = 0.04;
  const buffer = ctx.createBuffer(1, Math.floor(sr * duration), sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * 1800 * t);
    data[i] = tone * Math.exp(-t / 0.008) * 0.5;
  }
  return buffer;
}
