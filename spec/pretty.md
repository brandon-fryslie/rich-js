# Doc Spec: Pretty Printing

The pretty doc explains automatic formatting of data structures and how to customize how custom objects are represented.

## Sections

### What pretty printing does

Explain that plain print/log automatically formats containers (arrays, objects, maps, sets) by expanding them across multiple lines and indenting nested structures. The output adapts to fit the terminal width.

### Indent guides

Explain that indent guides (vertical lines showing nesting depth) are shown by default. Show `indentGuides: false` to disable.

### Expand all

Explain that by default the formatter tries to fit items on one line. Show `expandAll: true` to always expand every container regardless.

### Truncating long output

Explain the two truncation options:
- `maxLength` — containers with more elements than this value are truncated; the output shows an ellipsis and the count of omitted items
- `maxString` — strings longer than this are truncated; the output shows the character count of what was omitted

Show brief examples of each.

### Pretty as a renderable

Show the Pretty renderable class, which can be used to embed pretty-printed data inside another renderable (e.g., inside a Panel or Table cell).

### Custom object representation

Explain that built-in containers and common data types are handled automatically. For custom objects, implement a `richRepr` method (or equivalent protocol) to control how they appear.

#### The rich repr protocol

Explain the yield-based protocol for describing an object's constructor-like representation:
- `yield value` — positional argument
- `yield name, value` — keyword argument
- `yield name, value, default` — keyword argument, only shown when value differs from default

Show before/after: the default repr of a Bird-like object vs. the rich repr. Emphasize that omitting default arguments is the key readability improvement.

#### Angular bracket style

Explain the option to produce `<ClassName field=value>` style output instead of constructor-call style. Show the configuration.

#### Automatic repr generation

Show a decorator that generates the rich repr automatically when the constructor parameter names match the attribute names.

## Constraints

- The before/after comparison (verbose default repr vs. rich repr) is essential — it motivates why the protocol exists
- The `maxLength` and `maxString` options are important for debugging deeply nested data — present them clearly
- Do not document the repr auto-generation feature as the primary path — it requires matching parameter/attribute names that many objects don't have
