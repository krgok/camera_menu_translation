/**
 * Hard input limits, applied BEFORE any paid API is called. They bound both
 * the cost of one request and what an attacker can feed into a prompt.
 */

// Our client sends a 1024px JPEG (typically 100-500 KB). 1.4M base64 chars is
// roughly 1 MB of binary: generous headroom, far below Vercel's 4.5 MB body cap.
export const MAX_IMAGE_BASE64_CHARS = 1_400_000;
// Reject requests whose declared size is clearly too big before touching req.body.
export const MAX_BODY_BYTES = 1_600_000;
export const MAX_IMAGE_DIMENSION = 2048;
export const MIN_IMAGE_DIMENSION = 16;

export const MAX_HINT_CHARS = 100; // contextHint / avoid
export const MAX_NAME_CHARS = 100;
export const MAX_ORIGINAL_CHARS = 300;
export const MAX_BATCH_ITEMS = 15;

// OCR returns word-level annotations; a dense menu has a few hundred.
export const MAX_OCR_BLOCKS = 800;
export const MAX_OCR_BLOCK_CHARS = 80;
export const MAX_RESULT_ITEMS = 60;

// Upper bounds on text coming BACK from the model.
export const OUT_NAME_CHARS = 100;
export const OUT_ORIGINAL_CHARS = 300;
export const OUT_PRONUNCIATION_CHARS = 150;
export const OUT_EXPLANATION_CHARS = 800;
export const OUT_WARNING_CHARS = 200;
export const OUT_SIMILAR_CHARS = 100;
export const OUT_ROMANIZATION_CHARS = 150;
export const OUT_REFERENCE_CHARS = 80;

// Gemini maxOutputTokens per call (this also bounds thinking tokens on 2.5).
export const TOKENS_GROUP = 16384;
export const TOKENS_IDENTIFY = 4096;
export const TOKENS_EXPLAIN = 1280;
export const TOKENS_EXPLAIN_BATCH = 8192;
