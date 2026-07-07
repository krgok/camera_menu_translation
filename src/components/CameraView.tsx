import { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { resizeImageFile } from "../lib/image";
import { OverlayLayer } from "./OverlayLayer";
import { ItemList } from "./ItemList";
import { HistoryPanel } from "./HistoryPanel";
import type { MenuItem } from "../lib/types";
import type { HistoryEntry } from "../lib/history";

interface Props {
  frozenImage: string | null;
  items: MenuItem[];
  loading: boolean;
  elapsedSeconds: number;
  error: string | null;
  warnings: string[];
  history: HistoryEntry[];
  onCapture: (image: string) => void;
  onRetry: () => void;
  onRescan: () => void;
  onRestoreHistory: (entry: HistoryEntry) => void;
  onSave: (item: MenuItem) => void;
  savedNames: Set<string>;
  onExplain: (index: number) => void;
  explainingIndex: number | null;
}

export function CameraView({
  frozenImage,
  items,
  loading,
  elapsedSeconds,
  error,
  warnings,
  history,
  onCapture,
  onRetry,
  onRescan,
  onRestoreHistory,
  onSave,
  savedNames,
  onExplain,
  explainingIndex,
}: Props) {
  const { videoRef, ready, error: cameraError, start, captureFrame } = useCamera();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!frozenImage) start();
  }, [frozenImage, start]);

  useEffect(() => {
    setActiveIndex(null);
  }, [frozenImage]);

  const handleScan = () => {
    const frame = captureFrame();
    if (frame) onCapture(frame);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const image = await resizeImageFile(file);
    onCapture(image);
  };

  const toggleActive = (index: number) => {
    setActiveIndex((current) => {
      const next = current === index ? null : index;
      if (next !== null && !items[next]?.explanation) {
        onExplain(next);
      }
      return next;
    });
  };

  return (
    <div className="camera-view">
      <div className="camera-stage">
        <video
          ref={videoRef}
          className="camera-video"
          style={{ display: frozenImage ? "none" : "block" }}
          playsInline
          muted
        />
        {frozenImage && (
          <OverlayLayer
            capturedImage={frozenImage}
            items={items}
            activeIndex={activeIndex}
            onSelect={toggleActive}
          />
        )}
        {loading && (
          <div className="camera-loading-overlay">
            解析中... ({elapsedSeconds}秒)
          </div>
        )}
      </div>

      {cameraError && <p className="camera-error">{cameraError}</p>}
      {error && (
        <div className="camera-error-box">
          <p className="camera-error">{error}</p>
          {frozenImage && (
            <button onClick={onRetry} disabled={loading}>
              同じ写真で再解析
            </button>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <p className="camera-warning">
          一部の認識に失敗しました: {warnings.join(" / ")}
        </p>
      )}

      <div className="camera-controls">
        {frozenImage ? (
          <button onClick={onRescan}>再スキャン</button>
        ) : (
          <>
            <button onClick={handleScan} disabled={!ready || loading}>
              {loading ? `解析中... (${elapsedSeconds}秒)` : "スキャン"}
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}>
              写真を選択
            </button>
            {history.length > 0 && (
              <button onClick={() => setShowHistory((v) => !v)}>履歴</button>
            )}
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {showHistory && !frozenImage && (
        <HistoryPanel
          history={history}
          onSelect={(entry) => {
            onRestoreHistory(entry);
            setShowHistory(false);
          }}
        />
      )}

      {frozenImage && (
        <ItemList
          items={items}
          activeIndex={activeIndex}
          onSelect={toggleActive}
          onSave={onSave}
          savedNames={savedNames}
          explainingIndex={explainingIndex}
        />
      )}
    </div>
  );
}
