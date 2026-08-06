/**
 * The formula AST (plan §3.3).
 *
 * Kept as a plain discriminated union of interfaces rather than classes so an
 * AST is JSON-serialisable — the Setup inspector renders one, and Phase 4 will
 * put parsed formulas in a Zustand store where a class instance would not
 * survive persistence.
 *
 * Grammar implemented by `parser.ts`:
 *
 *     expression  := comparison
 *     comparison  := additive (('=' | '<>' | '<' | '<=' | '>' | '>=') additive)?
 *     additive    := multiplicative (('+' | '-') multiplicative)*
 *     multiplicative := unary (('*' | '/') unary)*
 *     unary       := ('-' | '+') unary | primary
 *     primary     := number | text | ref | call | '(' expression ')'
 *     ref         := VARIABLE_CODE ('[' 'year' ('+' | '-') INT ']')?
 *     call        := FUNCTION '(' expression (',' expression)* ')'
 *
 * Comparison sits above additive rather than being absent because `IF` needs a
 * condition — `IF(GDP > 0, CHE / GDP * 100, 0)` — and UC053's threshold rules
 * will want the same shape.
 */

/** The ten functions of plan §3.3, driven by HLR8 and UC053. */
export const FUNCTION_NAMES = [
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'ABS',
  'IF',
  'PREV',
  'GROWTH',
  'INTERPOLATE',
  'EXTRAPOLATE',
] as const
export type FunctionName = (typeof FUNCTION_NAMES)[number]

const FUNCTION_NAME_SET: ReadonlySet<string> = new Set<string>(FUNCTION_NAMES)

export function isFunctionName(name: string): name is FunctionName {
  return FUNCTION_NAME_SET.has(name.toUpperCase())
}

export type BinaryOp = '+' | '-' | '*' | '/'
export type CompareOp = '=' | '<>' | '<' | '<=' | '>' | '>='

export interface NumberNode {
  kind: 'number'
  value: number
}

/** A quoted literal — only ever a function option, e.g. `EXTRAPOLATE(GDP, 'forward')`. */
export interface TextNode {
  kind: 'text'
  value: string
}

/**
 * A reference to a variable or another formula.
 *
 * `yearOffset` implements the plan's "optional [year±n] offset for growth
 * rules": `HF.1[year-1]` is last year's value of `HF.1`. It is an offset rather
 * than an absolute year so the same parsed formula evaluates at any year.
 */
export interface RefNode {
  kind: 'ref'
  code: string
  yearOffset: number
  /** False when the code matched no known variable or formula at parse time. */
  known: boolean
  /** Character offset of the code in the source, for error reporting. */
  position: number
}

export interface UnaryNode {
  kind: 'unary'
  op: '-' | '+'
  operand: AstNode
}

export interface BinaryNode {
  kind: 'binary'
  op: BinaryOp
  left: AstNode
  right: AstNode
}

export interface CompareNode {
  kind: 'compare'
  op: CompareOp
  left: AstNode
  right: AstNode
}

export interface CallNode {
  kind: 'call'
  name: FunctionName
  args: AstNode[]
  position: number
}

export type AstNode =
  | NumberNode
  | TextNode
  | RefNode
  | UnaryNode
  | BinaryNode
  | CompareNode
  | CallNode

/* --------------------------------------------------------------------------
   Walking
   -------------------------------------------------------------------------- */

/** Every node, parents before children. */
export function walk(node: AstNode, visit: (n: AstNode) => void): void {
  visit(node)
  switch (node.kind) {
    case 'unary':
      walk(node.operand, visit)
      break
    case 'binary':
    case 'compare':
      walk(node.left, visit)
      walk(node.right, visit)
      break
    case 'call':
      for (const a of node.args) walk(a, visit)
      break
    default:
      break
  }
}

