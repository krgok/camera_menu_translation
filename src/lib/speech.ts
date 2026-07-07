// Thin wrapper around the Web Speech API. Not every browser implements
// speechSynthesis (notably some WebViews), so callers must check
// isSupported() before rendering a read-aloud control.

export type SpeechRate = 1 | 1.5 | 2;

export const SPEECH_RATES: SpeechRate[] = [1, 1.5, 2];

const RATE_KEY = "speech-rate";

export function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function loadSpeechRate(): SpeechRate {
  try {
    const raw = Number(localStorage.getItem(RATE_KEY));
    return SPEECH_RATES.includes(raw as SpeechRate) ? (raw as SpeechRate) : 1;
  } catch {
    return 1;
  }
}

export function saveSpeechRate(rate: SpeechRate): void {
  try {
    localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    // Storage unavailable — the rate just won't persist across reloads.
  }
}

export function speak(
  text: string,
  onEnd?: () => void,
  rate: SpeechRate = 1,
): void {
  if (!isSupported()) return;
  // Cancel any in-flight utterance first — overlapping speech is worse than
  // interrupting it.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = rate;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}

export function stop(): void {
  if (!isSupported()) return;
  window.speechSynthesis.cancel();
}
