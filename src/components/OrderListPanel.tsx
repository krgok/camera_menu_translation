import { useState } from "react";
import { SURCHARGE_PRESETS, computeTotals, type OrderLine, type SurchargePreset } from "../lib/order";
import { formatYen, toYen, useRates } from "../lib/currency";
import { shareOrDownload } from "../lib/download";

interface Props {
  lines: OrderLine[];
  preset: SurchargePreset;
  onQty: (id: string, qty: number) => void;
  onClear: () => void;
  onPreset: (id: string) => void;
  onClose: () => void;
}

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Order list: quantities, estimated total with service charge/VAT, "show to staff". */
export function OrderListPanel({ lines, preset, onQty, onClear, onPreset, onClose }: Props) {
  const rates = useRates();
  const [staffView, setStaffView] = useState(false);
  const totals = computeTotals(lines, preset);

  const exportText = () => {
    const out = ["注文リスト(概算)", "=".repeat(30)];
    for (const l of lines) {
      const price =
        l.unit !== undefined ? ` @ ${money(l.unit)}${l.currency ? ` ${l.currency}` : ""}${l.label ? `(${l.label})` : ""}` : "";
      out.push(`${l.qty} × ${l.name}${l.original ? ` / ${l.original}` : ""}${price}`);
    }
    for (const t of totals.byCurrency) {
      out.push(
        "",
        `合計${t.currency ? ` ${t.currency}` : ""}: ${money(t.total)}(小計 ${money(t.subtotal)}${t.service ? ` + サービス料 ${money(t.service)}` : ""}${t.vat ? ` + VAT ${money(t.vat)}` : ""})`,
      );
    }
    if (totals.unpriced > 0) out.push(`※ 価格不明の項目が ${totals.unpriced} 件あり、合計に含まれません`);
    out.push("※ 概算です。実際の請求額はお店でご確認ください");
    const blob = new Blob([String.fromCharCode(0xfeff) + out.join("\r\n")], { type: "text/plain;charset=utf-8" });
    void shareOrDownload(blob, "order-list.txt", "注文リスト");
  };

  if (staffView) {
    return (
      <div
        className="point-order-modal"
        role="dialog"
        aria-label="店員さんに見せる注文リスト"
        onClick={() => setStaffView(false)}
      >
        <button
          className="point-order-close"
          aria-label="閉じる"
          onClick={(e) => {
            e.stopPropagation();
            setStaffView(false);
          }}
        >
          ✕
        </button>
        <ul className="staff-order-list">
          {lines.map((l) => (
            <li key={l.id}>
              <span className="staff-order-name">{l.original || l.name}</span>
              <span className="staff-order-qty">× {l.qty}</span>
              {l.label && <span className="staff-order-label">({l.label})</span>}
            </li>
          ))}
        </ul>
        <div className="point-order-hint">背景をタップで閉じる</div>
      </div>
    );
  }

  return (
    <div className="order-panel" role="dialog" aria-label="注文リスト">
      <div className="order-panel-head">
        <h2>🧾 注文リスト</h2>
        <button onClick={onClose} aria-label="閉じる">
          ✕
        </button>
      </div>
      {lines.length === 0 ? (
        <p className="app-hint">
          スキャン結果の料理で「🧾 注文リストへ」を押すと、ここに追加されます。
        </p>
      ) : (
        <>
          <ul className="order-lines">
            {lines.map((l) => (
              <li key={l.id}>
                <div className="order-line-name">
                  {l.name}
                  {l.label && <span className="order-line-label"> ({l.label})</span>}
                  <div className="order-line-price">
                    {l.unit !== undefined
                      ? `${money(l.unit)}${l.currency ? ` ${l.currency}` : ""}`
                      : "価格不明"}
                  </div>
                </div>
                <div className="order-qty" role="group" aria-label={`${l.name}の数量`}>
                  <button aria-label="減らす" onClick={() => onQty(l.id, l.qty - 1)}>
                    −
                  </button>
                  <span aria-live="polite">{l.qty}</span>
                  <button aria-label="増やす" onClick={() => onQty(l.id, l.qty + 1)}>
                    ＋
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <label className="order-surcharge">
            加算
            <select value={preset.id} onChange={(e) => onPreset(e.target.value)}>
              {SURCHARGE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {totals.byCurrency.map((t) => {
            const yen = t.currency ? toYen(t.total, t.currency, rates) : null;
            return (
              <div key={t.currency || "?"} className="order-total">
                <div className="order-total-main">
                  合計 {money(t.total)} {t.currency || "(通貨不明)"}
                  {yen !== null && t.currency !== "JPY" && <span> ≒ {formatYen(yen)}</span>}
                </div>
                {(t.service > 0 || t.vat > 0) && (
                  <div className="order-total-detail">
                    小計 {money(t.subtotal)}
                    {t.service > 0 && ` + サービス料 ${money(t.service)}`}
                    {t.vat > 0 && ` + VAT ${money(t.vat)}`}
                  </div>
                )}
              </div>
            );
          })}
          {totals.unpriced > 0 && (
            <p className="context-hint-note">
              価格が読み取れなかった項目が {totals.unpriced} 件あり、合計に含まれません。
            </p>
          )}
          <p className="context-hint-note">
            ※ 概算です。価格の読み取りや為替レート、税・サービス料の有無で実際の請求額とは異なります。
          </p>

          <div className="order-actions">
            <button onClick={() => setStaffView(true)}>👉 店員さんに見せる</button>
            <button onClick={exportText}>📄 テキストで共有</button>
            <button
              onClick={() => {
                if (confirm("注文リストを空にしますか?")) onClear();
              }}
            >
              全部消す
            </button>
          </div>
        </>
      )}
    </div>
  );
}
