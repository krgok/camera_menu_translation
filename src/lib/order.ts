/**
 * "Order list": dishes the user plans to order, with quantities and an
 * approximate total (menu price + optional service charge + VAT, converted to
 * yen). Kept on this device only. All amounts are estimates.
 */

export interface OrderLine {
  id: string;
  name: string;
  original?: string;
  language?: string;
  unit?: number;
  /** Which price option (size/temperature) was chosen, as printed. */
  label?: string;
  currency?: string;
  qty: number;
}

export interface SurchargePreset {
  id: string;
  label: string;
  servicePct: number;
  vatPct: number;
}

export const SURCHARGE_PRESETS: SurchargePreset[] = [
  { id: "none", label: "加算なし(メニューの価格のみ)", servicePct: 0, vatPct: 0 },
  { id: "vat7", label: "VAT 7% が別途", servicePct: 0, vatPct: 7 },
  { id: "svc10vat7", label: "サービス料 10% + VAT 7% が別途", servicePct: 10, vatPct: 7 },
];

export const MAX_QTY = 99;
export const MAX_LINES = 60;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineKey(l: Pick<OrderLine, "name" | "label" | "unit" | "currency">): string {
  return [l.name, l.label ?? "", l.unit ?? "", l.currency ?? ""].join("\u0001");
}

/** Adds a dish, or bumps the quantity if the same dish+price is already listed. */
export function addLine(lines: OrderLine[], line: Omit<OrderLine, "qty" | "id">): OrderLine[] {
  const key = lineKey(line);
  const existing = lines.find((l) => lineKey(l) === key);
  if (existing) {
    return lines.map((l) => (l === existing ? { ...l, qty: Math.min(MAX_QTY, l.qty + 1) } : l));
  }
  if (lines.length >= MAX_LINES) return lines;
  const id = `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return [...lines, { ...line, id, qty: 1 }];
}

/** Sets a quantity; zero or less removes the line. */
export function setQty(lines: OrderLine[], id: string, qty: number): OrderLine[] {
  if (!Number.isFinite(qty) || qty <= 0) return lines.filter((l) => l.id !== id);
  return lines.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, Math.floor(qty)) } : l));
}

export interface CurrencyTotal {
  /** "" when the currency could not be determined. */
  currency: string;
  subtotal: number;
  service: number;
  vat: number;
  total: number;
}

export interface OrderTotals {
  byCurrency: CurrencyTotal[];
  /** Lines that have no price, so they are not in any total. */
  unpriced: number;
  itemCount: number;
}

/**
 * Service charge is applied to the subtotal, and VAT to (subtotal + service):
 * the usual way a Thai restaurant bill is laid out.
 */
export function computeTotals(lines: OrderLine[], s: Pick<SurchargePreset, "servicePct" | "vatPct">): OrderTotals {
  const groups = new Map<string, number>();
  let unpriced = 0;
  let itemCount = 0;
  for (const l of lines) {
    itemCount += l.qty;
    if (typeof l.unit !== "number" || !Number.isFinite(l.unit)) {
      unpriced += 1;
      continue;
    }
    const cur = l.currency ?? "";
    groups.set(cur, (groups.get(cur) ?? 0) + l.unit * l.qty);
  }
  const byCurrency = [...groups.entries()].map(([currency, sub]) => {
    const subtotal = round2(sub);
    const service = round2((subtotal * s.servicePct) / 100);
    const vat = round2(((subtotal + service) * s.vatPct) / 100);
    return { currency, subtotal, service, vat, total: round2(subtotal + service + vat) };
  });
  return { byCurrency, unpriced, itemCount };
}

const KEY = "order-list";
const PRESET_KEY = "order-surcharge";

function validLine(raw: unknown): OrderLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const qty = typeof r.qty === "number" && Number.isFinite(r.qty) ? Math.floor(r.qty) : 0;
  if (qty < 1) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  return {
    id: r.id.slice(0, 40),
    name: r.name.slice(0, 100),
    original: str(r.original, 300),
    language: str(r.language, 16),
    unit: typeof r.unit === "number" && Number.isFinite(r.unit) && r.unit >= 0 && r.unit < 1e9 ? r.unit : undefined,
    label: str(r.label, 20),
    currency: typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency) ? r.currency : undefined,
    qty: Math.min(MAX_QTY, qty),
  };
}

export function loadOrder(): { lines: OrderLine[]; presetId: string } {
  let lines: OrderLine[] = [];
  let presetId = "none";
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(parsed)) {
      lines = parsed.map(validLine).filter((l): l is OrderLine => l !== null).slice(0, MAX_LINES);
    }
    const p = localStorage.getItem(PRESET_KEY);
    if (SURCHARGE_PRESETS.some((x) => x.id === p)) presetId = p as string;
  } catch {
    // Corrupt/unavailable storage: start with an empty list.
  }
  return { lines, presetId };
}

export function saveOrder(lines: OrderLine[], presetId: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
    localStorage.setItem(PRESET_KEY, presetId);
  } catch {
    // Not persisted — fine.
  }
}
