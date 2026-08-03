import { useEffect, useState } from "react";
import { supabase, type SavedItem } from "../lib/supabase";
import { useSpeechController } from "../hooks/useSpeechController";
import { SpeechRateSwitch } from "./SpeechRateSwitch";
import { PointOrderModal } from "./PointOrderModal";

export function SavedList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointOrderItem, setPointOrderItem] = useState<SavedItem | null>(null);
  const {
    speechSupported,
    speechRate,
    speakingKey,
    titleSpeakingKey,
    toggleSpeak,
    toggleOriginalSpeak,
    changeRate,
  } = useSpeechController();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as SavedItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    await supabase.from("saved_items").delete().eq("id", id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (loading) return <p>読み込み中...</p>;
  if (items.length === 0) return <p>保存した説明はまだありません。</p>;

  return (
    <>
      <ul className="saved-list">
        {items.map((item) => (
          <li key={item.id} className="saved-list-item">
            <div className="saved-list-row">
              {item.thumbnail_url && (
                <img
                  src={item.thumbnail_url}
                  alt={item.dish_name}
                  className="saved-list-thumb"
                />
              )}
              <div className="saved-list-body">
                <div className="saved-list-title">
                  <span className="saved-list-mode-badge">
                    {item.mode === "museum" ? "博物館" : "メニュー"}
                  </span>
                  {item.dish_name}
                  {speechSupported && item.original_text && (
                    <button
                      className="title-speak"
                      aria-label={
                        titleSpeakingKey === item.id
                          ? "読み上げを停止"
                          : "原文を読み上げ"
                      }
                      onClick={() =>
                        toggleOriginalSpeak(
                          item.id,
                          item.original_text!,
                          item.source_language,
                        )
                      }
                    >
                      {titleSpeakingKey === item.id ? "⏹" : "🔊"}
                    </button>
                  )}
                  {item.source_language && (
                    <span className="saved-list-lang">{item.source_language}</span>
                  )}
                </div>
                {item.original_text && (
                  <div className="saved-list-original">
                    {item.original_text}
                    {item.pronunciation && (
                      <span className="item-list-ipa">[{item.pronunciation}]</span>
                    )}
                  </div>
                )}
                <div className="saved-list-explanation">{item.explanation}</div>
                {item.reference_links && item.reference_links.length > 0 && (
                  <div className="item-references">
                    <span className="item-references-label">参考リンク:</span>
                    <ul>
                      {item.reference_links.map((ref, refIndex) => (
                        <li key={refIndex}>
                          <a href={ref.url} target="_blank" rel="noopener noreferrer">
                            {ref.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="item-list-actions">
                  {item.original_text && (
                    <button
                      className="item-list-point"
                      onClick={() => setPointOrderItem(item)}
                    >
                      👉 指差し注文
                    </button>
                  )}
                  {speechSupported && (
                    <>
                      <button
                        className="item-list-speak"
                        onClick={() =>
                          toggleSpeak(
                            item.id,
                            `${item.dish_name}。${item.explanation}`,
                          )
                        }
                      >
                        {speakingKey === item.id ? "⏹ 停止" : "🔊 読み上げ"}
                      </button>
                      <SpeechRateSwitch rate={speechRate} onChange={changeRate} />
                    </>
                  )}
                  <button onClick={() => remove(item.id)}>削除</button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {pointOrderItem?.original_text && (
        <PointOrderModal
          originalText={pointOrderItem.original_text}
          name={pointOrderItem.dish_name}
          onClose={() => setPointOrderItem(null)}
        />
      )}
    </>
  );
}
