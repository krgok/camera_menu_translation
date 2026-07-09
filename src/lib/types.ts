export type RecognitionMode = "text" | "image";

// App-level mode: "menu" explains dishes for travelers, "museum" summarizes
// exhibits/artworks with historical context. Prompts, UI labels, and saved
// records all branch on this.
export type AppMode = "menu" | "museum";

// Reference links are built server-side as Wikipedia search URLs from
// Gemini-suggested article titles, so they can never 404 (Gemini-invented
// direct URLs frequently do).
export interface Reference {
  title: string;
  url: string;
}

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
  // Museum mode only: fetched together with `explanation`.
  references?: Reference[];
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
  appMode?: AppMode; // defaults to "menu" for backward compatibility
  // Optional free-text cuisine/region hint (e.g. "タイ料理") that narrows the
  // hypothesis space for image recognition of plated food with no visible text.
  contextHint?: string;
}

export interface ExplainRequest {
  name: string;
  original_text?: string;
  appMode?: AppMode;
}

export interface ExplainResponse {
  explanation: string;
  references?: Reference[];
}
