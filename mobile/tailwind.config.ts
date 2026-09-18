import type { Config } from "tailwindcss";

import { colors, radius } from "./src/constants/design-tokens";

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        pill: `${radius.pill}px`,
      },
    },
  },
  plugins: [],
} satisfies Config;
