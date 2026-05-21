import type { ThemePaletteData } from "./types.js";

/**
 * Cyberpunk — dark-mode neon palette. All six accent colors and their
 * darken/lighten/muted derivatives carry partial alpha (0.75–0.85), so the
 * palette variables are intentionally translucent. This exercises alpha-aware
 * rendering paths throughout the theme system.
 *
 * Substrate: near-black blue-black (#070714) with pale lavender foreground.
 * Accents: electric cyan (primary), hot magenta (secondary), chartreuse
 * (accent), neon lime (success), neon amber (warning), glitch red (error).
 *
 * Alpha notation used below:
 *   D9 = 85 %   CC = 80 %   BF = 75 %   F4 = 96 %   EF = 94 %
 *   F0 = 94 %   4C = 30 %   40 = 25 %   19 = 10 %   0A = 4 %
 */
const theme: ThemePaletteData = {
  name: "cyberpunk",
  dark: true,
  vars: {
    // ── Substrate ──────────────────────────────────────────────────────────
    "background":                     "#070714",
    "background-darken-1":            "#03030A",
    "background-darken-2":            "#000003",
    "background-darken-3":            "#000000",
    "background-lighten-1":           "#11111E",
    "background-lighten-2":           "#1A1A2B",
    "background-lighten-3":           "#25253A",

    "foreground":                     "#E2E2FF",
    "foreground-darken-1":            "#CACAE4",
    "foreground-darken-2":            "#B3B3CC",
    "foreground-darken-3":            "#9C9CB5",
    "foreground-disabled":            "#E2E2FF60",
    "foreground-lighten-1":           "#EEEEFF",
    "foreground-lighten-2":           "#F6F6FF",
    "foreground-lighten-3":           "#FFFFFF",
    "foreground-muted":               "#E2E2FF99",

    // ── Primary — electric cyan (85 % α) ───────────────────────────────────
    "primary":                        "#00E5FFD9",
    "primary-darken-1":               "#00CCE6D9",
    "primary-darken-2":               "#00B2CCD9",
    "primary-darken-3":               "#0099B3D9",
    "primary-lighten-1":              "#1AF0FFD9",
    "primary-lighten-2":              "#33F5FFD9",
    "primary-lighten-3":              "#4DFAFFD9",
    "primary-muted":                  "#054A5BF4",
    "primary-background":             "#0A3340",
    "primary-background-darken-1":    "#072833",
    "primary-background-darken-2":    "#051E27",
    "primary-background-darken-3":    "#051E27",
    "primary-background-lighten-1":   "#0F404F",
    "primary-background-lighten-2":   "#154E5F",
    "primary-background-lighten-3":   "#1A5C6F",

    // ── Secondary — hot magenta (80 % α) ───────────────────────────────────
    "secondary":                      "#FF1E8ECC",
    "secondary-darken-1":             "#E60A76CC",
    "secondary-darken-2":             "#CC005FCC",
    "secondary-darken-3":             "#B20048CC",
    "secondary-lighten-1":            "#FF3CA2CC",
    "secondary-lighten-2":            "#FF5AB6CC",
    "secondary-lighten-3":            "#FF78CACC",
    "secondary-muted":                "#510E39EF",
    "secondary-background":           "#3A0A28",
    "secondary-background-darken-1":  "#2E071F",
    "secondary-background-darken-2":  "#220517",
    "secondary-background-darken-3":  "#220517",
    "secondary-background-lighten-1": "#470D33",
    "secondary-background-lighten-2": "#54103F",
    "secondary-background-lighten-3": "#61134B",

    // ── Accent — chartreuse (80 % α) ───────────────────────────────────────
    "accent":                         "#EEFF00CC",
    "accent-darken-1":                "#D6E600CC",
    "accent-darken-2":                "#BECC00CC",
    "accent-darken-3":                "#A5B200CC",
    "accent-lighten-1":               "#FFFF26CC",
    "accent-lighten-2":               "#FFFF4DCC",
    "accent-lighten-3":               "#FFFF73CC",
    "accent-muted":                   "#4C510EEF",

    // ── Success — neon lime (75 % α) ───────────────────────────────────────
    "success":                        "#39FF14BF",
    "success-darken-1":               "#23E60ABF",
    "success-darken-2":               "#0FCC00BF",
    "success-darken-3":               "#00B200BF",
    "success-lighten-1":              "#4DFF32BF",
    "success-lighten-2":              "#69FF5ABF",
    "success-lighten-3":              "#87FF82BF",
    "success-muted":                  "#164D14F0",

    // ── Warning — neon amber (80 % α) ──────────────────────────────────────
    "warning":                        "#FF6E00CC",
    "warning-darken-1":               "#E65800CC",
    "warning-darken-2":               "#CC4300CC",
    "warning-darken-3":               "#B23000CC",
    "warning-lighten-1":              "#FF8C26CC",
    "warning-lighten-2":              "#FFA54DCC",
    "warning-lighten-3":              "#FFBE73CC",
    "warning-muted":                  "#51260EEF",

    // ── Error — glitch red (75 % α) ────────────────────────────────────────
    "error":                          "#FF1133BF",
    "error-darken-1":                 "#E6051EBF",
    "error-darken-2":                 "#CC000CBF",
    "error-darken-3":                 "#B20000BF",
    "error-lighten-1":                "#FF3758BF",
    "error-lighten-2":                "#FF5A78BF",
    "error-lighten-3":                "#FF7D96BF",
    "error-muted":                    "#510A1DF0",

    // ── Surface ────────────────────────────────────────────────────────────
    "surface":                        "#0F0F22",
    "surface-active":                 "#161630",
    "surface-darken-1":               "#08081A",
    "surface-darken-2":               "#040411",
    "surface-darken-3":               "#020209",
    "surface-lighten-1":              "#17172E",
    "surface-lighten-2":              "#1F1F3C",
    "surface-lighten-3":              "#28284A",

    // ── Panel ──────────────────────────────────────────────────────────────
    "panel":                          "#0C0C1E",
    "panel-darken-1":                 "#060614",
    "panel-darken-2":                 "#03030C",
    "panel-darken-3":                 "#010108",
    "panel-lighten-1":                "#14142C",
    "panel-lighten-2":                "#1C1C3A",
    "panel-lighten-3":                "#242448",

    // ── Scrollbar ──────────────────────────────────────────────────────────
    "scrollbar":                      "#151535",
    "scrollbar-active":               "#00E5FFD9",
    "scrollbar-background":           "#040412",
    "scrollbar-background-active":    "#040412",
    "scrollbar-background-hover":     "#040412",
    "scrollbar-corner-color":         "#040412",
    "scrollbar-hover":                "#1F1F48",

    // ── Block cursor ───────────────────────────────────────────────────────
    "block-cursor-background":         "#00E5FF",
    "block-cursor-blurred-background": "#00E5FF4C",
    "block-cursor-blurred-foreground": "#E2E2FF",
    "block-cursor-foreground":         "#070714",

    // ── Hover / boost overlays ─────────────────────────────────────────────
    "block-hover-background":         "#00E5FF19",
    "boost":                          "#00E5FF0A",
    "boost-darken-1":                 "#00CCE60A",
    "boost-darken-2":                 "#00B2CC0A",
    "boost-darken-3":                 "#0099B30A",
    "boost-lighten-1":                "#00E5FF0A",
    "boost-lighten-2":                "#00E5FF0A",
    "boost-lighten-3":                "#00E5FF0A",

    // ── Border ─────────────────────────────────────────────────────────────
    "border":                         "#00E5FFD9",
    "border-blurred":                 "#1A1A35",

    // ── Button ─────────────────────────────────────────────────────────────
    "button-color-foreground":        "#070714",
    "button-foreground":              "#E2E2FF",

    // ── Footer ─────────────────────────────────────────────────────────────
    "footer-background":              "#0C0C1E",
    "footer-description-background":  "#00000000",
    "footer-description-foreground":  "#E2E2FF",
    "footer-foreground":              "#E2E2FF",
    "footer-item-background":         "#00000000",
    "footer-key-background":          "#00000000",
    "footer-key-foreground":          "#00E5FFD9",

    // ── Input ──────────────────────────────────────────────────────────────
    "input-cursor-background":        "#E2E2FF",
    "input-cursor-foreground":        "#070714",
    "input-selection-background":     "#00E5FF40",

    // ── Link ───────────────────────────────────────────────────────────────
    "link-background":                "#00000000",
    "link-background-hover":          "#00E5FFD9",
    "link-color":                     "#E2E2FFDD",
    "link-color-hover":               "#070714",

    // ── Markdown headings ──────────────────────────────────────────────────
    "markdown-h1-background":         "#00000000",
    "markdown-h1-color":              "#00E5FFD9",
    "markdown-h2-background":         "#00000000",
    "markdown-h2-color":              "#00E5FFD9",
    "markdown-h3-background":         "#00000000",
    "markdown-h3-color":              "#FF1E8ECC",
    "markdown-h4-background":         "#00000000",
    "markdown-h4-color":              "#E2E2FF",
    "markdown-h5-background":         "#00000000",
    "markdown-h5-color":              "#E2E2FF",
    "markdown-h6-background":         "#00000000",
    "markdown-h6-color":              "#E2E2FF99",

    // ── Semantic text roles ────────────────────────────────────────────────
    "text":                           "#E2E2FFDD",
    "text-accent":                    "#F4FF66CC",
    "text-disabled":                  "#E2E2FF60",
    "text-error":                     "#FF6677BF",
    "text-muted":                     "#E2E2FF99",
    "text-primary":                   "#66F0FFD9",
    "text-secondary":                 "#FF80B0CC",
    "text-success":                   "#80FF55BF",
    "text-warning":                   "#FFB055CC",
  },
};

export default theme;
