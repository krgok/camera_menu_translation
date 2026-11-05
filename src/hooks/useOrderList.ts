import { useCallback, useEffect, useState } from "react";
import {
  SURCHARGE_PRESETS,
  addLine,
  loadOrder,
  saveOrder,
  setQty as setLineQty,
  type OrderLine,
  type SurchargePreset,
} from "../lib/order";
import type { MenuItem, PriceOption } from "../lib/types";

/** The order list (dishes + quantities), persisted on this device. */
export function useOrderList() {
  const [state, setState] = useState(loadOrder);

  useEffect(() => {
    saveOrder(state.lines, state.presetId);
  }, [state]);

  const add = useCallback((item: MenuItem, option?: PriceOption) => {
    const unit = option?.value ?? item.price;
    setState((s) => ({
      ...s,
      lines: addLine(s.lines, {
        name: item.name,
        original: item.original_text,
        language: item.source_language,
        unit,
        label: option?.label,
        currency: unit !== undefined ? item.currency : undefined,
      }),
    }));
  }, []);

  const setQty = useCallback(
    (id: string, qty: number) =>
      setState((s) => ({ ...s, lines: setLineQty(s.lines, id, qty) })),
    [],
  );
  const clear = useCallback(() => setState((s) => ({ ...s, lines: [] })), []);
  const setPreset = useCallback((presetId: string) => setState((s) => ({ ...s, presetId })), []);

  const preset: SurchargePreset =
    SURCHARGE_PRESETS.find((p) => p.id === state.presetId) ?? SURCHARGE_PRESETS[0];

  return { lines: state.lines as OrderLine[], preset, add, setQty, clear, setPreset };
}
