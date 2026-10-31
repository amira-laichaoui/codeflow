export type PythonValue = number | string | number[]

export interface Snapshot {
  step: number
  currentLine: number | null
  variables: Record<string, PythonValue>
  lists: Record<string, number[]>
  output: string
  error?: string
}

export interface TraceResult {
  snapshots: Snapshot[]
  error: string | null
}

const MAX_SOURCE_LENGTH = 4_000
const MAX_TRACE_SNAPSHOTS = 500
const MAX_RANGE_ITERATIONS = 100
const MAX_OUTPUT_LENGTH = 2_000
const MAX_EXPRESSION_TOKENS = 1_000
const MAX_EXPRESSION_DEPTH = 64

type Expression =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'variable'; name: string }
  | { kind: 'list'; values: Expression[] }
  | { kind: 'unary'; operator: '+' | '-'; operand: Expression }
  | {
      kind: 'binary'
      operator: '+' | '-' | '*' | '//' | '%'
      left: Expression
      right: Expression
    }
  | { kind: 'index'; list: Expression; index: Expression }
  | { kind: 'length'; value: Expression }

type SimpleStatement =
  | { kind: 'assign'; name: string; value: Expression; line: number }
  | { kind: 'append'; name: string; value: Expression; line: number }
  | { kind: 'print'; value: Expression; line: number }

interface ForStatement {
  kind: 'for'
  name: string
  range: Expression[]
  body: SimpleStatement[]
  line: number
}

type Statement = SimpleStatement | ForStatement

interface Token {
  type: 'number' | 'string' | 'identifier' | 'operator' | 'eof'
  value: string
}

class TraceError extends Error {
  readonly line: number

  constructor(
    message: string,
    line: number,
  ) {
    super(message)
    this.line = line
  }
}

function fail(message: string, line: number): never {
  throw new TraceError(message, line)
}

function tokenize(source: string, line: number): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      index += 1
      continue
    }

    if (/[0-9]/.test(character)) {
      const start = index
      while (index < source.length && /[0-9]/.test(source[index])) index += 1
      tokens.push({ type: 'number', value: source.slice(start, index) })
    } else if (/[A-Za-z_]/.test(character)) {
      const start = index
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1
      tokens.push({ type: 'identifier', value: source.slice(start, index) })
    } else if (character === '"' || character === "'") {
      const quote = character
      index += 1
      let value = ''
      let closed = false
      while (index < source.length) {
        const next = source[index]
        index += 1
        if (next === quote) {
          closed = true
          break
        }
        if (next === '\\') {
          if (index >= source.length) break
          const escaped = source[index]
          index += 1
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped
        } else {
          value += next
        }
      }
      if (!closed) fail('Unclosed string literal.', line)
      tokens.push({ type: 'string', value })
    } else {
      const pair = source.slice(index, index + 2)
      if (pair === '//') {
        tokens.push({ type: 'operator', value: pair })
        index += 2
      } else if ('+-*%()[],'.includes(character)) {
        tokens.push({ type: 'operator', value: character })
        index += 1
      } else {
        fail(`Unsupported character "${character}" in expression.`, line)
      }
    }

    if (tokens.length > MAX_EXPRESSION_TOKENS) {
      fail('This expression is too complex to trace.', line)
    }
  }

  tokens.push({ type: 'eof', value: '' })
  return tokens
}

class ExpressionParser {
  private position = 0
  private depth = 0
  private readonly tokens: Token[]
  private readonly line: number

  constructor(
    source: string,
    line: number,
  ) {
    this.line = line
    this.tokens = tokenize(source, line)
  }

  parse(): Expression {
    const expression = this.parseAddition()
    if (this.peek().type !== 'eof') {
      fail(`Unexpected "${this.peek().value}" in expression.`, this.line)
    }
    return expression
  }

  private peek(): Token {
    return this.tokens[this.position]
  }

  private take(value: string): boolean {
    if (this.peek().value !== value) return false
    this.position += 1
    return true
  }

  private require(value: string): void {
    if (!this.take(value)) fail(`Expected "${value}" in expression.`, this.line)
  }

