<<<<<<< HEAD
# CodeFlow

CodeFlow helps beginner CS students understand Python loops and lists through
interactive, step-by-step visual execution. The app runs a small, explicit
Python-like subset in the browser, then connects each code line to a snapshot
of the same interpreter state.

The default example builds a list in a loop:

```python
numbers = []
for i in range(3):
    numbers.append(i * 2)
```

The list grows through `[]`, `[0]`, `[0, 2]`, and `[0, 2, 4]`. Loop-header
snapshots also show the current value of `i`.

## Run locally

Requires Node.js 24 or newer and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Verify the app with:

```sh
npm test
npm run lint
npm run build
```

## Supported syntax

The trace engine is an interpreter for a deliberately restricted subset, not
a full Python implementation. It supports:

- Whole-number literals and arithmetic: `+`, `-`, `*`, `//`, `%`, unary signs,
  and parentheses.
- Single- or double-quoted strings, including common escaped characters.
- Variable assignments, including assignments that replace an existing value.
- Number lists, indexing with a non-negative integer, and `len()` for lists
  and strings.
- `list.append(number)` for adding a whole number to a list.
- `for name in range(stop):`, `range(start, stop)`, and
  `range(start, stop, step)` with a single, four-space-indented, non-nested body.
- `print(expression)`, comments, and blank lines.

Indentation must use spaces. Each non-blank loop body line uses exactly four
spaces. All other statements are top-level. Assignments, `print`, and
`list.append` each create a step; a loop iteration creates a step for its
header and each body statement. The initial state and final state are also
shown. The current line is the line that just executed; final snapshots have
no highlighted line. A syntax error is detected before program execution.

Conditionals, nested loops, functions, imports, floating-point values, negative
list indices, list assignment, and arbitrary Python are not supported. These
inputs produce a trace error rather than simulated output.

## Limits and safety

- Source is parsed and interpreted locally. Code is not sent to a server or AI
  service.
- The engine does not use `eval`, `Function`, or Python execution.
- Input is limited to 4,000 characters, expressions to 1,000 tokens and
  64 levels of nesting, each `range()` to 100 iterations, traces to 500
  snapshots, and displayed output to 2,000 characters.
- Numbers must remain safe whole numbers; arithmetic errors, undefined names,
  invalid list operations, and unsupported syntax are shown with a line.
- User code and output are rendered as text, not HTML.
- The interpreter is not a full Python runtime or a complete security
  sandbox. Browser responsiveness is protected by small input, iteration,
  expression, and trace limits rather than a worker timeout. The UI and
  interpreter execute synchronously, but accepted programs have bounded work.

## Project structure

- `src/trace.ts` — typed snapshots, parser, restricted interpreter, and limits.
- `src/App.tsx` — editor, examples, state panels, navigation, and prediction.
- `tests/trace.test.mjs` — interpreter, output, error, and resource-limit tests.

The editor is a lightweight native text area with synchronized line numbers
and current-line highlighting. CodeMirror and Pyodide are not used; the small
parser is easier to audit and keeps the supported semantics explicit.
=======
# codeflow
>>>>>>> origin/main
