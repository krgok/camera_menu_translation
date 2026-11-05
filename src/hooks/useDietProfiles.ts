import { useCallback, useEffect, useState } from "react";
import {
  activeProfile,
  loadDietState,
  newProfile,
  saveDietState,
  type DietProfile,
  type DietState,
} from "../lib/diet";

/** Diet profiles (family members), persisted on this device. */
export function useDietProfiles() {
  const [state, setState] = useState<DietState>(loadDietState);

  useEffect(() => {
    saveDietState(state);
  }, [state]);

  const setActive = useCallback(
    (id: string | null) => setState((s) => ({ ...s, activeId: id })),
    [],
  );

  const addProfile = useCallback((name: string) => {
    const p = newProfile(name);
    setState((s) =>
      s.profiles.length >= 10 ? s : { profiles: [...s.profiles, p], activeId: p.id },
    );
  }, []);

  const updateProfile = useCallback(
    (id: string, patch: Partial<Omit<DietProfile, "id">>) =>
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),
    [],
  );

  const removeProfile = useCallback(
    (id: string) =>
      setState((s) => ({
        profiles: s.profiles.filter((p) => p.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
      })),
    [],
  );

  return {
    state,
    active: activeProfile(state),
    setActive,
    addProfile,
    updateProfile,
    removeProfile,
  };
}