/** Every reference in the tree, in source order, duplicates included. */
export function refsOf(node: AstNode): RefNode[] {
  const out: RefNode[] = []
  walk(node, (n) => {
    if (n.kind === 'ref') out.push(n)
  })
  return out
}

/** Distinct referenced codes, in first-appearance order. */
export function referencedCodes(node: AstNode): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of refsOf(node)) {
    if (seen.has(r.code)) continue
    seen.add(r.code)
    out.push(r.code)
  }
  return out
}

/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */

const BINARY_PRECEDENCE: Record<BinaryOp, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

/**
 * Canonical source form of an AST.
 *
 * Round-trips: `parse(format(parse(src)))` is structurally equal to
 * `parse(src)`, which is asserted in the tests. Parentheses are re-inserted
 * only where precedence demands them, so `(FS.1 + FS.3) / CHE * 100` keeps its
 * grouping and `HF.1 + HF.2` does not gain any.
 */
export function formatNode(node: AstNode): string {
  switch (node.kind) {
    case 'number':
      return String(node.value)
    case 'text':
      return `'${node.value}'`
    case 'ref':
      return node.yearOffset === 0
        ? node.code
        : `${node.code}[year${node.yearOffset > 0 ? '+' : '-'}${Math.abs(node.yearOffset)}]`
    case 'unary':
      return `${node.op}${wrap(node.operand, 3)}`
    case 'binary': {
      const p = BINARY_PRECEDENCE[node.op]
      // The right operand of `-` and `/` needs brackets at equal precedence:
      // `a - (b - c)` is not `a - b - c`.
      const rightMin = node.op === '-' || node.op === '/' ? p + 1 : p
      return `${wrap(node.left, p)} ${node.op} ${wrap(node.right, rightMin)}`
    }
    case 'compare':
      return `${wrap(node.left, 1)} ${node.op} ${wrap(node.right, 1)}`
    case 'call':
      return `${node.name}(${node.args.map(formatNode).join(', ')})`
  }
}

function precedenceOf(node: AstNode): number {
  switch (node.kind) {
    case 'compare':
      return 0
    case 'binary':
      return BINARY_PRECEDENCE[node.op]
    case 'unary':
      return 3
    default:
      return 4
  }
}

function wrap(node: AstNode, min: number): string {
  const text = formatNode(node)
  return precedenceOf(node) < min ? `(${text})` : text
}

/* --------------------------------------------------------------------------
   Outline — the tree the Setup inspector renders
   -------------------------------------------------------------------------- */

export interface AstOutlineRow {
  depth: number
  /** Node type as a short label: `+`, `SUM`, `ref`, `number`. */
  label: string
  /** The code, literal or operator this node carries. */
  detail: string
}

/**
 * Flattened, indented view of an AST.
 *
 * The plan calls for showing the parsed tree in the demo — "proof of
 * engineering depth that screenshots cannot fake" — so the rendering shape is
 * part of the domain rather than something a component re-derives.
 */
export function astOutline(node: AstNode, depth = 0, out: AstOutlineRow[] = []): AstOutlineRow[] {
  switch (node.kind) {
    case 'number':
      out.push({ depth, label: 'number', detail: String(node.value) })
      break
    case 'text':
      out.push({ depth, label: 'text', detail: node.value })
      break
    case 'ref':
      out.push({
        depth,
        label: node.known ? 'ref' : 'ref (unknown)',
        detail: formatNode(node),
      })
      break
    case 'unary':
      out.push({ depth, label: 'negate', detail: node.op })
      astOutline(node.operand, depth + 1, out)
      break
    case 'binary':
    case 'compare':
      out.push({ depth, label: node.kind === 'binary' ? 'operator' : 'comparison', detail: node.op })
      astOutline(node.left, depth + 1, out)
      astOutline(node.right, depth + 1, out)
      break
    case 'call':
      out.push({ depth, label: 'function', detail: node.name })
      for (const a of node.args) astOutline(a, depth + 1, out)
      break
  }
  return out
}
