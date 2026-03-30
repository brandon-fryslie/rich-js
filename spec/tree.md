# Doc Spec: Tree

The tree doc explains the Tree renderable for displaying hierarchical data with guide lines.

## Sections

### What it is

One sentence: renders a tree with connecting guide lines. Good for file systems, dependency graphs, or any nested structure.

### Basic usage

Show constructing a Tree with a root label and printing it. Show adding branches with `add()`. Show that `add()` returns a new Tree instance, which can have its own branches — chain this to build depth. Show the rendered output.

### Labels

Explain that labels can be plain strings (markup is supported), styled text objects, or any renderable. This means branches can contain tables, panels, or other complex content.

### Styles

Show the `style` argument on the constructor and `add()` — applies to the branch and all its descendants. Show `guideStyle` for styling the connecting lines. Note that bold guide style selects thicker Unicode line characters; underline2 guide style selects double-line characters.

Explain that styles are inherited by sub-trees.

## Constraints

- Must include an example that builds a multi-level tree (at least 3 levels)
- Must show that any renderable can be a label — not just strings — this is the key power users need to know about
- Do not reproduce a full directory-listing example in the doc — cross-reference an example file
