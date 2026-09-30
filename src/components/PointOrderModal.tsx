import { useEffect } from "react";
import { orderPhraseFor } from "../lib/orderPhrases";
import { isSupported, speak, stop } from "../lib/speech";
import { formatPrice, useRates } from "../lib/currency";

interface Props {
  originalText: string;
  name: string;
  language?: string | null;
  price?: number | null;
  currency?: string | null;
  onClose: () => void;
}

/**
 * Fullscreen "point and order" view: shows the original-language dish name
 * huge so the user can hold their phone up to restaurant staff, plus a
 * ready-made "one of this, please" phrase they can play aloud. Tap the
 * background to close.
 */
export function PointOrderModal({
  originalText,
  name,
  language,
  price,
  currency,
  onClose,
}: Props) {
  const phrase = orderPhraseFor(language);
  const rates = useRates();

  useEffect(() => () => stop(), []);

  return (
    <div
      className="point-order-modal"
      role="dialog"
      aria-label="指差し注文表示"
      onClick={onClose}
    >
      <div className="point-order-original">{originalText}</div>
      <div className="point-order-phrase">{phrase.text}</div>
      {isSupported() && (
        <button
          className="point-order-speak"
          onClick={(e) => {
            // Don't let the tap bubble to the backdrop and close the modal.
            e.stopPropagation();
            // With an unknown language the dish name would be read with
            // English phonetics, so only the phrase is spoken in that case.
            speak(
              phrase.fallback ? phrase.text : `${originalText}, ${phrase.text}`,
              undefined,
              1,
              phrase.lang,
            );
          }}
        >
          🔊 店員さんに聞かせる
        </button>
      )}
      <div className="point-order-name">
        {name}
        {typeof price === "number" && (
          <span className="point-order-price">
            {" "}
            / {formatPrice(price, currency ?? undefined, rates)}
          </span>
        )}
      </div>
      {phrase.fallback && (
        <div className="point-order-note">
          (言語が判別できなかったため英語のフレーズを表示しています)
        </div>
      )}
      <div className="point-order-hint">背景をタップで閉じる</div>
    </div>
  );
}
