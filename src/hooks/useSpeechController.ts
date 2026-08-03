import { useEffect, useState } from "react";
import {
  isSupported,
  loadSpeechRate,
  saveSpeechRate,
  speak,
  stop,
  type SpeechRate,
} from "../lib/speech";

/**
 * Shared TTS control state for a list of items, keyed by any string id
 * (index or DB id). Extracted because ItemList and SavedList had two
 * byte-identical ~50-line copies of this logic.
 */
export function useSpeechController() {
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [titleSpeakingKey, setTitleSpeakingKey] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<SpeechRate>(loadSpeechRate);
  const speechSupported = isSupported();

  // Stop any ongoing speech when the owning list unmounts.
  useEffect(() => {
    return () => stop();
  }, []);

  const toggleSpeak = (key: string, text: string) => {
    if (speakingKey === key) {
      stop();
      setSpeakingKey(null);
      return;
    }
    // speak() cancels the other utterance; clear its button state too.
    setTitleSpeakingKey(null);
    setSpeakingKey(key);
    speak(
      text,
      () => {
        setSpeakingKey((current) => (current === key ? null : current));
      },
      speechRate,
    );
  };

  // Reads the original text aloud in its source language (IPA text doesn't
  // TTS well, so this is how a traveler hears the native pronunciation).
  // Always rate 1 — a foreign phrase sped up is even harder to catch.
  const toggleOriginalSpeak = (
    key: string,
    originalText: string,
    sourceLanguage?: string | null,
  ) => {
    if (titleSpeakingKey === key) {
      stop();
      setTitleSpeakingKey(null);
      return;
    }
    setSpeakingKey(null);
    setTitleSpeakingKey(key);
    speak(
      originalText,
      () => {
        setTitleSpeakingKey((current) => (current === key ? null : current));
      },
      1,
      // No source language → let the engine auto-detect (forcing ja-JP would
      // mangle a foreign phrase).
      sourceLanguage ?? null,
    );
  };

  // Applies from the next utterance — an in-flight one keeps its rate.
  const changeRate = (rate: SpeechRate) => {
    setSpeechRate(rate);
    saveSpeechRate(rate);
  };

  return {
    speechSupported,
    speechRate,
    speakingKey,
    titleSpeakingKey,
    toggleSpeak,
    toggleOriginalSpeak,
    changeRate,
  };
}