  private nested<T>(parse: () => T): T {
    this.depth += 1
    if (this.depth > MAX_EXPRESSION_DEPTH) {
      fail('Expression nesting is limited to 64 levels.', this.line)
    }
    try {
      return parse()
    } finally {
      this.depth -= 1
    }
  }

  private parseAddition(): Expression {
    let left = this.parseMultiplication()
    while (this.peek().value === '+' || this.peek().value === '-') {
      const operator = this.peek().value as '+' | '-'
      this.position += 1
      left = { kind: 'binary', operator, left, right: this.parseMultiplication() }
    }
    return left
  }

  private parseMultiplication(): Expression {
    let left = this.parseUnary()
    while (['*', '//', '%'].includes(this.peek().value)) {
      const operator = this.peek().value as '*' | '//' | '%'
      this.position += 1
      left = { kind: 'binary', operator, left, right: this.parseUnary() }
    }
    return left
  }

  private parseUnary(): Expression {
    if (this.take('+')) {
      return this.nested(() => ({ kind: 'unary', operator: '+', operand: this.parseUnary() }))
    }
    if (this.take('-')) {
      return this.nested(() => ({ kind: 'unary', operator: '-', operand: this.parseUnary() }))
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    const token = this.peek()
    if (token.type === 'number') {
      this.position += 1
      const value = Number(token.value)
      if (!Number.isSafeInteger(value)) fail('Only safe whole numbers are supported.', this.line)
      return { kind: 'number', value }
    }
    if (token.type === 'string') {
      this.position += 1
      return { kind: 'string', value: token.value }
    }
    if (token.type === 'identifier') {
      this.position += 1
      if (token.value === 'len' && this.take('(')) {
        return this.nested(() => {
          const value = this.parseAddition()
          this.require(')')
          return { kind: 'length', value }
        })
      }
      let expression: Expression = { kind: 'variable', name: token.value }
      while (this.take('[')) {
        expression = this.nested(() => {
          const index = this.parseAddition()
          this.require(']')
          return { kind: 'index', list: expression, index }
        })
      }
      return expression
    }
    if (this.take('(')) {
      return this.nested(() => {
        const expression = this.parseAddition()
        this.require(')')
        return expression
      })
    }
    if (this.take('[')) {
      return this.nested(() => {
        const values: Expression[] = []
        if (!this.take(']')) {
          do {
            values.push(this.parseAddition())
          } while (this.take(',') && this.peek().value !== ']')
          this.require(']')
        }
        return { kind: 'list', values }
      })
    }
    fail('Expected a number, variable, string, or list expression.', this.line)
  }
}

function parseExpression(source: string, line: number): Expression {
  if (!source.trim()) fail('Expected an expression.', line)
  return new ExpressionParser(source, line).parse()
}

function splitArguments(source: string, line: number): string[] {
  const parts: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") quote = character
    else if ('(['.includes(character)) depth += 1
    else if (')]'.includes(character)) depth -= 1
    else if (character === ',' && depth === 0) {
      parts.push(source.slice(start, index).trim())
      start = index + 1
    }
    if (depth < 0) fail('Unbalanced parentheses in range.', line)
  }

  if (quote || depth !== 0) fail('Unbalanced expression in range.', line)
  parts.push(source.slice(start).trim())
  return parts
}

function stripComment(source: string): string {
  let quote = ''
  let escaped = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === '#') {
      return source.slice(0, index)
    }
  }
  return source
}

function parseSimpleStatement(source: string, line: number): SimpleStatement {
  const assignment = source.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/)
  if (assignment) {
    return {
      kind: 'assign',
      name: assignment[1],
      value: parseExpression(assignment[2], line),
      line,
    }
  }

  const append = source.match(/^([A-Za-z_]\w*)\.append\((.*)\)$/)
  if (append) {
    return {
      kind: 'append',
      name: append[1],
      value: parseExpression(append[2], line),
      line,
    }
  }

  const print = source.match(/^print\((.*)\)$/)
  if (print) {
    return {
      kind: 'print',
      value: parseExpression(print[1], line),
      line,
    }
  }

  fail(
    'Unsupported statement. Use assignment, print(value), list.append(value), or a for-range loop.',
    line,
  )
}

