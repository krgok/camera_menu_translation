import { useState } from "react";
import {
  DIET_KEYS,
  DIET_LABEL_JA,
  hasAnyRestriction,
  type DietKey,
  type DietProfile,
  type DietState,
} from "../lib/diet";
import { INGREDIENTS, INGREDIENT_ORDER, type IngredientKey } from "../lib/phrases";

interface Props {
  state: DietState;
  active: DietProfile | null;
  disabled?: boolean;
  onSetActive: (id: string | null) => void;
  onAdd: (name: string) => void;
  onUpdate: (id: string, patch: Partial<Omit<DietProfile, "id">>) => void;
  onRemove: (id: string) => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Menu mode only: who is eating (family member profiles) and what they can't
 * or won't eat. The active profile is sent with explanation requests so each
 * dish gets a risk badge; the allergies also surface in the phrase book.
 */
export function DietProfilePanel({
  state,
  active,
  disabled,
  onSetActive,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const [newName, setNewName] = useState("");
  const summary = active
    ? `${active.name}${hasAnyRestriction(active) ? "(制限あり)" : "(制限なし)"}`
    : "未設定";

  return (
    <details className="diet-panel">
      <summary>🥗 食事制限・アレルギー: {summary}</summary>
      <div className="diet-body">
        <div className="diet-row">
          <label>
            使うプロファイル
            <select
              value={state.activeId ?? ""}
              disabled={disabled}
              onChange={(e) => onSetActive(e.target.value || null)}
            >
              <option value="">なし(制限を考慮しない)</option>
              {state.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="diet-row">
          <input
            type="text"
            value={newName}
            maxLength={20}
            placeholder="新しい人の名前(例: 自分、子ども)"
            aria-label="新しいプロファイルの名前"
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            disabled={disabled || state.profiles.length >= 10}
            onClick={() => {
              onAdd(newName || "自分");
              setNewName("");
            }}
          >
            ＋ 追加
          </button>
        </div>

        {active && (
          <>
            <div className="diet-row">
              <input
                type="text"
                value={active.name}
                maxLength={20}
                aria-label="プロファイル名"
                onChange={(e) => onUpdate(active.id, { name: e.target.value })}
              />
              <button
                onClick={() => {
                  if (confirm(`「${active.name}」を削除しますか?`)) onRemove(active.id);
                }}
              >
                削除
              </button>
            </div>

            <fieldset>
              <legend>食事スタイル</legend>
              <div className="diet-chips">
                {DIET_KEYS.map((k: DietKey) => (
                  <label key={k} className="diet-chip">
                    <input
                      type="checkbox"
                      checked={active.diets.includes(k)}
                      onChange={() => onUpdate(active.id, { diets: toggle(active.diets, k) })}
                    />
                    {DIET_LABEL_JA[k]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>アレルギー(少しでも可能性があれば「要注意」)</legend>
              <div className="diet-chips">
                {INGREDIENT_ORDER.map((k: IngredientKey) => (
                  <label key={k} className="diet-chip">
                    <input
                      type="checkbox"
                      checked={active.allergies.includes(k)}
                      onChange={() =>
                        onUpdate(active.id, { allergies: toggle(active.allergies, k) })
                      }
                    />
                    {INGREDIENTS[k].ja}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>苦手な食材(避けたいが、危険ではない)</legend>
              <div className="diet-chips">
                {INGREDIENT_ORDER.map((k: IngredientKey) => (
                  <label key={k} className="diet-chip">
                    <input
                      type="checkbox"
                      checked={active.dislikes.includes(k)}
                      onChange={() =>
                        onUpdate(active.id, { dislikes: toggle(active.dislikes, k) })
                      }
                    />
                    {INGREDIENTS[k].ja}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="context-hint">
              <span className="context-hint-label">その他(自由入力)</span>
              <input
                type="text"
                value={active.free}
                maxLength={100}
                placeholder="例: 生もの、ココナッツミルク"
                onChange={(e) => onUpdate(active.id, { free: e.target.value })}
              />
            </label>
          </>
        )}
        <p className="context-hint-note">
          ※ 判定はAIの推定で、間違うことがあります。重いアレルギーは必ずお店の人に確認してください(💬 フレーズ集から質問できます)。端末内にのみ保存され、サーバーには保存されません。
        </p>
      </div>
    </details>
  );
}
