# CodeFlow Design Brief

## Purpose and status

This brief records the approved design direction for CodeFlow's existing
React, TypeScript, and Vite application. It treats the supplied
data-structure infographics as visual-design inspiration, not as layouts or
product templates to reproduce.

## Inspiration review

All five images in `design/inspiration/` were opened and visually inspected.

### `4 types of queues.jpg`

- **Palette and hierarchy:** Four queue variations use distinct restrained
  colors—mint, coral, blue, and yellow—inside clearly separated examples.
  Labels are prominent and the canvas remains light and uncluttered.
- **Information design:** Front/tail labels, arrows, cell sequences, and a
  circular buffer make order and operation visible without paragraphs.
- **CodeFlow translation:** Give the current loop value, changed list cell,
  and error distinct, consistent semantic treatments. Use indexed list cells
  and an append cue, not queue-specific arrows or circular layouts.

### `data structure java.jpg`

- **Palette and hierarchy:** Green, blue, orange, red, and purple distinguish
  structure families; small headings label each diagram. A single poster
  contains many examples, so individual diagrams have limited text.
- **Information design:** Arrays use adjacent indexed cells; trees and graphs
  use nodes and edges; stacks use ordered blocks with a marked top.
- **CodeFlow translation:** The indexed array is the relevant pattern: show
  Python list values as adjacent cells, each with a visible index. Keep the
  workspace focused on the selected program rather than presenting a catalog
  of data structures.

### `téléchargement (2).jpg`

- **Palette and hierarchy:** A near-black background and electric cyan/blue
  cells create strong contrast. White labels stay legible and color is used
  consistently for data blocks.
- **Information design:** Array cells, queue direction, matrix coordinates,
  and linked-list connections make order, position, and relationships
  explicit.
- **CodeFlow translation:** Use a dark neutral workspace with a vivid but
  controlled cyan/teal data accent. Make list indices persistent and values
  easy to compare. Avoid implying pointer connections for ordinary Python
  lists.

### `téléchargement (3).jpg`

- **Palette and hierarchy:** The dark systems infographic assigns each topic
  its own accent—cyan, green, orange, violet, and pink—while preserving a
  shared neutral frame, consistent borders, and compact labels.
- **Information design:** Dashed arrows show direction or relationships;
  grids, nodes, buckets, and blocks change shape to match the structure.
- **CodeFlow translation:** Reserve color roles instead of giving every UI
  panel an unrelated accent: for example, cyan for list data, violet for
  variables, amber for the active execution line, and coral for errors. Use
  arrows only for actual execution direction or list changes.

### `téléchargement (4).jpg`

- **Palette and hierarchy:** The light infographic uses a different, vivid
  hue for each structure, with rounded section borders and colored headings.
  Its white background and poster density are not a layout to copy.
- **Information design:** Arrays again use indexed rectangular cells; linked
  lists use connected blocks; stacks use layered blocks and a `top` label.
- **CodeFlow translation:** Retain the useful cell/index pairing and precise
  labels. Adapt it to dark surfaces and show the one active list and current
  execution state, rather than many unrelated structures at once.

## Design direction

Build a **focused execution bench**: a dark, neutral developer workspace in
which syntax, execution position, variables, and list cells are the strongest
visual elements. Use the references' blue/cyan data vocabulary and their
explicit labels and geometry, while keeping CodeFlow's own one-program,
step-by-step workflow.

The implemented direction uses deep charcoal-blue surfaces, a distinct
editor background, cyan/teal list data, violet variable identifiers, amber
execution markers, coral errors, and mint success feedback. The active source
line has both an amber band and a gutter marker. List values are displayed as
indexed rectangular cells, with the newly appended cell highlighted from
real adjacent snapshots. Panel hierarchy, typography, and control contrast
are strengthened without borrowing the infographics' poster layouts.

## User journey

1. **Orient:** The student sees the CodeFlow name, a concise explanation, and
   that execution is local and restricted to a supported subset.
2. **Choose or edit:** A small example selector loads the target list loop;
   the student can edit the code in the editor.
