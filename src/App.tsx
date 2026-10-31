import { useMemo, useState, type KeyboardEvent } from 'react'
import './App.css'
import { displayValue, runPythonTrace, type PythonValue, type Snapshot, type TraceResult } from './trace'

const examples = {
  lists: {
    name: 'Build a list in a loop',
    description: 'Append each loop value multiplied by two.',
    code: [
      'numbers = []',
      'for i in range(3):',
      '    numbers.append(i * 2)',
    ].join('\n'),
  },
  total: {
    name: 'Add a running total',
    description: 'Watch a total accumulate as the loop variable changes.',
    code: [
      'total = 0',
      'for number in range(1, 5):',
      '    total = total + number',
      'print(total)',
    ].join('\n'),
  },
} as const

type ExampleId = keyof typeof examples
type PredictionValue = PythonValue | string

interface PredictionTarget {
  label: string
  value: PredictionValue
  isOutput?: boolean
}

function getPredictionTarget(previous: Snapshot, next: Snapshot): PredictionTarget {
  if (previous.output !== next.output) {
    return { label: 'printed output', value: next.output, isOutput: true }
  }
  const changedName = [...new Set([...Object.keys(previous.variables), ...Object.keys(next.variables)])].find(
    (name) => JSON.stringify(previous.variables[name]) !== JSON.stringify(next.variables[name]),
  )

  if (changedName) return { label: changedName, value: next.variables[changedName] }
  const listName = Object.keys(next.variables).find((name) => Array.isArray(next.variables[name]))
  if (listName) return { label: listName, value: next.variables[listName] }
  if (Object.keys(next.variables).length > 0) {
    const name = Object.keys(next.variables)[0]
    return { label: name, value: next.variables[name] }
  }
  return { label: 'printed output', value: next.output }
}

function matchesPrediction(answer: string, expected: PredictionValue, isOutput = false): boolean {
  const guess = answer.trim()
  if (Array.isArray(expected)) {
    const normalized = guess.replace(/\s/g, '')
    return normalized === JSON.stringify(expected)
  }
  if (typeof expected === 'number') return guess === String(expected)
  if (isOutput) return answer.replace(/\n+$/, '') === expected.replace(/\n+$/, '')
  return answer === expected
}

