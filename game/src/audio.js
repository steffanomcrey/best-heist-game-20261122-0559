// Audio: tiny WebAudio synth, no sound files. Created on the first user gesture;
// every call is safe before that (a no-op). Footsteps, pickup chime, alarm
// swell, laser zap, tool puff, caught sting, getaway fanfare.
export function createAudio() {
  let ctx = null;
  let alarmOsc = null;
  let alarmGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function beep(freq, dur, type, vol, when = 0) {
    const c = ensure();
    if (!c) return;
    try {
      const t = c.currentTime + when;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }

  return {
    unlock() { ensure(); },
    footstep() { beep(90 + Math.random() * 30, 0.05, 'triangle', 0.03); },
    pickup() { beep(660, 0.09, 'sine', 0.12); beep(990, 0.14, 'sine', 0.1, 0.08); },
    laser() { beep(220, 0.18, 'sawtooth', 0.12); beep(110, 0.22, 'sawtooth', 0.1, 0.05); },
    tool() { beep(330, 0.12, 'triangle', 0.1); beep(220, 0.16, 'triangle', 0.08, 0.06); },
    caught() { beep(440, 0.3, 'sawtooth', 0.14); beep(311, 0.5, 'sawtooth', 0.14, 0.22); },
    levelDone() { [523, 659, 784].forEach((f, i) => beep(f, 0.16, 'sine', 0.12, i * 0.11)); },
    win() { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'sine', 0.12, i * 0.13)); },
    setAlarm(level) {
      const c = ensure();
      if (!c) return;
      try {
        if (level < 0.35) {
          if (alarmOsc) { alarmOsc.stop(); alarmOsc = null; alarmGain = null; }
          return;
        }
        if (!alarmOsc) {
          alarmOsc = c.createOscillator();
          alarmGain = c.createGain();
          alarmOsc.type = 'sine';
          alarmOsc.frequency.value = 620;
          alarmGain.gain.value = 0;
          alarmOsc.connect(alarmGain).connect(c.destination);
          alarmOsc.start();
        }
        alarmGain.gain.setTargetAtTime(0.02 + 0.05 * level, c.currentTime, 0.1);
        alarmOsc.frequency.setTargetAtTime(620 + 240 * level, c.currentTime, 0.1);
      } catch { /* ignore */ }
    },
  };
}
