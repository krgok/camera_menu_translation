import { useEffect, useState } from "react";
import { supabase, type SavedItem } from "../lib/supabase";
import {
  isSupported,
  loadSpeechRate,
  saveSpeechRate,
  speak,
  stop,
  type SpeechRate,
} from "../lib/speech";
import { SpeechRateSwitch } from "./SpeechRateSwitch";

export function SavedList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [titleSpeakingId, setTitleSpeakingId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<SpeechRate>(loadSpeechRate);
  const speechSupported = isSupported();

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

  useEffect(() => {
    return () => stop();
  }, []);

  const remove = async (id: string) => {
    await supabase.from("saved_items").delete().eq("id", id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleSpeak = (item: SavedItem) => {
    if (speakingId === item.id) {
      stop();
      setSpeakingId(null);
      return;
    }
    // speak() cancels the other utterance; clear its button state too.
    setTitleSpeakingId(null);
    setSpeakingId(item.id);
    speak(
      `${item.dish_name}。${item.explanation}`,
      () => {
        setSpeakingId((current) => (current === item.id ? null : current));
      },
      speechRate,
    );
  };

  // Title-only readout is always rate 1 — it's a short phrase, and applying
  // the explanation-speed setting to it just makes names hard to catch.
  const toggleTitleSpeak = (item: SavedItem) => {
    if (titleSpeakingId === item.id) {
      stop();
      setTitleSpeakingId(null);
      return;
    }
    setSpeakingId(null);
    setTitleSpeakingId(item.id);
    speak(
      item.dish_name,
      () => {
        setTitleSpeakingId((current) => (current === item.id ? null : current));
      },
      1,
    );
  };

  // Applies from the next utterance — an in-flight one keeps its rate.
  const changeRate = (rate: SpeechRate) => {
    setSpeechRate(rate);
    saveSpeechRate(rate);
  };

  if (loading) return <p>読み込み中...</p>;
  if (items.length === 0) return <p>保存した説明はまだありません。</p>;

  return (
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
                {speechSupported && (
                  <button
                    className="title-speak"
                    aria-label={
                      titleSpeakingId === item.id
                        ? "読み上げを停止"
                        : "名前を読み上げ"
                    }
                    onClick={() => toggleTitleSpeak(item)}
                  >
                    {titleSpeakingId === item.id ? "⏹" : "🔊"}
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
                {speechSupported && (
                  <>
                    <button
                      className="item-list-speak"
                      onClick={() => toggleSpeak(item)}
                    >
                      {speakingId === item.id ? "⏹ 停止" : "🔊 読み上げ"}
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
  );
}
