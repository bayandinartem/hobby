const diceNoiseDurations = [0.11, 0.09, 0.12, 0.08, 0.1, 0.08];

export function createSoundEffects(Context = globalThis.AudioContext ?? globalThis.webkitAudioContext) {
  let context = null;
  let masterGain = null;
  let enabled = true;

  function ensureAudioContext() {
    if (!Context) return null;
    if (!context) {
      context = new Context();
      masterGain = context.createGain();
      masterGain.gain.value = enabled ? 0.65 : 0;
      masterGain.connect(context.destination);
    }
    if (context.state === "suspended") {
      context.resume().catch(error => console.error("Could not resume game audio:", error));
    }
    return context;
  }

  function playTone(frequency, start, duration, peak, type = "sine", endFrequency = frequency) {
    const audioContext = ensureAudioContext();
    if (!enabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function playNoise(start, duration) {
    const audioContext = ensureAudioContext();
    if (!enabled || !audioContext) return;

    const frameCount = Math.ceil(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let frame = 0; frame < frameCount; frame++) {
      samples[frame] = Math.random() * 2 - 1;
    }

    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 1700 + Math.random() * 900;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(start);
    source.stop(start + duration);
  }

  return {
    supported: Boolean(Context),
    setEnabled(value) {
      enabled = Boolean(value) && Boolean(Context);
      if (masterGain && context) {
        const now = context.currentTime;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(enabled ? 0.65 : 0, now, 0.02);
      }
      return enabled;
    },
    playDiceRoll() {
      if (!enabled) return;
      const audioContext = ensureAudioContext();
      if (!audioContext) return;
      let start = audioContext.currentTime;
      for (const duration of diceNoiseDurations) {
        playNoise(start, duration);
        start += duration * 0.86;
      }
      playTone(440, start + 0.05, 0.12, 0.07, "triangle", 660);
    },
    playStep() {
      if (!enabled) return;
      const audioContext = ensureAudioContext();
      if (!audioContext) return;
      const start = audioContext.currentTime;
      playTone(115, start, 0.07, 0.12, "triangle", 75);
      playTone(82, start + 0.015, 0.055, 0.06, "sine", 58);
    },
    playCoins() {
      if (!enabled) return;
      const audioContext = ensureAudioContext();
      if (!audioContext) return;
      const start = audioContext.currentTime;
      playTone(1046.5, start, 0.16, 0.1);
      playTone(1318.5, start + 0.09, 0.19, 0.1);
      playTone(1568, start + 0.18, 0.24, 0.08);
    }
  };
}
