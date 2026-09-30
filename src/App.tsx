import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useAnalyze } from "./hooks/useAnalyze";
import { useExplain } from "./hooks/useExplain";
import type { AppMode, MenuItem, RecognitionMode } from "./lib/types";
import { cropThumbnail } from "./lib/image";
import {
  loadHistory,
  pushHistory,
  updateHistoryItems,
  type HistoryEntry,
} from "./lib/history";
import { AuthButton } from "./components/AuthButton";
import { AppModeSwitch } from "./components/AppModeSwitch";
import { ModeToggle } from "./components/ModeToggle";
import { ContextHintInput } from "./components/ContextHintInput";
import { AvoidIngredientsInput } from "./components/AvoidIngredientsInput";
import { exportItemsText } from "./lib/exportText";
import { CameraView } from "./components/CameraView";
import { SavedList } from "./components/SavedList";
import { ScrollTopButton } from "./components/ScrollTopButton";
import "./App.css";

type Tab = "camera" | "saved";

const APP_MODE_KEY = "app-mode";
const CONTEXT_HINT_KEY = "context-hint";
const AVOID_KEY = "avoid-ingredients";

function loadAppMode(): AppMode {
  const raw = localStorage.getItem(APP_MODE_KEY);
  return raw === "menu" || raw === "museum" ? raw : "menu";
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("camera");
  const [appMode, setAppMode] = useState<AppMode>(loadAppMode);
  const [contextHint, setContextHint] = useState<string>(
    () => localStorage.getItem(CONTEXT_HINT_KEY) ?? "",
  );
  const [avoidIngredients, setAvoidIngredients] = useState<string>(
    () => localStorage.getItem(AVOID_KEY) ?? "",
  );
  const [modes, setModes] = useState<RecognitionMode[]>(["text"]);
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // Timestamp of the history entry the on-screen items belong to (null
  // while a new scan is still in flight), so fetched explanations can be
  // written back to it.
  const [currentScanTs, setCurrentScanTs] = useState<number | null>(null);
  const [explainingAll, setExplainingAll] = useState(false);
  const {
    analyze,
    loading,
    elapsedSeconds,
    error,
    warnings,
    items,
    setItems,
    resetStatus,
  } = useAnalyze();
  const { explain, explainBatch, loadingIndex, setLoadingIndex } = useExplain();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    localStorage.setItem(APP_MODE_KEY, appMode);
  }, [appMode]);

  // Persist the hint so it carries across scans — a traveler stays in the
  // same country/cuisine for days, so re-typing it every time is wasteful.
  useEffect(() => {
    localStorage.setItem(CONTEXT_HINT_KEY, contextHint);
  }, [contextHint]);

  useEffect(() => {
    localStorage.setItem(AVOID_KEY, avoidIngredients);
  }, [avoidIngredients]);

  // Write explanations/warnings fetched after the scan back into its history
  // entry — otherwise restoring from history loses them and re-bills the API.
  useEffect(() => {
    if (currentScanTs === null || items.length === 0) return;
    updateHistoryItems(currentScanTs, items);
    setHistory(loadHistory());
  }, [items, currentScanTs]);

  const handleAppModeChange = (next: AppMode) => {
    if (next === appMode || loading) return;
    setAppMode(next);
    // Results from one mode don't make sense once the other mode's prompts
    // and labels are in effect, so drop them rather than show stale data.
    setFrozenImage(null);
    setItems([]);
    setSavedNames(new Set());
    setCurrentScanTs(null);
  };

  // Shared by a fresh capture and "retry with the same photo": a successful
  // result becomes a new history entry that later explanations write into.
  const runAnalysis = async (image: string) => {
    setCurrentScanTs(null);
    const result = await analyze(image, modes, appMode, contextHint);
    if (result.length > 0) {
      const entry: HistoryEntry = {
        image,
        items: result,
        timestamp: Date.now(),
        appMode,
      };
      pushHistory(entry);
      setHistory(loadHistory());
      setCurrentScanTs(entry.timestamp);
    }
  };

  const handleCapture = async (image: string) => {
    setFrozenImage(image);
    setSavedNames(new Set());
    setCurrentScanTs(null);
    if (modes.length === 0) return;
    await runAnalysis(image);
  };

  const handleRetry = () => {
    if (frozenImage) void runAnalysis(frozenImage);
  };

  const handleRescan = () => {
    setFrozenImage(null);
    setItems([]);
    setCurrentScanTs(null);
    // Don't leave a stale error/warning banner from the previous attempt
    // hanging under the live camera.
    resetStatus();
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setFrozenImage(entry.image);
    setItems(entry.items);
    setSavedNames(new Set());
    setAppMode(entry.appMode ?? "menu");
    setCurrentScanTs(entry.timestamp);
    resetStatus();
    // An in-flight explain belongs to the previous scan's indices.
    setLoadingIndex(null);
    setExplainingAll(false);
  };

  const handleExplain = async (index: number) => {
    const item = items[index];
    if (!item || item.explanation) return;
    setLoadingIndex(index);
    const result = await explain(item, appMode, avoidIngredients);
    if (result) {
      setItems((prev) =>
        prev.map((it, i) =>
          // Reference-compare against the captured item so a history restore
          // mid-fetch can't get another scan's explanation glued onto its
          // same-index item.
          i === index && it === item
            ? {
                ...it,
                explanation: result.explanation,
                warning: result.warning,
                references: result.references,
              }
            : it,
        ),
      );
    }
    setLoadingIndex(null);
  };

  // Fetches every missing explanation, splitting into chunks of 15 that run
  // in parallel (one Gemini call per chunk) so even a long menu finishes in
  // roughly the time of a single call.
  const handleExplainAll = async () => {
    const targets = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.explanation);
    if (targets.length === 0) return;

    const CHUNK = 15;
    const chunks: (typeof targets)[] = [];
    for (let i = 0; i < targets.length; i += CHUNK) {
      chunks.push(targets.slice(i, i + CHUNK));
    }

    setExplainingAll(true);
    await Promise.all(
      chunks.map(async (chunk) => {
        const results = await explainBatch(
          chunk.map((c) => c.item),
          appMode,
          avoidIngredients,
        );
        setItems((prev) =>
          prev.map((it, i) => {
            // Reference-compare (same guard as handleExplain) so results
            // can't land on a different scan restored mid-fetch.
            const k = chunk.findIndex((c) => c.index === i && c.item === it);
            const result = k >= 0 ? results[k] : null;
            if (!result) return it;
            return {
              ...it,
              explanation: result.explanation,
              warning: result.warning,
              references: result.references,
            };
          }),
        );
      }),
    );
    setExplainingAll(false);
  };

  const handleExportText = () => {
    if (items.length > 0) exportItemsText(items, appMode);
  };

  const handleSave = async (item: MenuItem) => {
    if (!user || !frozenImage || !item.explanation) return;
    let thumbnail_url: string | null = null;
    try {
      thumbnail_url = await cropThumbnail(frozenImage, item.box);
    } catch {
      // Thumbnail is a nice-to-have — saving the text should still succeed.
    }

    const { error: saveError } = await supabase.from("saved_items").insert({
      user_id: user.id,
      dish_name: item.name,
      original_text: item.original_text ?? null,
      pronunciation: item.pronunciation ?? null,
      explanation: item.explanation,
      source_language: item.source_language ?? null,
      thumbnail_url,
      mode: appMode,
      reference_links: item.references ?? null,
    });
    if (!saveError) {
      setSavedNames((prev) => new Set(prev).add(item.name));
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{appMode === "museum" ? "博物館説明カメラ" : "メニュー説明カメラ"}</h1>
        <AuthButton user={user} />
      </header>

      <AppModeSwitch appMode={appMode} onChange={handleAppModeChange} disabled={loading} />

      <nav className="app-tabs">
        <button
          className={tab === "camera" ? "active" : ""}
          onClick={() => setTab("camera")}
        >
          カメラ
        </button>
        <button
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
          disabled={!user}
        >
          保存済み
        </button>
      </nav>

      {!user && (
        <p className="app-hint">
          スキャンと保存機能を使うにはGoogleでログインしてください。
        </p>
      )}

      {tab === "camera" ? (
        <>
          <ModeToggle modes={modes} onChange={setModes} appMode={appMode} />
          {!frozenImage && (
            <>
              <ContextHintInput
                value={contextHint}
                onChange={setContextHint}
                appMode={appMode}
                disabled={loading}
              />
              {appMode === "menu" && (
                <AvoidIngredientsInput
                  value={avoidIngredients}
                  onChange={setAvoidIngredients}
                  disabled={loading}
                />
              )}
            </>
          )}
          <CameraView
            frozenImage={frozenImage}
            items={items}
            loading={loading}
            elapsedSeconds={elapsedSeconds}
            error={error}
            warnings={warnings}
            history={history}
            onCapture={handleCapture}
            onRetry={handleRetry}
            onRescan={handleRescan}
            onRestoreHistory={handleRestoreHistory}
            onSave={handleSave}
            savedNames={savedNames}
            onExplain={handleExplain}
            explainingIndex={loadingIndex}
            onExportText={handleExportText}
            onExplainAll={handleExplainAll}
            explainingAll={explainingAll}
          />
        </>
      ) : (
        <SavedList />
      )}

      <ScrollTopButton />
    </div>
  );
}

export default App;