function App() {
  const [exampleId, setExampleId] = useState<ExampleId>('lists')
  const [code, setCode] = useState<string>(examples.lists.code)
  const [trace, setTrace] = useState<TraceResult | null>(null)
  const [step, setStep] = useState(0)
  const [prediction, setPrediction] = useState('')
  const [checks, setChecks] = useState<Record<number, boolean>>({})
  const [feedback, setFeedback] = useState<Record<number, boolean>>({})

  const snapshots = trace?.snapshots ?? []
  const snapshot = snapshots[step]
  const previousSnapshot = snapshots[step - 1]
  const nextSnapshot = snapshots[step + 1]
  const target = snapshot && nextSnapshot ? getPredictionTarget(snapshot, nextSnapshot) : null
  const predictionRequired = Boolean(target && nextSnapshot?.currentLine !== null && nextSnapshot?.currentLine !== undefined)
  const isComplete = Boolean(trace && !trace.error && step === snapshots.length - 1 && snapshot?.currentLine === null)
  const lineCount = Math.max(1, code.split('\n').length)
  const codeWidth = Math.max(
    0,
    ...code.split('\n').map((line) => line.length),
  ) * 7.5
  const completedEvents = trace ? Math.max(0, step) : 0
  const progress = trace && snapshots.length > 1 ? (step / (snapshots.length - 1)) * 100 : 0

  const variables = useMemo(() => Object.entries(snapshot?.variables ?? {}), [snapshot])
  const lists = useMemo(() => Object.entries(snapshot?.lists ?? {}), [snapshot])

  function runCode() {
    const result = runPythonTrace(code)
    setTrace(result)
    setStep(result.error ? result.snapshots.length - 1 : 0)
    setPrediction('')
    setChecks({})
    setFeedback({})
  }

  function chooseExample(value: ExampleId) {
    setExampleId(value)
    setCode(examples[value].code)
    setTrace(null)
    setStep(0)
    setPrediction('')
    setChecks({})
    setFeedback({})
  }

  function checkPrediction() {
    if (!target || !snapshot) return
    const correct = matchesPrediction(prediction, target.value, target.isOutput)
    setChecks((current) => ({ ...current, [step]: true }))
    setFeedback((current) => ({ ...current, [step]: correct }))
  }

  function goToStep(nextStep: number) {
    setStep(nextStep)
    setPrediction('')
  }

  function resetTrace() {
    if (!trace) {
      setStep(0)
      setPrediction('')
      return
    }
    setStep(0)
    setPrediction('')
    setChecks({})
    setFeedback({})
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const editor = event.currentTarget
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const updated = `${code.slice(0, start)}    ${code.slice(end)}`
    setCode(updated)
    requestAnimationFrame(() => {
      editor.selectionStart = editor.selectionEnd = start + 4
    })
  }

  const exampleDescription = examples[exampleId].description

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="CodeFlow home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>codeflow</span>
        </a>
        <div className="topbar-right">
          <span className="local-badge"><span /> Runs locally</span>
          <span className="topbar-divider" />
          <span className="language-badge">PYTHON · BEGINNER</span>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">LEARN BY TRACING</p>
          <h1>Make every loop <span>make sense.</span></h1>
          <p className="intro-copy">
            Step through Python one line at a time. Predict what changes, then see the state for yourself.
          </p>
        </div>
        <div className="example-picker">
          <label htmlFor="example-select">START WITH AN EXAMPLE</label>
          <select
            id="example-select"
            value={exampleId}
            onChange={(event) => chooseExample(event.target.value as ExampleId)}
          >
            {Object.entries(examples).map(([id, example]) => (
              <option key={id} value={id}>{example.name}</option>
            ))}
          </select>
          <p>{exampleDescription}</p>
        </div>
      </section>

      <section className="workspace" aria-label="Python tracing workspace">
        <div className="editor-panel panel">
          <div className="panel-heading editor-heading">
            <div className="panel-title-group">
              <span className="panel-kicker">01 / YOUR PROGRAM</span>
              <h2>Code editor</h2>
            </div>
            <span className="file-pill"><span className="python-dot">Py</span> main.py</span>
          </div>

          <div className="editor-scroll" style={{ maxHeight: `${Math.min(460, Math.max(220, lineCount * 27 + 48))}px` }}>
            <div className="editor-content" style={{ width: `${codeWidth + 92}px`, height: `${lineCount * 27 + 48}px` }}>
              {snapshot?.currentLine !== null && snapshot?.currentLine !== undefined && (
                <div
                  className="active-line-band"
                  style={{ top: `${24 + (snapshot.currentLine - 1) * 27}px` }}
                  aria-hidden="true"
                />
              )}
              <div className="line-gutter" aria-hidden="true">
                {Array.from({ length: lineCount }, (_, index) => (
                  <span
                    className={snapshot?.currentLine === index + 1 ? 'active' : ''}
                    key={index + 1}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                ))}
              </div>
              <textarea
                aria-label="Python code editor"
                className="code-input"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder="Write a supported Python snippet…"
                style={{ width: `${codeWidth}px`, height: `${lineCount * 27 + 48}px` }}
              />
            </div>
          </div>
          <div className="editor-footer">
            <p><span className="editor-dot" /> {trace ? (trace.error ? 'Trace stopped' : 'Trace ready') : 'Ready to trace'}</p>
            <span>Spaces: 4</span>
          </div>

          <div className="run-row">
            <button type="button" className="primary-button" onClick={runCode}>
              <span aria-hidden="true">▶</span> Run trace
            </button>
            <span className="run-hint">Only the documented Python subset is executed.</span>
          </div>
        </div>

        <div className="state-column">
          <section className="panel state-panel" aria-live="polite">
            <div className="panel-heading">
              <div className="panel-title-group">
                <span className="panel-kicker">02 / LIVE STATE</span>
                <h2>Memory</h2>
              </div>
              <span className="step-chip">{snapshot ? `STEP ${String(step).padStart(2, '0')}` : 'NOT RUN'}</span>
            </div>

            <div className="state-content">
              <div className="state-section">
                <div className="section-label"><span className="state-icon">x</span> VARIABLES</div>
                {variables.length ? (
                  <div className="variable-list">
                    {variables.filter(([, value]) => !Array.isArray(value)).map(([name, value]) => (
                      <div className="variable-row" key={name}>
                        <code>{name}</code>
                        <span className="equals">=</span>
                        <span className="variable-value">{displayValue(value)}</span>
                      </div>
                    ))}
                    {!variables.some(([, value]) => !Array.isArray(value)) && (
                      <p className="empty-state">No scalar variables yet.</p>
                    )}
                  </div>
                ) : (
                  <p className="empty-state">{trace ? 'No variables in this snapshot.' : 'Run the code to see values here.'}</p>
                )}
              </div>

              <div className="state-section list-section">
                <div className="section-label"><span className="state-icon list-icon">[]</span> LISTS</div>
                {lists.length ? (
                  <div className="list-collection">
                    {lists.map(([name, values]) => (
                      <div className="visual-list" key={name}>
                        <div className="list-name"><code>{name}</code><span>{values.length} {values.length === 1 ? 'item' : 'items'}</span></div>
                        <div className="list-cells">
                          {values.length ? values.map((value, index) => (
                            <div
                              className={`list-cell${previousSnapshot && (previousSnapshot.lists[name]?.[index] !== value || index >= (previousSnapshot.lists[name]?.length ?? 0)) ? ' changed' : ''}`}
                              key={`${index}-${value}`}
                            >
                              <span className="cell-index">{index}</span>
                              <strong>{value}</strong>
                            </div>
                          )) : <span className="empty-list">empty list</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">{trace ? 'No lists in this snapshot.' : 'List cells will appear here.'}</p>
                )}
              </div>

              <div className="state-section output-section">
                <div className="section-label"><span className="state-icon output-icon">›_</span> OUTPUT</div>
                <pre className="output-box">{snapshot?.output || <span className="output-placeholder">Nothing printed yet.</span>}</pre>
                {trace?.error && (
                  <div className="error-message" role="alert">
                    <strong>Trace stopped</strong>
                    <span>{trace?.error}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="bottom-grid">
        <section className="panel controls-panel" aria-label="Execution controls">
          <div className="panel-heading controls-heading">
            <div className="panel-title-group">
              <span className="panel-kicker">03 / EXECUTION</span>
              <h2>Step through</h2>
            </div>
            <span className="progress-label">
              {trace && !trace.error
                ? isComplete ? 'COMPLETE' : `${completedEvents} / ${snapshots.length - 1} STEPS`
                : trace?.error ? 'ERROR' : 'WAITING'}
            </span>
          </div>
          <div className="timeline" aria-label={`Trace progress ${Math.round(progress)} percent`}>
            <span className="timeline-fill" style={{ width: `${progress}%` }} />
            <span className="timeline-marker" style={{ left: `${progress}%` }} />
          </div>
          <div className="timeline-labels"><span>START</span><span>{trace && !trace.error ? `${Math.round(progress)}%` : 'END'}</span></div>
          <div className="control-buttons">
            <button type="button" className="secondary-button" onClick={() => goToStep(Math.max(0, step - 1))} disabled={!trace || step === 0}>
              <span aria-hidden="true">←</span> Previous
            </button>
            <button type="button" className="reset-button" onClick={resetTrace} disabled={!trace}>
              <span aria-hidden="true">↺</span> Reset
            </button>
            <button
              type="button"
              className="primary-button next-button"
              onClick={() => goToStep(Math.min(snapshots.length - 1, step + 1))}
              disabled={!trace || !nextSnapshot || (!trace.error && predictionRequired && !checks[step])}
            >
              Next <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <section className="panel prediction-panel">
          <div className="panel-heading">
            <div className="panel-title-group">
              <span className="panel-kicker">04 / YOUR TURN</span>
              <h2>Predict the next state</h2>
            </div>
            <span className="predict-mark" aria-hidden="true">?</span>
          </div>
          {target && snapshot && predictionRequired && !trace?.error ? (
            <form
              className="prediction-form"
              onSubmit={(event) => {
                event.preventDefault()
                checkPrediction()
              }}
            >
              <label htmlFor="prediction-input">
                What will <code>{target.label}</code> be after the next line?
              </label>
              <div className="prediction-controls">
                <input
                  id="prediction-input"
                  value={prediction}
                  onChange={(event) => setPrediction(event.target.value)}
                  placeholder={Array.isArray(target.value) ? '[ e.g. 2, 4 ]' : 'Type your prediction'}
                  autoComplete="off"
                  disabled={checks[step]}
                />
                <button
                  type="submit"
                  className="check-button"
                  disabled={(!prediction.trim() && !(target.isOutput && target.value === '\n')) || checks[step]}
                >
                  Check
                </button>
              </div>
              {checks[step] && (
                <p className={`feedback ${feedback[step] ? 'correct' : 'incorrect'}`} role="status">
                  <span aria-hidden="true">{feedback[step] ? '✓' : '↻'}</span>
                  {feedback[step] ? 'That’s right. You predicted the next state.' : 'Not quite. Step forward to reveal the actual state.'}
                </p>
              )}
            </form>
          ) : isComplete ? (
            <div className="complete-message"><span>✓</span><div><strong>Trace complete</strong><p>Review the final variables, list contents, and output above.</p></div></div>
          ) : nextSnapshot?.currentLine === null && !trace?.error ? (
            <div className="challenge-empty">
              <p>This was the last executed line.</p>
              <span>Reveal the final state to finish the trace.</span>
            </div>
          ) : (
            <div className="challenge-empty">
              <p>{trace?.error ? 'Trace stopped at an error. Use Previous to inspect completed steps, or edit and run again.' : 'Run your program to unlock the prediction challenge.'}</p>
              <span>Make a guess before revealing each next snapshot.</span>
            </div>
          )}
        </section>
      </section>

      <footer className="page-footer">
        <span>CODEFLOW <span className="footer-dot">·</span> A SMALL PYTHON TRACING LAB</span>
        <span>Runs in your browser. No code is sent anywhere.</span>
      </footer>
    </main>
  )
}

export default App
