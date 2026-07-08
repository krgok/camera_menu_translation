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

// `lang` accepts an ISO 639-1 code ("fr" etc.) — browsers prefix-match it to
// an installed voice. Omitted → "ja-JP" (the app's explanation language).
// Explicit null → leave utterance.lang unset so the engine auto-detects
// (JS can't tell an omitted argument from an explicit undefined, so null is
// the "no language" sentinel).
export function speak(
  text: string,
  onEnd?: () => void,
  rate: SpeechRate = 1,
  lang?: string | null,
): void {
  if (!isSupported()) return;
  // Cancel any in-flight utterance first — overlapping speech is worse than
  // interrupting it.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (lang !== null) {
    utterance.lang = lang ?? "ja-JP";
  }
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
