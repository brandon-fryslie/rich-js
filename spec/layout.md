# Doc Spec: Layout

The layout doc explains how to divide the terminal into named regions and assign content to each.

## Sections

### What layout is

One sentence: Layout divides the screen into named areas that can each hold an independent renderable. It works standalone and with Live for full-screen applications.

### Creating a layout

Show constructing a Layout and printing it. Explain that an empty layout renders as a placeholder box showing its dimensions.

### Splitting

Show `splitColumn()` to divide a layout vertically (stacked rows). Show `splitRow()` to divide a layout horizontally (side-by-side columns). Show that layouts can be accessed by name with bracket syntax and split further, building a tree of regions. Use a three-pane example (upper half, lower-left quarter, lower-right quarter) to show both split types.

### Setting content

Show two ways to assign a renderable to a layout region:
1. Passing the renderable as the first argument to the Layout constructor
2. Calling `update()` on a named sub-layout

### Fixed size

Show setting `size` on a sub-layout to fix it to an exact number of rows (or columns, if inside a row split). Explain that fixed layouts take their space first; remaining space is distributed among flexible layouts.

### Ratio

Show setting `ratio` on a sub-layout to control proportional space allocation. Explain the arithmetic: a layout with ratio 2 alongside one with ratio 1 takes two-thirds of the space.

### Minimum size

Show `minimumSize` to prevent a flexible layout from shrinking below a threshold.

### Visibility

Show setting `visible` to false to hide a region (neighboring regions expand to fill the space). Show re-enabling it. Mention this can be used to toggle panels based on application state.

### Debug tree

Show printing `layout.tree` to visualize the full layout hierarchy as a tree.

## Constraints

- All split examples must name sub-layouts — anonymous layouts cannot be retrieved by name later and are confusing in examples
- Must show the combined Layout + Live pattern in a brief note or example (cross-reference the Live doc for fullscreen) — this is the primary use case
- Do not describe internal size calculation
