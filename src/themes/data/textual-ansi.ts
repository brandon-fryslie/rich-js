import { VGA_ANSI } from "./ansi-tables.js";
import type { ThemePaletteData } from "./types.js";

const theme: ThemePaletteData = {
  name: "textual-ansi",
  dark: true,
  ansi: VGA_ANSI,
  vars: {
    "accent": "#0000FF",
    "background": "#121212",
    "error": "#800000",
    "foreground": "#E0E0E0",
    "primary": "#000080",
    "secondary": "#008080",
    "success": "#008000",
    "warning": "#808000",
  },
};

export default theme;
