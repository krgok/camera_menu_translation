// Thin wrapper around the Web Speech API. Not every browser implements
// speechSynthesis (notably some WebViews), so callers must check
// isSupported() before rendering a read-aloud control.

export function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(
  text: string,
  onEnd?: () => void,
): void {
  if (!isSupported()) return;
  // Cancel any in-flight utterance first — overlapping speech is worse than
  // interrupting it.
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
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
