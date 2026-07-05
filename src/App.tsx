import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { useAnalyze } from "./hooks/useAnalyze";
import type { MenuItem, RecognitionMode } from "./lib/types";
import { AuthButton } from "./components/AuthButton";
import { ModeToggle } from "./components/ModeToggle";
import { CameraView } from "./components/CameraView";
import { SavedList } from "./components/SavedList";
import "./App.css";

type Tab = "camera" | "saved";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("camera");
  const [modes, setModes] = useState<RecognitionMode[]>(["text"]);
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const { analyze, loading, error, items, setItems } = useAnalyze();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleCapture = async (image: string) => {
    setFrozenImage(image);
    setSavedNames(new Set());
    if (modes.length === 0) return;
    await analyze(image, modes);
  };

  const handleRescan = () => {
    setFrozenImage(null);
    setItems([]);
  };

  const handleSave = async (item: MenuItem) => {
    if (!user) return;
    const { error: saveError } = await supabase.from("saved_items").insert({
      user_id: user.id,
      dish_name: item.name,
      original_text: item.original_text ?? null,
      explanation: item.explanation,
      source_language: null,
    });
    if (!saveError) {
      setSavedNames((prev) => new Set(prev).add(item.name));
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>メニュー説明カメラ</h1>
        <AuthButton user={user} />
      </header>

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
          <ModeToggle modes={modes} onChange={setModes} />
          {error && <p className="camera-error">{error}</p>}
          <CameraView
            frozenImage={frozenImage}
            items={items}
            loading={loading}
            onCapture={handleCapture}
            onRescan={handleRescan}
            onSave={handleSave}
            savedNames={savedNames}
          />
        </>
      ) : (
        <SavedList />
      )}
    </div>
  );
}

export default App;
