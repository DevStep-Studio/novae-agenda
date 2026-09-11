// Pure font-pack metadata — the id list, default, and validators. Deliberately
// has NO `next/font/google` import: this file is shared by server code
// (catalog.ts, the branding API route) and by the test suite (run via plain
// `tsx --test`, outside Next's build pipeline). `next/font/google`'s exports
// are compiler macros that only work inside Next's own SWC/webpack transform
// — importing them here broke `npm test` (Plus_Jakarta_Sans is not a
// function outside that pipeline). The actual font loading + rendered
// `FONT_PACKS` map (label/description/CSS font-family) lives in
// `src/components/booking/font-packs.ts`, imported only by client components.

export type FontPackId =
  | "modern-sans"
  | "editorial-serif"
  | "friendly-rounded"
  | "classic-grotesk"
  | "elegant-display";

export const DEFAULT_FONT_PACK: FontPackId = "modern-sans";

export const FONT_PACK_IDS: FontPackId[] = [
  "modern-sans",
  "editorial-serif",
  "friendly-rounded",
  "classic-grotesk",
  "elegant-display",
];

export function isFontPackId(value: string | null | undefined): value is FontPackId {
  return !!value && (FONT_PACK_IDS as string[]).includes(value);
}