3. **Run:** Run parses and interprets the input. A syntax or runtime error is
   shown with a source line and explanation; unsupported syntax is not
   simulated.
4. **Inspect the first state:** The editor highlights the executed line; the
   state inspector shows the variables and the exact list contents from that
   same typed snapshot.
5. **Predict:** Before each forward step that executes a source line, the
   student predicts the value or list state that changes next. The app checks
   the answer against the next actual interpreter snapshot and gives clear
   correct/incorrect feedback.
6. **Reveal and compare:** Next shows that snapshot and its source line;
   Previous revisits earlier states. The list's indices and values update
   from the selected snapshot, not from separately constructed display data.
7. **Finish or restart:** The final state is explicitly marked complete.
   Reset returns to the initial snapshot so the student can trace again.

## Minimum screens and interaction states

Use one responsive workspace, not a multi-page application. Required states:

- **Ready:** Selected example is visible; no trace has run; controls and memory
  communicate that there is no execution state yet.
- **Trace active:** A selected snapshot drives the highlighted source line,
  values, list cells, output, progress, and prediction prompt.
- **Prediction pending:** Next is gated until the student submits an answer.
- **Prediction checked:** Correct and incorrect answers are distinguished;
  the student can reveal the actual next snapshot either way.
- **Complete:** Final values/output remain visible; no further forward step is
  offered; reset is available.
- **Error:** Syntax, unsupported syntax, and runtime failures are explained
  with line information. If earlier execution steps exist, the student can
  inspect those snapshots.

The empty/initial snapshot and the final snapshot are distinct states. An
error must not be presented as a successful completed trace.

## Main workspace layout

At desktop widths, use two primary columns with restrained panel boundaries:

- **Header:** CodeFlow identity, one-line learning purpose, and local/restricted
  execution status.
- **Example and editor column:** A compact example selector and code editor
  with line numbers. Highlight exactly `snapshot.currentLine`; keep the code
  text and line positions aligned.
- **Execution controls:** Previous, Next, and Reset, plus a timeline/progress
  indicator. Keep controls adjacent to the trace rather than making them a
  decorative dashboard card. Gate Next on prediction when a next snapshot
  exists.
- **Live-state inspector:** Scalar variables and loop variables shown as
  labeled name/value rows. Lists receive a dedicated visualization. Output
  and errors have their own labeled region.
- **Prediction interaction:** Place the prompt near the controls and current
  state. State which variable or list is being predicted, accept a suitable
  answer, and explain the result before advancing.

At narrow widths, stack editor, execution controls/prediction, and state
inspector in a clear reading order. Keep the editor horizontally scrollable
for long source lines without causing document-level horizontal overflow.

## Data visualization principles

- Render Python lists as left-to-right rectangular cells with a persistent
  zero-based index label and a clearly separated value. An empty list should
  still have a labeled empty state.
- Keep each cell's index visually subordinate to, but always associated with,
  its value. Do not use color alone to communicate position or change.
- On a new snapshot, emphasize the value/cell that actually changed (for
  example, the appended cell) while preserving the previous cells' position.
  Any emphasis must be derived by comparing adjacent real snapshots.
- Show loop variables such as `i` in the same snapshot as the list they
  update. Do not hide a changed loop variable because the list is the primary
  lesson.
- Show current source line, variable values, list cells, output, and progress
  from the same selected snapshot. Avoid independent UI state that can drift.
- Use a simple ordered row for a Python list; do not draw linked nodes,
  pointers, trees, queues, or graphs unless the executed data structure truly
  has those relationships.

## Proposed design system

### Color roles

- **Canvas:** Near-black blue/charcoal, with subtly differentiated editor and
  inspector surfaces.
- **Primary text:** Soft white; **secondary text:** cool neutral gray.
- **Data accent:** Cyan/teal for list values and newly changed cells, inspired
  by the dark cell diagrams.
- **Variable accent:** A restrained violet or blue for variable names, kept
  distinct from values.
- **Execution accent:** Amber for the current line and loop position, with a
  clear line marker as well as color.
