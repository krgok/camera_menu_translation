export type RecognitionMode = "text" | "image";

// box coordinates are normalized to a 0-1000 range on both axes,
// relative to the captured still image (top-left origin).
export interface MenuItem {
  name: string;
  original_text?: string;
  explanation: string;
  box: { x: number; y: number; w: number; h: number };
  source: RecognitionMode;
}

export interface AnalyzeResponse {
  items: MenuItem[];
}

export interface AnalyzeRequest {
  image: string; // base64 JPEG data URL
  modes: RecognitionMode[];
}
