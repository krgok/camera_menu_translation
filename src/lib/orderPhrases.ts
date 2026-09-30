/**
 * "I'd like one of this, please" in common travel languages, keyed by ISO
 * 639-1. Static on purpose: it's a fixed phrase, and a lookup table is
 * instant, free, and works offline (unlike asking Gemini each time).
 */
const PHRASES: Record<string, string> = {
  th: "ขออันนี้หนึ่งที่",
  vi: "Cho tôi một phần này.",
  ko: "이거 하나 주세요.",
  zh: "请给我一份这个。",
  en: "One of this, please.",
  fr: "Je voudrais ceci, s'il vous plaît.",
  es: "Quisiera esto, por favor.",
  it: "Vorrei questo, per favore.",
  de: "Ich hätte gerne das hier, bitte.",
  pt: "Eu gostaria disto, por favor.",
  id: "Saya pesan yang ini satu.",
  ms: "Saya nak yang ini satu.",
  tl: "Isa po nito.",
  km: "សុំមួយនេះ",
  lo: "ຂໍອັນນີ້ໜຶ່ງ",
  my: "ဒါတစ်ပွဲ ပေးပါ",
  hi: "मुझे यह एक दीजिए।",
  tr: "Bundan bir tane lütfen.",
  ru: "Одну порцию этого, пожалуйста.",
  ar: "واحد من هذا من فضلك.",
  el: "Ένα από αυτό, παρακαλώ.",
  nl: "Eén van deze, alstublieft.",
};

export interface OrderPhrase {
  text: string;
  // TTS language code; null lets the engine auto-detect.
  lang: string;
  // True when we fell back to English because the language was unknown.
  fallback: boolean;
}

export function orderPhraseFor(language?: string | null): OrderPhrase {
  const code = language?.toLowerCase().split(/[-_]/)[0];
  if (code && PHRASES[code]) {
    return { text: PHRASES[code], lang: code, fallback: false };
  }
  return { text: PHRASES.en, lang: "en", fallback: true };
}