function parseSource(source: string): Statement[] {
  const lines = source.split(/\r?\n/)
  const statements: Statement[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    if (lines[index].includes('\t')) fail('Use spaces for indentation; tabs are not supported.', lineNumber)
    const withoutComment = stripComment(lines[index])
    if (!withoutComment.trim()) continue
    if (/^\s/.test(withoutComment)) {
      fail('Unexpected indentation. Loop bodies must use exactly four spaces.', lineNumber)
    }

    const loop = withoutComment.match(/^for\s+([A-Za-z_]\w*)\s+in\s+range\((.*)\):\s*$/)
    if (!loop) {
      if (/^for\b/.test(withoutComment)) {
        fail('Only for-loops over range(start, stop[, step]) are supported.', lineNumber)
      }
      statements.push(parseSimpleStatement(withoutComment.trim(), lineNumber))
      continue
    }

    const rawArguments = splitArguments(loop[2], lineNumber)
    if (rawArguments.length < 1 || rawArguments.length > 3 || rawArguments.some((part) => !part)) {
      fail('range() accepts one, two, or three whole-number arguments.', lineNumber)
    }
    const range = rawArguments.map((part) => parseExpression(part, lineNumber))
    const body: SimpleStatement[] = []

    while (index + 1 < lines.length) {
      const bodyLine = lines[index + 1]
      if (bodyLine.includes('\t')) fail('Use spaces for indentation; tabs are not supported.', index + 2)
      const bodyContent = stripComment(bodyLine)
      if (!bodyContent.trim()) {
        index += 1
        continue
      }
      const indentation = bodyContent.match(/^ */)?.[0].length ?? 0
      if (indentation === 0) break
      if (indentation !== 4) {
        fail('Loop bodies must use exactly four spaces; nested blocks are not supported.', index + 2)
      }
      const statement = bodyContent.slice(4).trim()
      if (/^for\b/.test(statement)) {
        fail('Nested loops are not supported.', index + 2)
      }
      body.push(parseSimpleStatement(statement, index + 2))
      index += 1
    }

    if (body.length === 0) fail('A for-loop must have at least one body statement.', lineNumber)
    statements.push({ kind: 'for', name: loop[1], range, body, line: lineNumber })
  }

  if (statements.length === 0) fail('Enter a Python snippet to trace.', 1)
  return statements
}

function requireNumber(value: PythonValue, line: number): number {
  if (typeof value !== 'number') fail('This operation requires a whole number.', line)
  return value
}

function evaluate(
  expression: Expression,
  variables: Record<string, PythonValue>,
  line: number,
): PythonValue {
  switch (expression.kind) {
    case 'number':
    case 'string':
      return expression.value
    case 'variable': {
      if (!(expression.name in variables)) fail(`Name "${expression.name}" is not defined.`, line)
      return variables[expression.name]
    }
    case 'list':
      return expression.values.map((value) => requireNumber(evaluate(value, variables, line), line))
    case 'unary': {
      const value = requireNumber(evaluate(expression.operand, variables, line), line)
      return expression.operator === '-' ? -value : value
    }
    case 'binary': {
      const left = requireNumber(evaluate(expression.left, variables, line), line)
      const right = requireNumber(evaluate(expression.right, variables, line), line)
      if ((expression.operator === '//' || expression.operator === '%') && right === 0) {
        fail('Division by zero.', line)
      }
      const result =
        expression.operator === '+'
          ? left + right
          : expression.operator === '-'
            ? left - right
            : expression.operator === '*'
              ? left * right
              : expression.operator === '//'
                ? Math.floor(left / right)
                : left % right
      if (!Number.isSafeInteger(result)) fail('The result is outside the safe whole-number range.', line)
      return result
    }
    case 'index': {
      const list = evaluate(expression.list, variables, line)
      const index = requireNumber(evaluate(expression.index, variables, line), line)
      if (!Array.isArray(list)) fail('Indexing is only supported for lists.', line)
      if (index < 0 || index >= list.length) fail('List index is out of range.', line)
      return list[index]
    }
    case 'length': {
      const value = evaluate(expression.value, variables, line)
      if (!Array.isArray(value) && typeof value !== 'string') {
        fail('len() supports lists and strings.', line)
      }
      return value.length
    }
  }
}

