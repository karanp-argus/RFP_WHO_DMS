/**
 * Recursive-descent parser for the plan §3.3 grammar.
 *
 * Hand-written rather than generated: the grammar is eight productions, the
 * error messages need to name the offending code (not "expected token 14"), and
 * a parser generator would be a build-step dependency for ~120 lines.
 *
 * Precedence climbs downward through the functions — `parseComparison` calls
 * `parseAdditive` calls `parseMultiplicative` calls `parseUnary` calls
 * `parsePrimary` — which is the grammar read top to bottom.
 */

import {
  isFunctionName,
  type AstNode,
  type BinaryOp,
  type CompareOp,
  type FunctionName,
} from './ast'
import { FormulaError } from './errors'
import { FUNCTION_ARITY } from './functions'
import { tokenize, type Token, type TokenizeOptions } from './tokenizer'

class Parser {
  private readonly tokens: readonly Token[]
  private pos = 0

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++]
  }

  /** Offset just past the last consumed token — where an error is reported. */
  private here(): number {
    const t = this.peek()
    if (t) return t.start
    const last = this.tokens[this.tokens.length - 1]
    return last ? last.end : 0
  }

  parse(): AstNode {
    if (this.tokens.length === 0) {
      throw new FormulaError('syntax', 'The expression is empty.', { position: 0 })
    }
    const node = this.parseComparison()
    const leftover = this.peek()
    if (leftover) {
      throw new FormulaError(
        'syntax',
        `Unexpected "${leftover.text}" at position ${leftover.start}.`,
        { position: leftover.start },
      )
    }
    return node
  }

  private parseComparison(): AstNode {
    const left = this.parseAdditive()
    const t = this.peek()
    if (t?.type === 'compare') {
      this.next()
      const right = this.parseAdditive()
      return { kind: 'compare', op: t.text as CompareOp, left, right }
    }
    return left
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative()
    for (;;) {
      const t = this.peek()
      if (t?.type !== 'op' || (t.text !== '+' && t.text !== '-')) return left
      this.next()
      const right = this.parseMultiplicative()
      left = { kind: 'binary', op: t.text as BinaryOp, left, right }
    }
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary()
    for (;;) {
      const t = this.peek()
      if (t?.type !== 'op' || (t.text !== '*' && t.text !== '/')) return left
      this.next()
      const right = this.parseUnary()
      left = { kind: 'binary', op: t.text as BinaryOp, left, right }
    }
  }

  private parseUnary(): AstNode {
    const t = this.peek()
    if (t?.type === 'op' && (t.text === '-' || t.text === '+')) {
      this.next()
      return { kind: 'unary', op: t.text, operand: this.parseUnary() }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): AstNode {
    const t = this.next()
    if (!t) {
      throw new FormulaError('syntax', 'The expression ends unexpectedly.', {
        position: this.here(),
      })
    }

    switch (t.type) {
      case 'number':
        return { kind: 'number', value: typeof t.value === 'number' ? t.value : Number(t.text) }

      case 'text':
        return { kind: 'text', value: typeof t.value === 'string' ? t.value : t.text }

      case 'ref':
        // `FOO(1)` tokenises as a reference followed by `(`, because FOO is not
        // one of the ten function names. Saying so beats "unexpected (".
        if (this.peek()?.type === 'lparen') {
          throw new FormulaError(
            'unknown-function',
            `Unknown function "${t.text}". Available: ${Object.keys(FUNCTION_ARITY).join(', ')}.`,
            { position: t.start },
          )
        }
        return {
          kind: 'ref',
          code: t.text,
          yearOffset: t.yearOffset ?? 0,
          known: t.known ?? false,
          position: t.start,
        }

      case 'lparen': {
        const inner = this.parseComparison()
        const close = this.next()
        if (close?.type !== 'rparen') {
          throw new FormulaError('syntax', `Missing ")" — opened at position ${t.start}.`, {
            position: close?.start ?? this.here(),
          })
        }
        return inner
      }

      case 'func':
        return this.parseCall(t)

      default:
        throw new FormulaError(
          'syntax',
          `Unexpected "${t.text}" at position ${t.start} — a value was expected here.`,
          { position: t.start },
        )
    }
  }

  private parseCall(nameToken: Token): AstNode {
    if (!isFunctionName(nameToken.text)) {
      throw new FormulaError('unknown-function', `Unknown function "${nameToken.text}".`, {
        position: nameToken.start,
      })
    }
    const name = nameToken.text.toUpperCase() as FunctionName

    const open = this.next()
    if (open?.type !== 'lparen') {
      throw new FormulaError('syntax', `Expected "(" after ${name}.`, {
        position: open?.start ?? this.here(),
      })
    }

    const args: AstNode[] = []
    if (this.peek()?.type === 'rparen') {
      this.next()
    } else {
      for (;;) {
        args.push(this.parseComparison())
        const sep = this.next()
        if (sep?.type === 'rparen') break
        if (sep?.type !== 'comma') {
          throw new FormulaError(
            'syntax',
            `Expected "," or ")" in ${name}(…) at position ${sep?.start ?? this.here()}.`,
            { position: sep?.start ?? this.here() },
          )
        }
      }
    }

    const arity = FUNCTION_ARITY[name]
    if (args.length < arity.min || args.length > arity.max) {
      throw new FormulaError(
        'arity',
        arity.min === arity.max
          ? `${name} takes ${arity.min} argument${arity.min === 1 ? '' : 's'}, got ${args.length}.`
          : `${name} takes ${arity.min}–${arity.max === Infinity ? 'many' : arity.max} arguments, got ${args.length}.`,
        { position: nameToken.start },
      )
    }

    // PREV/GROWTH/INTERPOLATE/EXTRAPOLATE read a whole series, so their first
    // argument has to be a reference the evaluator can shift the year on — an
    // arbitrary sub-expression has no series behind it.
    if (arity.firstArgIsRef) {
      const first = args[0]
      if (first?.kind !== 'ref') {
        throw new FormulaError(
          'reference-required',
          `${name} needs a variable reference as its first argument, e.g. ${name}(HF.1).`,
          { position: nameToken.start },
        )
      }
    }

    return { kind: 'call', name, args, position: nameToken.start }
  }
}

export type ParseOptions = TokenizeOptions

/** Parse an expression against a known-code set. Throws `FormulaError`. */
export function parseExpression(source: string, options: ParseOptions): AstNode {
  return new Parser(tokenize(source, options)).parse()
}

/** Non-throwing form, for live validation in the formula editor. */
export function tryParseExpression(
  source: string,
  options: ParseOptions,
): { ast: AstNode; error: null } | { ast: null; error: FormulaError } {
  try {
    return { ast: parseExpression(source, options), error: null }
  } catch (e) {
    if (e instanceof FormulaError) return { ast: null, error: e }
    throw e
  }
}
