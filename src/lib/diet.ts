import { isIngredientKey, type IngredientKey } from "./phrases";
import type { MenuItem, RestrictionsPayload, Risk } from "./types";

export const DIET_KEYS = [
  "vegetarian",
  "vegan",
  "halal",
  "noPork",
  "noBeef",
  "noAlcohol",
  "glutenFree",
  "noSpicy",
] as const;
export type DietKey = (typeof DIET_KEYS)[number];

export const DIET_LABEL_JA: Record<DietKey, string> = {
  vegetarian: "ベジタリアン",
  vegan: "ヴィーガン",
  halal: "ハラール",
  noPork: "豚肉NG",
  noBeef: "牛肉NG",
  noAlcohol: "アルコールNG",
  glutenFree: "グルテンフリー",
  noSpicy: "辛いのが苦手",
};

export function isDietKey(v: unknown): v is DietKey {
  return typeof v === "string" && (DIET_KEYS as readonly string[]).includes(v);
}

/** One family member's restrictions. Stored only on this device (localStorage). */
export interface DietProfile {
  id: string;
  name: string;
  /** Allergies: any possibility counts as high risk. */
  allergies: IngredientKey[];
  /** Dislikes / things to avoid but not dangerous. */
  dislikes: IngredientKey[];
  diets: DietKey[];
  free: string;
}

export interface DietState {
  profiles: DietProfile[];
  /** null = no restrictions applied. */
  activeId: string | null;
}

const PROFILES_KEY = "diet-profiles";
const ACTIVE_KEY = "diet-active";
const LEGACY_AVOID_KEY = "avoid-ingredients";
const MAX_PROFILES = 10;

export function newProfile(name: string): DietProfile {
  return {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim().slice(0, 20) || "プロファイル",
    allergies: [],
    dislikes: [],
    diets: [],
    free: "",
  };
}

function sanitizeProfile(raw: unknown): DietProfile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const keys = <T,>(v: unknown, ok: (x: unknown) => x is T): T[] =>
    Array.isArray(v) ? [...new Set(v.filter(ok))] : [];
  return {
    id: r.id,
    name: r.name.slice(0, 20),
    allergies: keys(r.allergies, isIngredientKey),
    dislikes: keys(r.dislikes, isIngredientKey),
    diets: keys(r.diets, isDietKey),
    free: typeof r.free === "string" ? r.free.slice(0, 100) : "",
  };
}

/**
 * Loads the profiles. On first run, the old single "avoid-ingredients" text
 * field is migrated into a profile called "自分" (the old key is left untouched).
 */
export function loadDietState(): DietState {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      const profiles = (Array.isArray(parsed) ? parsed : [])
        .map(sanitizeProfile)
        .filter((p): p is DietProfile => p !== null)
        .slice(0, MAX_PROFILES);
      const active = localStorage.getItem(ACTIVE_KEY);
      return {
        profiles,
        activeId: profiles.some((p) => p.id === active) ? active : null,
      };
    }
    const legacy = (localStorage.getItem(LEGACY_AVOID_KEY) ?? "").trim();
    if (legacy) {
      const p = { ...newProfile("自分"), free: legacy.slice(0, 100) };
      const state = { profiles: [p], activeId: p.id };
      saveDietState(state);
      return state;
    }
  } catch {
    // Corrupt/unavailable storage: start empty.
  }
  return { profiles: [], activeId: null };
}

export function saveDietState(state: DietState): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
    if (state.activeId) localStorage.setItem(ACTIVE_KEY, state.activeId);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Not persisted — fine.
  }
}

export function activeProfile(state: DietState): DietProfile | null {
  return state.profiles.find((p) => p.id === state.activeId) ?? null;
}

export interface ExplainRestrictions {
  avoid?: string;
  restrictions?: RestrictionsPayload;
}

/** What to send to /api/explain*. Empty profile => nothing is sent. */
export function toExplainRestrictions(p: DietProfile | null): ExplainRestrictions {
  if (!p) return {};
  const free = p.free.trim();
  const has = p.allergies.length > 0 || p.dislikes.length > 0 || p.diets.length > 0;
  return {
    avoid: free || undefined,
    restrictions: has
      ? { allergies: p.allergies, dislikes: p.dislikes, diets: p.diets }
      : undefined,
  };
}

export function hasAnyRestriction(p: DietProfile | null): boolean {
  const r = toExplainRestrictions(p);
  return !!r.avoid || !!r.restrictions;
}

export interface RiskInfo {
  label: string;
  icon: string;
  className: string;
}

// Meaning is carried by the text and icon, never by colour alone.
export const RISK_INFO: Record<Risk, RiskInfo> = {
  high: { label: "要注意", icon: "🚫", className: "risk-high" },
  medium: { label: "注意", icon: "⚠", className: "risk-medium" },
  unknown: { label: "不明", icon: "？", className: "risk-unknown" },
  low: { label: "たぶん大丈夫", icon: "✓", className: "risk-low" },
};

export function summarizeRisks(items: Pick<MenuItem, "risk">[]): Record<Risk, number> {
  const out: Record<Risk, number> = { high: 0, medium: 0, unknown: 0, low: 0 };
  for (const i of items) if (i.risk) out[i.risk] += 1;
  return out;
}
