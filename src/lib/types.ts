export type RecognitionMode = "text" | "image";

// box coordinates are normalized to a 0-1000 range on both axes,
// relative to the captured still image (top-left origin).
// `explanation` is fetched lazily (see /api/explain) after the user taps an
// item, so the initial /api/analyze pass stays fast and cheap.
export interface MenuItem {
  name: string;
  original_text?: string;
  // IPA transcription of original_text, so a traveler can attempt to say
  // the dish name aloud when ordering.
  pronunciation?: string;
  explanation?: string;
  source_language?: string;
  box: { x: number; y: number; w: number; h: number };
  source: RecognitionMode;
}

export interface AnalyzeResponse {
  items: MenuItem[];
  warnings?: string[];
}

export interface AnalyzeRequest {
  image: string; // base64 JPEG data URL
  modes: RecognitionMode[];
}

export interface ExplainRequest {
  name: string;
  original_text?: string;
}

export interface ExplainResponse {
  explanation: string;
}
