import assert from 'node:assert/strict'
import test from 'node:test'
import { runPythonTrace } from '../src/trace.ts'

test('traces the introductory loop with exact list values and source lines', () => {
  const result = runPythonTrace(
    'numbers = []\n' +
      'for i in range(3):\n' +
      '    numbers.append(i * 2)',
  )

  assert.equal(result.error, null)
  assert.deepEqual(
    result.snapshots.map(({ currentLine, variables, lists }) => ({
      currentLine,
      i: variables.i,
      numbers: lists.numbers,
    })),
    [
      { currentLine: null, i: undefined, numbers: undefined },
      { currentLine: 1, i: undefined, numbers: [] },
      { currentLine: 2, i: 0, numbers: [] },
      { currentLine: 3, i: 0, numbers: [0] },
      { currentLine: 2, i: 1, numbers: [0] },
      { currentLine: 3, i: 1, numbers: [0, 2] },
      { currentLine: 2, i: 2, numbers: [0, 2] },
      { currentLine: 3, i: 2, numbers: [0, 2, 4] },
      { currentLine: null, i: 2, numbers: [0, 2, 4] },
    ],
  )
})

test('traces list mutation, indexed reads, and each loop body statement', () => {
  const result = runPythonTrace(
    'numbers = [2, 4, 6]\n' +
      'doubled = []\n' +
      'for number in range(3):\n' +
      '    doubled.append(numbers[number] * 2)',
  )

  assert.equal(result.error, null)
  assert.deepEqual(
    result.snapshots.map(({ currentLine, variables }) => [currentLine, variables.doubled]),
    [
      [null, undefined],
      [1, undefined],
      [2, []],
      [3, []],
      [4, [4]],
      [3, [4]],
      [4, [4, 8]],
      [3, [4, 8]],
      [4, [4, 8, 12]],
      [null, [4, 8, 12]],
    ],
  )
  assert.deepEqual(result.snapshots[4].lists.doubled, [4])
  assert.equal(result.snapshots.at(-1)?.currentLine, null)
})

test('traces arithmetic and output from the same statement state', () => {
  const result = runPythonTrace(
    'total = 0\n' +
      'for number in range(1, 5):\n' +
      '    total = total + number\n' +
      'print(total)',
  )
  assert.equal(result.error, null)
  assert.equal(result.snapshots.at(-2)?.variables.total, 10)
  assert.equal(result.snapshots.at(-1)?.output, '10\n')
  assert.equal(result.snapshots.at(-2)?.currentLine, 4)
})

test('returns a line-specific syntax error without executing malformed input', () => {
  const result = runPythonTrace('count = 1\nif count:\n    print(count)')
  assert.match(result.error ?? '', /Line 2: Unsupported statement/)
  assert.equal(result.snapshots.at(-1)?.currentLine, 2)
  assert.equal(
    result.snapshots.at(-1)?.error,
    'Unsupported statement. Use assignment, print(value), list.append(value), or a for-range loop.',
  )
  assert.deepEqual(Object.fromEntries(Object.entries(result.snapshots.at(-1).variables)), {})
})

test('reports runtime errors and rejects oversized ranges and unsupported expressions', () => {
  const runtime = runPythonTrace('value = missing')
  assert.match(runtime.error ?? '', /Line 1: Name "missing" is not defined/)

  const range = runPythonTrace('for n in range(101):\n    value = n')
  assert.match(range.error ?? '', /limited to 100 iterations/)

  const unsupported = runPythonTrace('value = 1 / 2')
  assert.match(unsupported.error ?? '', /Unsupported character "\/"/)
})

test('stops tracing at the snapshot limit', () => {
  const body = Array.from({ length: 6 }, () => '    value = n').join('\n')
  const result = runPythonTrace(`for n in range(100):\n${body}`)
  assert.match(result.error ?? '', /500-snapshot limit/)
  assert.equal(result.snapshots.length, 500)
  assert.equal(result.snapshots.at(-1)?.error?.includes('500-snapshot limit'), true)
})

test('prevents prototype-named variables from affecting trace state', () => {
  const result = runPythonTrace('__proto__ = 2\nvalue = __proto__ + 1')
  assert.equal(result.error, null)
  assert.equal(result.snapshots.at(-1)?.variables.value, 3)
})

test('handles empty input and excessive displayed output', () => {
  assert.match(runPythonTrace('  # empty').error ?? '', /Enter a Python snippet/)
  const result = runPythonTrace(`print("${'x'.repeat(1_000)}")\nprint("${'y'.repeat(1_000)}")\nprint("z")`)
  assert.match(result.error ?? '', /output is limited to 2000 characters/)
})
