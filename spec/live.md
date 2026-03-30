# Doc Spec: Live Display

The live doc explains how to animate a region of the terminal with continuously updating content.

## Sections

### What live display is

One paragraph: a live display keeps a renderable in place at the bottom of the terminal, refreshing it as data changes. Progress bars and status indicators are built on top of this. Use it directly when you need custom animated output.

### Basic usage

Show the context manager form: pass a renderable to the Live constructor and mutate the renderable inside the block. The display updates automatically. Use a Table that has rows added in a loop as the example — it shows clearly that mutating the renderable in place works.

### Replacing the renderable

Show calling `update()` on the live context to swap in a completely new renderable. Explain when this is needed: when the content is too dynamic to express as mutations to a single object. Show a function that generates a fresh Table each iteration.

### Alternate screen (fullscreen)

Explain `screen: true` on the constructor — enters fullscreen mode and restores the terminal on exit. Cross-reference Layout for how to structure complex fullscreen content.

### Transient display

Explain `transient: true` — the display disappears when the context exits rather than leaving the final frame in the terminal.

### Auto-refresh

Explain the default refresh rate (4 times per second). Show `refreshPerSecond` for tuning. Show `autoRefresh: false` and the manual `refresh()` call, or `update(renderable, { refresh: true })` to refresh when updating.

### Vertical overflow

Explain what happens when the renderable is taller than the terminal. Document the three modes:
- `crop` — show up to terminal height, hide the rest
- `ellipsis` — same as crop but replace the last visible line with `...` (default)
- `visible` — allow the full renderable (cannot be properly cleared in this mode)

Note that when the live display stops, the last frame is always shown as `visible`.

### Print and log during live display

Explain that output printed to the live display's internal console appears above the live area without disrupting it. Show `live.console.print()`. Show passing a custom Console to the constructor.

Note: if a file-based console is passed, the live display only emits content once the context exits.

### Redirecting stdout/stderr

Explain that by default, built-in print/console.log output is redirected so it doesn't break the live display. Show how to disable this with `redirectStdout` / `redirectStderr`.

### Nesting Live instances

Explain that creating a Live inside an existing Live context shows the inner content below the outer. (Previously this was an error; document the current behavior.)

## Constraints

- The basic usage example must use a mutable renderable (not just `update()`) — this is the more common pattern and should come first
- The print/log section is important: users frequently try to print above a live display and break it. Document the right way.
- Cross-reference the Layout doc for the fullscreen use case — do not duplicate Layout content here
