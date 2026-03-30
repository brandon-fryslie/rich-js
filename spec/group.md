# Doc Spec: Render Groups

The group doc explains how to treat multiple renderables as a single unit in contexts that accept only one.

## Sections

### The problem

State the problem clearly: many renderables (Panel, Layout, etc.) accept only a single renderable as content. When you want to display several renderables inside one of them, you need a way to group them.

### Group constructor

Show constructing a Group with multiple renderables as positional arguments. Show wrapping the Group in a Panel. Show the rendered output.

### Generator / decorator form

Explain that for a large or dynamic set of renderables, yielding from a generator is more natural than building a list. Show the decorator or generator pattern that wraps a function which yields renderables. Show the equivalent output to the constructor example.

## Constraints

- Keep this doc short — Group is a simple combinator
- Must show both forms (constructor and generator) — the generator form is significantly more ergonomic for dynamic content and must not be omitted
- Use Panel-as-container as the example, since it's the most common motivating case
