import { useEffect } from "react";
import { useCamera } from "../hooks/useCamera";
import { OverlayLayer } from "./OverlayLayer";
import type { MenuItem } from "../lib/types";

interface Props {
  frozenImage: string | null;
  items: MenuItem[];
  loading: boolean;
  onCapture: (image: string) => void;
  onRescan: () => void;
  onSave: (item: MenuItem) => void;
  savedNames: Set<string>;
}

export function CameraView({
  frozenImage,
  items,
  loading,
  onCapture,
  onRescan,
  onSave,
  savedNames,
}: Props) {
  const { videoRef, ready, error, start, captureFrame } = useCamera();

  useEffect(() => {
    if (!frozenImage) start();
  }, [frozenImage, start]);

  const handleScan = () => {
    const frame = captureFrame();
    if (frame) onCapture(frame);
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
            onSave={onSave}
            savedNames={savedNames}
          />
        )}
      </div>

      {error && <p className="camera-error">{error}</p>}

      <div className="camera-controls">
        {frozenImage ? (
          <button onClick={onRescan}>再スキャン</button>
        ) : (
          <button onClick={handleScan} disabled={!ready || loading}>
            {loading ? "解析中..." : "スキャン"}
          </button>
        )}
      </div>
    </div>
  );
}
