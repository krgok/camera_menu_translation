import { useEffect, useState } from "react";
import { supabase, type SavedItem } from "../lib/supabase";

export function SavedList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

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
                {item.dish_name}
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
              <button onClick={() => remove(item.id)}>削除</button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
