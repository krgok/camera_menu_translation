import { useState } from "react";
import {
  BASIC_PHRASE_ORDER,
  INGREDIENTS,
  INGREDIENT_ORDER,
  PHRASE_LANGS,
  type IngredientKey,
  type PhraseKey,
  type PhraseLang,
  type PhraseSelection,
} from "../lib/phrases";

const SHORT: Record<PhraseKey, string> = {
  one: "1つ",
  two: "2つ",
  recommend: "おすすめ",
  notSpicy: "辛くしない",
  lessSpicy: "辛さ控えめ",
  noCilantro: "パクチー抜き",
  takeaway: "持ち帰り",
  water: "お水",
  bill: "お会計",
  vegetarian: "ベジタリアン",
  halal: "ハラール",
  noPork: "豚肉NG",
};

interface Props {
  lang: PhraseLang | null;
  onLangChange: (lang: PhraseLang) => void;
  selection: PhraseSelection;
  onSelect: (sel: PhraseSelection) => void;
  /** Allergens from the active diet profile, offered first for one-tap use. */
  profileAllergens?: IngredientKey[];
}

/** Language switch + phrase chips + "does this contain X / I'm allergic to X". */
export function PhrasePicker({
  lang,
  onLangChange,
  selection,
  onSelect,
  profileAllergens = [],
}: Props) {
  const [ingredient, setIngredient] = useState<IngredientKey>(
    profileAllergens[0] ?? "shrimp",
  );
  const ordered = [
    ...profileAllergens,
    ...INGREDIENT_ORDER.filter((k) => !profileAllergens.includes(k)),
  ];

  return (
    <div className="phrase-picker" onClick={(e) => e.stopPropagation()}>
      <div className="phrase-langs" role="group" aria-label="言語">
        {PHRASE_LANGS.map((l) => (
          <button
            key={l.code}
            className={lang === l.code ? "active" : ""}
            aria-pressed={lang === l.code}
            onClick={() => onLangChange(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="phrase-chips" role="group" aria-label="フレーズ">
        {BASIC_PHRASE_ORDER.map((key) => (
          <button
            key={key}
            disabled={!lang}
            className={
              selection.kind === "basic" && selection.key === key ? "active" : ""
            }
            onClick={() => onSelect({ kind: "basic", key })}
          >
            {SHORT[key]}
          </button>
        ))}
      </div>
      <div className="phrase-ingredient">
        <label>
          食材
          <select
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value as IngredientKey)}
          >
            {ordered.map((k) => (
              <option key={k} value={k}>
                {INGREDIENTS[k].ja}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!lang}
          className={
            selection.kind === "contains" && selection.ingredient === ingredient
              ? "active"
              : ""
          }
          onClick={() => onSelect({ kind: "contains", ingredient })}
        >
          入っていますか?
        </button>
        <button
          disabled={!lang}
          className={
            selection.kind === "allergic" && selection.ingredient === ingredient
              ? "active"
              : ""
          }
          onClick={() => onSelect({ kind: "allergic", ingredient })}
        >
          アレルギーです
        </button>
      </div>
      {!lang && (
        <p className="point-order-note">言語を選ぶとフレーズを切り替えられます</p>
      )}
    </div>
  );
}
