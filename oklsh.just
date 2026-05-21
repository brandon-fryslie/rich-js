# OKLCH theme-transposition demo recipes.
#
# `explore` is the headline: an interactive TUI that pages through all themes
# on the left and transposes the selected one live on the right. `tui`/`web`
# are the older non-interactive snapshot + HTML export, kept for CI-friendly
# (no-TTY) output. `default` aliases `explore` — the bare `just oklsh` opens
# the interactive view.

default: explore

# Interactive explorer (requires a TTY): ↑/↓ theme · Tab control · ←/→ adjust.
explore:
    npm run themes:explore

# Non-interactive snapshot — prints the static showcase to the terminal.
tui:
    npm run themes:transposed

# Non-interactive snapshot + HTML export at the given path.
web out="/tmp/transpose-demo.html":
    EXPORT_HTML={{ out }} npm run themes:transposed