- **Error accent:** Coral/red reserved for syntax, unsupported syntax, and
  runtime errors.
- **Success:** Muted mint for correct predictions and completion.

Validate text contrast against WCAG AA (at least 4.5:1 for normal text and
3:1 for large text and meaningful UI boundaries). Do not rely on hue alone:
pair accents with labels, icons, line markers, or shape.

### Typography

- Use a legible system sans-serif for instructions, navigation, and labels.
- Use a well-spaced monospace for source, identifiers, indices, values, and
  output.
- Establish hierarchy through size, weight, and spacing; avoid tiny all-caps
  labels for essential instructions.

### Spacing, borders, and components

- Use a consistent 4px spacing base, with primary gaps around 16px and
  section spacing around 24px.
- Use thin, low-contrast borders to distinguish work areas, not to box every
  value into a card.
- Keep list cells rectangular, evenly spaced, and index-labeled. Use compact
  variable rows and a clearly separated output area.
- Use one high-emphasis primary Run/Next action at a time; make Previous and
  Reset   visible but secondary. The transition from the last executed line to the
  final, unhighlighted snapshot does not ask the student to predict a
  nonexistent next line.
- Give keyboard focus a visible high-contrast outline and preserve usable
  target sizes.

### Motion

Use a short, subtle transition only when the selected snapshot changes or a
new list cell appears. Respect `prefers-reduced-motion`; animation must never
delay stepping or obscure the actual state.

## Existing implementation and smallest plan

The project already uses React 19, TypeScript, and Vite, with the restricted
interpreter in `src/trace.ts`, the workspace in `src/App.tsx`, styling in
`src/App.css` and `src/index.css`, and interpreter tests in
`tests/trace.test.mjs`. It already includes an editable code area, two example
programs, snapshots, prediction gating, navigation, output/error feedback,
and bounded source, loop, output, and snapshot sizes. No extra framework or
execution dependency is needed for this proposal.

The selected default example currently builds `doubled` from `[2, 4, 6]`,
rather than demonstrating the requested `numbers = []` and appending
`i * 2`. The interpreter already runs that requested subset correctly.

After approval, implement incrementally:

1. Make the requested list-building program the primary/default example and
   add a focused test asserting `[ ]`, `[0]`, `[0, 2]`, `[0, 2, 4]`, loop
   variable values, and current-line alignment at the relevant snapshots.
2. Refine the existing workspace in `App.tsx`/CSS rather than replacing its
   architecture. Make the execution controls, current-line indicator, and
   list-cell changes the visual focus; improve the responsive reading order
   as needed.
3. Verify that every display uses the selected `Snapshot`; exercise correct
   and incorrect predictions, Previous/Next/Reset, completion, unsupported
   syntax, runtime errors, and narrow widths. Run the existing test, lint,
   and build scripts.

Do not add a backend, authentication, AI, database, Pyodide, CodeMirror, or
unrelated screens as part of this design pass.

## Measurable acceptance criteria

1. The default editor contains the requested three-line program and Run
   produces list snapshots in order: `[]`, `[0]`, `[0, 2]`, `[0, 2, 4]`.
2. For every displayed snapshot, the highlighted source line, loop variable,
   list cells/indices, and output correspond to that same snapshot. The final
   snapshot is identifiable and has no falsely highlighted executed line.
3. Previous, Next, and Reset navigate correctly. When prediction is required,
   Next is disabled before checking; both correct and incorrect answers
   provide feedback and allow the student to reveal the real next state. No
   prediction is requested between the last executed line and the final
   snapshot.
4. Unsupported syntax, syntax errors, and runtime errors produce visible,
   understandable messages and do not masquerade as a successful trace.
5. List indices and values remain readable at desktop and 320px-wide mobile
   viewports; the document itself has no horizontal overflow.
6. Text and controls meet the stated contrast targets; interactive controls
   are keyboard accessible with visible focus, and color is not the sole
   signal for active lines, errors, or prediction feedback.
7. Any list-change motion respects reduced-motion preference and never
   changes execution order or snapshot content.
8. Existing and new interpreter tests, lint, and production build pass.
