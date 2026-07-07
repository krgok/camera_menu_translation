import { useEffect, useState } from "react";
import type { MenuItem } from "../lib/types";
import {
  isSupported,
  loadSpeechRate,
  saveSpeechRate,
  speak,
  stop,
  type SpeechRate,
} from "../lib/speech";
import { SpeechRateSwitch } from "./SpeechRateSwitch";

interface Props {
  items: MenuItem[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
  onSave: (item: MenuItem) => void;
  savedNames: Set<string>;
  explainingIndex: number | null;
}

export function ItemList({
  items,
  activeIndex,
  onSelect,
  onSave,
  savedNames,
  explainingIndex,
}: Props) {
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [speechRate, setSpeechRate] = useState<SpeechRate>(loadSpeechRate);
  const speechSupported = isSupported();

  // Stop any ongoing speech if the list unmounts or the active item changes.
  useEffect(() => {
    return () => stop();
  }, []);

  if (items.length === 0) return null;

  const toggleSpeak = (index: number, item: MenuItem) => {
    if (speakingIndex === index) {
      stop();
      setSpeakingIndex(null);
      return;
    }
    setSpeakingIndex(index);
    speak(
      `${item.name}。${item.explanation ?? ""}`,
      () => {
        setSpeakingIndex((current) => (current === index ? null : current));
      },
      speechRate,
    );
  };

  // Applies from the next utterance — an in-flight one keeps its rate.
  const changeRate = (rate: SpeechRate) => {
    setSpeechRate(rate);
    saveSpeechRate(rate);
  };

  return (
    <ul className="item-list">
      {items.map((item, i) => {
        const active = activeIndex === i;
        const saved = savedNames.has(item.name);
        return (
          <li
            key={`${item.name}-${i}`}
            className={`item-list-row ${active ? "active" : ""}`}
            onClick={() => onSelect(i)}
          >
            <span className="item-list-number">{i + 1}</span>
            <div className="item-list-body">
              <div className="item-list-title">{item.name}</div>
              {active && (
                <>
                  {item.original_text && (
                    <div className="item-list-original">
                      {item.original_text}
                      {item.pronunciation && (
                        <span className="item-list-ipa">
                          [{item.pronunciation}]
                        </span>
                      )}
                    </div>
                  )}
                  {item.explanation ? (
                    <div className="item-list-explanation">
                      {item.explanation}
                    </div>
                  ) : (
                    <div className="item-list-explanation item-list-loading">
                      {explainingIndex === i
                        ? "説明を読み込み中..."
                        : "説明を取得できませんでした"}
                    </div>
                  )}
                  {item.explanation && item.references && item.references.length > 0 && (
                    <div className="item-references">
                      <span className="item-references-label">参考リンク:</span>
                      <ul>
                        {item.references.map((ref, refIndex) => (
                          <li key={refIndex}>
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ref.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="item-list-actions">
                    {item.explanation && speechSupported && (
                      <>
                        <button
                          className="item-list-speak"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSpeak(i, item);
                          }}
                        >
                          {speakingIndex === i ? "⏹ 停止" : "🔊 読み上げ"}
                        </button>
                        <SpeechRateSwitch rate={speechRate} onChange={changeRate} />
                      </>
                    )}
                    <button
                      className="item-list-save"
                      disabled={saved || !item.explanation}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSave(item);
                      }}
                    >
                      {saved ? "保存済み" : "★ 保存"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
