# Doc Spec: Prompt

The prompt doc explains the Prompt classes for collecting validated input from the user.

## Sections

### What prompts do

One paragraph: Prompt classes display a question, read a line of input, validate it, and loop until a valid response is received. The prompt text can contain markup and emoji.

### Basic string prompt

Show the simplest form: a prompt string, the user types, and a string is returned.

### Default value

Show providing a default that is returned when the user presses enter without typing anything. Show how the default appears in the displayed prompt.

### Constrained choices

Show providing a list of valid choices. The prompt loops until the user enters one of them. Show the `caseSensitive: false` option.

### Typed prompts

Describe the specialized prompt types:
- Integer prompt — parses and validates that input is an integer
- Float prompt — parses and validates that input is a floating-point number

Show a brief example of each.

### Confirm prompt

Show the yes/no confirm prompt. Show that it returns a boolean. Show an example assertion to make clear what it returns.

### Customization

Note that the Prompt class is designed for subclassing. Mention where to look for examples.

## Constraints

- Keep this doc short — Prompt is a narrow API
- All four forms (basic, default, choices, confirm) must be shown with examples
- Do not document the internal prompt loop or validation mechanism
