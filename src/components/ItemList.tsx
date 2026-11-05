import { useState } from "react";
import type { MenuItem } from "../lib/types";
import { useSpeechController } from "../hooks/useSpeechController";
import { formatPrice, useRates } from "../lib/currency";
import { safeReferenceUrl } from "../lib/safeUrl";
import { SpeechRateSwitch } from "./SpeechRateSwitch";
import { PointOrderModal } from "./PointOrderModal";
import { RISK_INFO, summarizeRisks } from "../lib/diet";
import type { IngredientKey } from "../lib/phrases";

interface Props {
  items: MenuItem[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
  onSave: (item: MenuItem) => void;
  savedNames: Set<string>;
  explainingIndex: number | null;
  // "Show all explanations" mode: every row renders expanded.
  expandAll: boolean;
  explainingAll: boolean;
  profileAllergens?: IngredientKey[];
}

export function ItemList({
  items,
  activeIndex,
  onSelect,
  onSave,
  savedNames,
  explainingIndex,
  expandAll,
  explainingAll,
  profileAllergens,
}: Props) {
  const rates = useRates();
  const {
    speechSupported,
    speechRate,
    speakingKey,
    titleSpeakingKey,
    toggleSpeak,
    toggleOriginalSpeak,
    changeRate,
  } = useSpeechController();
  const [pointOrderItem, setPointOrderItem] = useState<MenuItem | null>(null);

  if (items.length === 0) return null;

  const risks = summarizeRisks(items);
  const flagged = risks.high + risks.medium + risks.unknown;

  return (
    <>
      {(flagged > 0 || risks.low > 0) && (
        <p className="risk-summary" role="status">
          あなたの制限(食事制限・アレルギー)の確認:
          {risks.high > 0 && ` 🚫要注意${risks.high}件`}
          {risks.medium > 0 && ` ⚠注意${risks.medium}件`}
          {risks.unknown > 0 && ` ？不明${risks.unknown}件`}
          {risks.low > 0 && ` ✓たぶん大丈夫${risks.low}件`}
        </p>
      )}
      <ul className="item-list">
        {items.map((item, i) => {
          const key = String(i);
          const active = expandAll || activeIndex === i;
          const saved = savedNames.has(item.name);
          return (
            <li
              key={`${item.name}-${i}`}
              id={`item-row-${i}`}
              className={`item-list-row ${active ? "active" : ""}`}
              onClick={() => onSelect(i)}
            >
              <span className="item-list-number">{i + 1}</span>
              <div className="item-list-body">
                <div className="item-list-title">
                  {item.name}
                  {item.risk ? (
                    <span className={`risk-badge ${RISK_INFO[item.risk].className}`}>
                      {RISK_INFO[item.risk].icon} {RISK_INFO[item.risk].label}
                    </span>
                  ) : (
                    item.warning && <span className="item-warning-badge">⚠</span>
                  )}
                  {speechSupported && item.original_text && (
                    <button
                      className="title-speak"
                      aria-label={
                        titleSpeakingKey === key
                          ? "読み上げを停止"
                          : "原文を読み上げ"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOriginalSpeak(
                          key,
                          item.original_text!,
                          item.source_language,
                        );
                      }}
                    >
                      {titleSpeakingKey === key ? "⏹" : "🔊"}
                    </button>
                  )}
                </div>
                {typeof item.price === "number" && (
                  <div className="item-list-price">
                    {formatPrice(item.price, item.currency, rates)}
                  </div>
                )}
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
                    {item.warning && (
                      <div className="item-warning">
                        ⚠ {item.warning}
                        <span className="item-warning-note">(AIの推定です。アレルギーは必ずお店の人に確認を)</span>
                      </div>
                    )}
                    {item.explanation ? (
                      <div className="item-list-explanation">
                        {item.explanation}
                      </div>
                    ) : (
                      <div className="item-list-explanation item-list-loading">
                        {explainingIndex === i || explainingAll
                          ? "説明を読み込み中..."
                          : "説明を取得できませんでした"}
                      </div>
                    )}
                    {item.explanation && item.references && item.references.length > 0 && (
                      <div className="item-references">
                        <span className="item-references-label">参考リンク:</span>
                        <ul>
                          {item.references.map((ref, refIndex) => {
                            const href = safeReferenceUrl(ref.url);
                            return (
                              <li key={refIndex}>
                                {href ? (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {ref.title}
                                  </a>
                                ) : (
                                  ref.title
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <div className="item-list-actions">
                      {item.original_text && (
                        <button
                          className="item-list-point"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPointOrderItem(item);
                          }}
                        >
                          👉 指差し注文
                        </button>
                      )}
                      {item.explanation && speechSupported && (
                        <>
                          <button
                            className="item-list-speak"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSpeak(
                                key,
                                `${item.name}。${item.explanation ?? ""}`,
                              );
                            }}
                          >
                            {speakingKey === key ? "⏹ 停止" : "🔊 読み上げ"}
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
      {pointOrderItem?.original_text && (
        <PointOrderModal
          originalText={pointOrderItem.original_text}
          name={pointOrderItem.name}
          language={pointOrderItem.source_language}
          price={pointOrderItem.price}
          currency={pointOrderItem.currency}
          profileAllergens={profileAllergens}
          onClose={() => setPointOrderItem(null)}
        />
      )}
    </>
  );
}
