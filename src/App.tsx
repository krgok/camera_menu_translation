import { useCallback, useEffect, useRef, useState } from "react";
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
import { DietProfilePanel } from "./components/DietProfilePanel";
import { useDietProfiles } from "./hooks/useDietProfiles";
import { toExplainRestrictions } from "./lib/diet";
import { exportItemsText } from "./lib/exportText";
import { PointOrderModal } from "./components/PointOrderModal";
import { CameraView } from "./components/CameraView";
import { SavedList } from "./components/SavedList";
import { useOnline } from "./hooks/useOnline";
import { ScrollTopButton } from "./components/ScrollTopButton";
import "./App.css";

type Tab = "camera" | "saved";

const APP_MODE_KEY = "app-mode";
const CONTEXT_HINT_KEY = "context-hint";

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
  const diet = useDietProfiles();
  const restrictions = toExplainRestrictions(diet.active);
  const profileAllergens = diet.active?.allergies ?? [];
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
  // A short-lived banner for failures that have no other place to show up
  // (explain / save errors, quota, expired login).
  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = useCallback((message: string) => setNotice(message), []);
  const [showPhrases, setShowPhrases] = useState(false);
  const online = useOnline();
  const savingRef = useRef(new Set<string>());
  const { explain, explainBatch, loadingIndex, setLoadingIndex } =
    useExplain(showNotice);

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
    // Ignore a second tap while this item's request is already in flight.
    if (!item || item.explanation || loadingIndex === index) return;
    setLoadingIndex(index);
    const result = await explain(item, appMode, restrictions);
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
                risk: result.risk,
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
          restrictions,
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
              risk: result.risk,
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
    // Guard against double taps creating duplicate rows while the thumbnail
    // is being cut and the insert is in flight.
    if (savingRef.current.has(item.name)) return;
    savingRef.current.add(item.name);
    try {
      await saveItem(item, user.id, frozenImage);
    } finally {
      savingRef.current.delete(item.name);
    }
  };

  const saveItem = async (item: MenuItem, userId: string, image: string) => {
    let thumbnail_url: string | null = null;
    try {
      thumbnail_url = await cropThumbnail(image, item.box);
    } catch {
      // Thumbnail is a nice-to-have — saving the text should still succeed.
    }

    const { error: saveError } = await supabase.from("saved_items").insert({
      user_id: userId,
      dish_name: item.name,
      original_text: item.original_text ?? null,
      pronunciation: item.pronunciation ?? null,
      explanation: item.explanation,
      source_language: item.source_language ?? null,
      thumbnail_url,
      mode: appMode,
      reference_links: item.references ?? null,
    });
    if (saveError) {
      showNotice(`保存に失敗しました: ${saveError.message}`);
      return;
    }
    setSavedNames((prev) => new Set(prev).add(item.name));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{appMode === "museum" ? "博物館説明カメラ" : "メニュー説明カメラ"}</h1>
        <div className="app-header-actions">
          {appMode === "menu" && (
            <button onClick={() => setShowPhrases(true)}>💬 フレーズ集</button>
          )}
          <AuthButton user={user} />
        </div>
      </header>
      {showPhrases && (
        <PointOrderModal
          name=""
          profileAllergens={profileAllergens}
          onClose={() => setShowPhrases(false)}
        />
      )}

      {!online && (
        <p className="app-notice app-notice-offline" role="status">
          オフラインです。スキャンと説明の取得にはネット接続が必要です(履歴の閲覧・音声読み上げは使えます)。
        </p>
      )}
      {notice && (
        <div className="app-notice" role="alert">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="メッセージを閉じる">
            ×
          </button>
        </div>
      )}

      <AppModeSwitch appMode={appMode} onChange={handleAppModeChange} disabled={loading} />

      <nav className="app-tabs">
        <button
          className={tab === "camera" ? "active" : ""}
          aria-current={tab === "camera" ? "page" : undefined}
          onClick={() => setTab("camera")}
        >
          カメラ
        </button>
        <button
          className={tab === "saved" ? "active" : ""}
          aria-current={tab === "saved" ? "page" : undefined}
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
                <DietProfilePanel
                  state={diet.state}
                  active={diet.active}
                  disabled={loading}
                  onSetActive={diet.setActive}
                  onAdd={diet.addProfile}
                  onUpdate={diet.updateProfile}
                  onRemove={diet.removeProfile}
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
            profileAllergens={profileAllergens}
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
