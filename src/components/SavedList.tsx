import { useEffect, useState } from "react";
import { supabase, type SavedItem } from "../lib/supabase";
import { useSpeechController } from "../hooks/useSpeechController";
import { SpeechRateSwitch } from "./SpeechRateSwitch";
import { PointOrderModal } from "./PointOrderModal";
import { safeReferenceUrl, safeThumbnailSrc } from "../lib/safeUrl";

export function SavedList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    const { data, error } = await supabase
      .from("saved_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(`保存済みの読み込みに失敗しました: ${error.message}`);
    } else if (data) {
      setItems(data as SavedItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("saved_items").delete().eq("id", id);
    if (error) {
      setLoadError(`削除に失敗しました: ${error.message}`);
      return;
    }
    setLoadError(null);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (loading) return <p role="status">読み込み中...</p>;
  if (items.length === 0 && loadError) {
    return (
      <div className="camera-error-box" role="alert">
        <p className="camera-error">{loadError}</p>
        <button onClick={load}>再読み込み</button>
      </div>
    );
  }
  if (items.length === 0) return <p>保存した説明はまだありません。</p>;

  return (
    <>
      {loadError && (
        <p className="camera-error" role="alert">
          {loadError}
        </p>
      )}
      <ul className="saved-list">
        {items.map((item) => (
          <li key={item.id} className="saved-list-item">
            <div className="saved-list-row">
              {safeThumbnailSrc(item.thumbnail_url) && (
                <img
                  src={safeThumbnailSrc(item.thumbnail_url)!}
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
                      {item.reference_links.map((ref, refIndex) => {
                        const href = safeReferenceUrl(ref.url);
                        return (
                          <li key={refIndex}>
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer">
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
          language={pointOrderItem.source_language}
          onClose={() => setPointOrderItem(null)}
        />
      )}
    </>
  );
}
