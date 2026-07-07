import type { MenuItem } from "../lib/types";

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
  if (items.length === 0) return null;

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
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
