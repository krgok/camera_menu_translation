import { useCallback, useEffect, useRef, useState } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Bumped on every start/stop so a getUserMedia call that resolves after
  // the user already froze the frame (or rescanned again) can tell it's
  // stale and release its stream instead of leaking it.
  const generationRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stop = useCallback(() => {
    generationRef.current += 1;
    releaseStream();
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    // Always release the previous stream first — overwriting streamRef
    // without stopping it left the old camera running on every rescan.
    releaseStream();
    const generation = ++generationRef.current;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(
        e instanceof Error ? e.message : "カメラを起動できませんでした",
      );
      setReady(false);
    }
  }, []);

  useEffect(() => stop, [stop]);

  const captureFrame = useCallback((maxDimension = 1024): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const scale = Math.min(
      1,
      maxDimension / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  return { videoRef, ready, error, start, stop, captureFrame };
}
