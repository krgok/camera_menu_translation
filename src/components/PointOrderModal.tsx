import { useEffect, useState } from "react";
import { orderPhraseFor } from "../lib/orderPhrases";
import {
  buildPhrase,
  toPhraseLang,
  type IngredientKey,
  type PhraseLang,
  type PhraseSelection,
} from "../lib/phrases";
import { isSupported, speak, stop } from "../lib/speech";
import { formatPrice, useRates } from "../lib/currency";
import { PhrasePicker } from "./PhrasePicker";

interface Props {
  /** Dish name in the menu's language. Omitted for the stand-alone phrase book. */
  originalText?: string;
  name: string;
  language?: string | null;
  price?: number | null;
  currency?: string | null;
  profileAllergens?: IngredientKey[];
  onClose: () => void;
}

/**
 * Fullscreen "point and order" view: shows the original-language dish name
 * huge so the user can hold their phone up to restaurant staff, plus a
 * phrase the staff can read or hear (order, no cilantro, "does this contain
 * shrimp?", "I'm allergic to ..."). Without `originalText` it is the plain
 * phrase book. Tap the background (or the close button) to close.
 */
export function PointOrderModal({
  originalText,
  name,
  language,
  price,
  currency,
  profileAllergens,
  onClose,
}: Props) {
  const legacy = orderPhraseFor(language);
  const rates = useRates();
  const [lang, setLang] = useState<PhraseLang | null>(() => {
    const fromItem = toPhraseLang(language);
    if (fromItem) return fromItem;
    // Stand-alone phrase book: remembered choice, else Thai.
    if (!originalText) return toPhraseLang(readSaved()) ?? "th";
    return null;
  });
  const [selection, setSelection] = useState<PhraseSelection>({
    kind: "basic",
    key: originalText ? "one" : "bill",
  });

  useEffect(() => () => stop(), []);

  const built = lang ? buildPhrase(lang, selection) : null;
  const text = built?.text ?? legacy.text;
  const ttsLang = lang ?? legacy.lang;
  // "One of this" is about the dish; the other phrases stand on their own.
  const includesDish =
    !!originalText &&
    (!lang || (selection.kind === "basic" && (selection.key === "one" || selection.key === "two")));
  const unsupported = !lang && legacy.fallback;

  const changeLang = (next: PhraseLang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Not persisted — fine.
    }
  };

  return (
    <div
      className="point-order-modal"
      role="dialog"
      aria-label={originalText ? "指差し注文表示" : "注文フレーズ集"}
      onClick={onClose}
    >
      <button
        className="point-order-close"
        aria-label="閉じる"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ✕
      </button>
      {originalText && <div className="point-order-original">{originalText}</div>}
      <div className="point-order-phrase">{text}</div>
      {built && <div className="point-order-gloss">意味: {built.ja}</div>}
      {isSupported() && (
        <button
          className="point-order-speak"
          onClick={(e) => {
            // Don't let the tap bubble to the backdrop and close the modal.
            e.stopPropagation();
            // With an unknown language the dish name would be read with
            // English phonetics, so only the phrase is spoken in that case.
            speak(
              includesDish && !unsupported ? `${originalText}, ${text}` : text,
              undefined,
              1,
              ttsLang,
            );
          }}
        >
          🔊 店員さんに聞かせる
        </button>
      )}
      <PhrasePicker
        lang={lang}
        onLangChange={changeLang}
        selection={selection}
        onSelect={setSelection}
        profileAllergens={profileAllergens}
      />
      {originalText && (
        <div className="point-order-name">
          {name}
          {typeof price === "number" && (
            <span className="point-order-price">
              {" "}
              / {formatPrice(price, currency ?? undefined, rates)}
            </span>
          )}
        </div>
      )}
      {unsupported && (
        <div className="point-order-note">
          (言語が判別できなかったため英語のフレーズを表示しています)
        </div>
      )}
      <div className="point-order-note">
        ※ フレーズは機械的に作成した文面です。重要な内容は現地の方に確認してください。
      </div>
      <div className="point-order-hint">背景をタップで閉じる</div>
    </div>
  );
}

const LANG_KEY = "phrase-lang";
function readSaved(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}
