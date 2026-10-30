// A soft singing-bowl tone, synthesised so there's no audio file to load.
// Browsers only allow sound after the reader has interacted with the page,
// which turning pages or pressing a button already counts as.

let context: AudioContext | null = null;

// Partials of a small bowl: frequency (Hz), relative loudness, seconds to fade.
const PARTIALS: [number, number, number][] = [
  [528, 1, 4.5],
  [1056, 0.35, 3],
  [1584, 0.15, 2],
];

export function playChime(volume = 0.2) {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);

    for (const [frequency, loudness, fade] of PARTIALS) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(loudness, now + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      oscillator.connect(envelope).connect(master);
      oscillator.start(now);
      oscillator.stop(now + fade + 0.1);
    }
  } catch {
    // No Web Audio (or it's blocked): the chime is a nicety, so stay silent.
  }
}
