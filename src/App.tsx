import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useAnalyze } from "./hooks/useAnalyze";
import { useExplain } from "./hooks/useExplain";
import type { AppMode, MenuItem, RecognitionMode } from "./lib/types";
import { cropThumbnail } from "./lib/image";
import { loadHistory, pushHistory, type HistoryEntry } from "./lib/history";
import { AuthButton } from "./components/AuthButton";
import { AppModeSwitch } from "./components/AppModeSwitch";
import { ModeToggle } from "./components/ModeToggle";
import { CameraView } from "./components/CameraView";
import { SavedList } from "./components/SavedList";
import { ScrollTopButton } from "./components/ScrollTopButton";
import "./App.css";

type Tab = "camera" | "saved";

const APP_MODE_KEY = "app-mode";

function loadAppMode(): AppMode {
  const raw = localStorage.getItem(APP_MODE_KEY);
  return raw === "menu" || raw === "museum" ? raw : "menu";
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("camera");
  const [appMode, setAppMode] = useState<AppMode>(loadAppMode);
  const [modes, setModes] = useState<RecognitionMode[]>(["text"]);
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { analyze, loading, elapsedSeconds, error, warnings, items, setItems } =
    useAnalyze();
  const { explain, loadingIndex, setLoadingIndex } = useExplain();

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

  const handleAppModeChange = (next: AppMode) => {
    if (next === appMode || loading) return;
    setAppMode(next);
    // Results from one mode don't make sense once the other mode's prompts
    // and labels are in effect, so drop them rather than show stale data.
    setFrozenImage(null);
    setItems([]);
    setSavedNames(new Set());
  };

  const handleCapture = async (image: string) => {
    setFrozenImage(image);
    setSavedNames(new Set());
    if (modes.length === 0) return;
    const result = await analyze(image, modes, appMode);
    if (result.length > 0) {
      const entry: HistoryEntry = {
        image,
        items: result,
        timestamp: Date.now(),
        appMode,
      };
      pushHistory(entry);
      setHistory(loadHistory());
    }
  };

  const handleRetry = () => {
    if (frozenImage) analyze(frozenImage, modes, appMode);
  };

  const handleRescan = () => {
    setFrozenImage(null);
    setItems([]);
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setFrozenImage(entry.image);
    setItems(entry.items);
    setSavedNames(new Set());
    setAppMode(entry.appMode ?? "menu");
  };

  const handleExplain = async (index: number) => {
    const item = items[index];
    if (!item || item.explanation) return;
    setLoadingIndex(index);
    const result = await explain(item, appMode);
    if (result) {
      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? { ...it, explanation: result.explanation, references: result.references }
            : it,
        ),
      );
    }
    setLoadingIndex(null);
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