function formatValue(value: PythonValue): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`
  return String(value)
}

function createSnapshot(
  snapshots: Snapshot[],
  currentLine: number | null,
  variables: Record<string, PythonValue>,
  output: string,
  error?: string,
): Snapshot {
  const copiedVariables = Object.create(null) as Record<string, PythonValue>
  const lists = Object.create(null) as Record<string, number[]>
  for (const [name, value] of Object.entries(variables)) {
    copiedVariables[name] = Array.isArray(value) ? [...value] : value
    if (Array.isArray(value)) lists[name] = [...value]
  }
  const snapshot: Snapshot = {
    step: snapshots.length,
    currentLine,
    variables: copiedVariables,
    lists,
    output,
    ...(error ? { error } : {}),
  }
  snapshots.push(snapshot)
  return snapshot
}

export function runPythonTrace(source: string): TraceResult {
  const snapshots: Snapshot[] = []
  const variables = Object.create(null) as Record<string, PythonValue>
  let output = ''
  createSnapshot(snapshots, null, variables, output)

  try {
    if (source.length > MAX_SOURCE_LENGTH) {
      fail(`Input is limited to ${MAX_SOURCE_LENGTH} characters.`, 1)
    }
    const statements = parseSource(source)

    const record = (line: number): void => {
      if (snapshots.length >= MAX_TRACE_SNAPSHOTS - 1) {
        fail(`Execution stopped at the ${MAX_TRACE_SNAPSHOTS}-snapshot limit.`, line)
      }
      createSnapshot(snapshots, line, variables, output)
    }

    const execute = (statement: SimpleStatement): void => {
      if (statement.kind === 'assign') {
        variables[statement.name] = evaluate(statement.value, variables, statement.line)
      } else if (statement.kind === 'append') {
        const list = variables[statement.name]
        if (!Array.isArray(list)) {
          fail(`"${statement.name}" is not a list.`, statement.line)
        }
        list.push(requireNumber(evaluate(statement.value, variables, statement.line), statement.line))
      } else {
        const nextOutput = `${output}${formatValue(evaluate(statement.value, variables, statement.line))}\n`
        if (nextOutput.length > MAX_OUTPUT_LENGTH) {
          fail(`Displayed output is limited to ${MAX_OUTPUT_LENGTH} characters.`, statement.line)
        }
        output = nextOutput
      }
      record(statement.line)
    }

    for (const statement of statements) {
      if (statement.kind !== 'for') {
        execute(statement)
        continue
      }

      const args = statement.range.map((value) =>
        requireNumber(evaluate(value, variables, statement.line), statement.line),
      )
      const start = args.length === 1 ? 0 : args[0]
      const stop = args.length === 1 ? args[0] : args[1]
      const stride = args.length === 3 ? args[2] : 1
      if (stride === 0) fail('range() step cannot be zero.', statement.line)
      const count = Math.max(0, Math.ceil((stop - start) / stride))
      if (count > MAX_RANGE_ITERATIONS) {
        fail(`range() is limited to ${MAX_RANGE_ITERATIONS} iterations.`, statement.line)
      }

      for (let iteration = 0, value = start; iteration < count; iteration += 1, value += stride) {
        variables[statement.name] = value
        record(statement.line)
        for (const bodyStatement of statement.body) execute(bodyStatement)
      }
    }

    createSnapshot(snapshots, null, variables, output)
    return { snapshots, error: null }
  } catch (error) {
    if (!(error instanceof TraceError)) throw error
    const traceError = error
    createSnapshot(snapshots, traceError.line, variables, output, traceError.message)
    return { snapshots, error: `Line ${traceError.line}: ${traceError.message}` }
  }
}

export function displayValue(value: PythonValue): string {
  return formatValue(value)
}
