// Curated font pairings for the public booking page. Each pack is loaded via
// next/font/google at module scope (the supported pattern for switching fonts
// at runtime) and exposed as a plain `fontFamily` string, so PublicFrame can
// inject it as a CSS variable without needing to touch every selector in
// booking.module.css — only the root font-family declaration references it.
//
// "modern-sans" mirrors the page's current default (Plus Jakarta Sans + DM
// Sans, same as globals.css) so existing tenants see zero visual change.
//
// This file must only be imported by client components (primitives.tsx,
// branding-studio.tsx) — next/font/google's exports are compiler macros that
// only work inside Next's own build pipeline. Pure id/type metadata (safe for
// server code and the test suite) lives in src/lib/booking/fonts.ts instead.

import {
  DM_Sans,
  Fraunces,
  Inter,
  Nunito,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Quicksand,
  Work_Sans,
} from "next/font/google";
import {
  DEFAULT_FONT_PACK,
  FONT_PACK_IDS,
  isFontPackId,
  type FontPackId,
} from "@/lib/booking/fonts";

export type { FontPackId };
export { DEFAULT_FONT_PACK, FONT_PACK_IDS, isFontPackId };

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const quicksand = Quicksand({ subsets: ["latin"], weight: ["600", "700"] });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700"] });
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export type FontPack = {
  label: string;
  description: string;
  heading: string;
  body: string;
};

export const FONT_PACKS: Record<FontPackId, FontPack> = {
  "modern-sans": {
    label: "Moderno",
    description: "Padrão Reservei — geométrico e limpo.",
    heading: plusJakartaSans.style.fontFamily,
    body: dmSans.style.fontFamily,
  },
  "editorial-serif": {
    label: "Editorial",
    description: "Serifada com corpo de texto neutro.",
    heading: fraunces.style.fontFamily,
    body: inter.style.fontFamily,
  },
  "friendly-rounded": {
    label: "Amigável",
    description: "Traços arredondados, tom acolhedor.",
    heading: quicksand.style.fontFamily,
    body: nunito.style.fontFamily,
  },
  "classic-grotesk": {
    label: "Clássico",
    description: "Grotesca única, sóbria e neutra.",
    heading: inter.style.fontFamily,
    body: inter.style.fontFamily,
  },
  "elegant-display": {
    label: "Elegante",
    description: "Display sofisticado para marcas premium.",
    heading: playfairDisplay.style.fontFamily,
    body: workSans.style.fontFamily,
  },
};

export function resolveFontPack(id: string | null | undefined): FontPack {
  return FONT_PACKS[isFontPackId(id) ? id : DEFAULT_FONT_PACK];
}
