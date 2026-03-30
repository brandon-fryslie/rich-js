# Doc Spec: Renderable Protocol

The protocol doc explains how to make custom objects render with the library's formatting. This is the extension point for the entire library.

## Sections

### What the protocol is

One paragraph: any object can opt into rich formatting by implementing a known interface. When the library encounters such an object in print or log, it calls the interface instead of converting to a plain string. Use this for custom presentation and debugging displays.

### Simple customization

Show the simplest protocol: a method that returns another renderable (string with markup, a Table, etc.). Demonstrate with a class that returns a markup string. Explain that returning a plain string causes it to be rendered as markup.

### Full render protocol

Explain that the simple form is limited to returning a single object. For richer output — yielding multiple renderables, responding to available width — implement the full render method.

Describe the render method signature:
- Receives render options (including `maxWidth`)
- Returns an iterable of other renderables (generator recommended)

Show an example that yields a heading string and a Table, so the reader sees how to produce multi-part output.

### Low-level rendering

For complete control, show yielding Segment objects directly — a text string paired with an optional style. This bypasses higher-level layout and is only needed for precise character-level control.

### Measuring renderables

Explain why measurement exists: components like Table need to know how wide a renderable will be to compute column widths. If a custom renderable is used inside a Table or Layout, it must declare its width range.

Describe the measure interface:
- Receives render options
- Returns a minimum and maximum character width

Explain minimum and maximum: minimum is the smallest the content can render without loss, maximum is its natural/ideal width. Use a chess board (always 8 characters wide) as a memorable concrete example.

## Constraints

- Must present the three levels (simple, full render, low-level) in order from easiest to most powerful
- Each level must have a working code example — this is a protocol doc, not a reference
- Do not describe how the library calls these methods internally
- The measurement section must make concrete why measurement is needed (not just what it is) — without it, custom renderables inside Tables will not size correctly
