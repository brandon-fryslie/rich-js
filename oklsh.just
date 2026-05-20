# OKLCH theme-transposition demo recipes.
#
# `web` is a superset of `tui` — it prints the same terminal output AND
# writes the HTML file, in a single run of the demo. So `default` aliases
# `web`: "give me everything in one pass." [LAW:dataflow-not-control-flow]

default: web

# Terminal view only — no file written.
tui:
    npm run themes:transposed

# Terminal view + HTML export at the given path.
web out="/tmp/transpose-demo.html":
    EXPORT_HTML={{ out }} npm run themes:transposed
