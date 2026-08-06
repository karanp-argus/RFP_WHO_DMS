/**
 * Tokeniser.
 *
 * **The one thing that makes this different from a calculator tokeniser:**
 * variable codes contain characters that are otherwise operators or separators.
 * The real seeded set includes `CHE%GDP_SHA2011`, `GGHE-D_pc_US$_SHA2011`,
 * `HF.nec`, `FS.RI.1.1` and `HF TOT` — a code with a **space in it**. There is
 * no character-level rule that separates `GGHE-D` from `GGHE - D`, or `HF TOT`
 * from two adjacent tokens.
 *
 * So references are matched **greedily against the known-code set**, longest
 * first, exactly as CLAUDE.md requires. `CHE / GDP` matches `CHE` because
 * `CHE / GDP` and `CHE ` are not codes; `GGHE-D / CHE` matches `GGHE-D` because
 * it is one. Nothing is inferred from the characters themselves.
 *
 * An identifier that matches no known code still tokenises — as an unknown
 * reference — so the editor can report *which* code is unrecognised rather than
 * failing with a syntax error at a character offset.
 */

import { isFunctionName } from './ast'
import { FormulaError } from './errors'

export type TokenType =
  | 'number'
  | 'text'
  | 'ref'
  | 'func'
  | 'op'
  | 'compare'
  | 'lparen'
  | 'rparen'
  | 'comma'

export interface Token {
  type: TokenType
  /** Source text of the token — the code for a ref, the name for a func. */
  text: string
  start: number
  end: number
  /** Numeric value for `number`, string body for `text`. */
  value?: number | string
  /** `[year-1]` offset on a ref; 0 when absent. */
  yearOffset?: number
  /** False on a ref whose code is in neither the variable nor the formula set. */
  known?: boolean
}

/** Characters that may appear inside a variable code, beyond letters/digits. */
const CODE_EXTRA = new Set(['.', '_', '%', '$', '-', ' '])

function isAlpha(ch: string): boolean {
  return /[A-Za-z]/.test(ch)
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isCodeChar(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch) || CODE_EXTRA.has(ch)
}

/**
 * Longest known code starting at `i`, or null.
 *
 * Tries every length from the longest known code downwards. With ~200 codes and
 * a longest of ~22 characters that is at most 22 set lookups per token — cheaper
 * than building a trie and considerably easier to read.
 */
function matchKnownCode(src: string, i: number, known: ReadonlySet<string>, maxLen: number): string | null {
  const limit = Math.min(maxLen, src.length - i)
  for (let len = limit; len > 0; len--) {
    const candidate = src.slice(i, i + len)
    if (known.has(candidate)) return candidate
  }
  return null
}

/**
 * Fallback read for an identifier that matched no known code.
 *
 * Deliberately greedy over code characters *except* a trailing space run — an
 * unknown `FOO` in `FOO + 1` must not swallow the space and the operator. A
 * space is only ever consumed when the known-code path matched it (`HF TOT`).
 */
function readUnknownCode(src: string, i: number): string {
  let j = i
  while (j < src.length) {
    const ch = src[j]
    if (ch == null || !isCodeChar(ch) || ch === ' ') break
    j++
  }
  return src.slice(i, j)
}

/**
 * `[year]`, `[year-1]`, `[year+2]` immediately after a reference.
 * Returns the offset and the index just past the closing bracket, or null when
 * the next non-space character is not `[`.
 */
function readYearOffset(src: string, i: number): { offset: number; next: number } | null {
  let j = i
  while (j < src.length && src[j] === ' ') j++
  if (src[j] !== '[') return null

  const m = /^\[\s*year\s*(?:([+-])\s*(\d+)\s*)?\]/i.exec(src.slice(j))
  if (!m) {
    throw new FormulaError('syntax', `Expected [year], [year-1] or [year+1] at position ${j}.`, {
      position: j,
    })
  }
  const sign = m[1] === '-' ? -1 : 1
  const magnitude = m[2] ? Number(m[2]) : 0
  return { offset: sign * magnitude, next: j + m[0].length }
}

export interface TokenizeOptions {
  /** Every variable and formula code the engine knows about. */
  knownCodes: ReadonlySet<string>
}

export function tokenize(src: string, options: TokenizeOptions): Token[] {
  const known = options.knownCodes
  let maxCodeLen = 1
  for (const c of known) if (c.length > maxCodeLen) maxCodeLen = c.length

  const tokens: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]
    if (ch == null) break

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    // --- numbers -----------------------------------------------------------
    // Checked before codes: no seeded code starts with a digit, and `100` in
    // `CHE / GDP * 100` must never be read as an identifier.
    if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1] ?? ''))) {
      const m = /^\d*(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i))
      const text = m?.[0] ?? ''
      if (text === '') {
        throw new FormulaError('syntax', `Unreadable number at position ${i}.`, { position: i })
      }
      tokens.push({ type: 'number', text, start: i, end: i + text.length, value: Number(text) })
      i += text.length
      continue
    }

    // --- quoted literals ---------------------------------------------------
    if (ch === "'" || ch === '"') {
      const close = src.indexOf(ch, i + 1)
      if (close < 0) {
        throw new FormulaError('syntax', `Unterminated text literal at position ${i}.`, {
          position: i,
        })
      }
      const body = src.slice(i + 1, close)
      tokens.push({ type: 'text', text: src.slice(i, close + 1), start: i, end: close + 1, value: body })
      i = close + 1
      continue
    }

    // --- functions ---------------------------------------------------------
    // A bare word followed by `(` is a call. Checked before the code match so a
    // hypothetical variable named `MIN` could not shadow the function — and
    // after numbers so nothing here can start with a digit.
    if (isAlpha(ch)) {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))?.[0] ?? ''
      if (word !== '' && isFunctionName(word)) {
        let k = i + word.length
        while (k < src.length && src[k] === ' ') k++
        if (src[k] === '(') {
          tokens.push({
            type: 'func',
            text: word.toUpperCase(),
            start: i,
            end: i + word.length,
          })
          i = k
          continue
        }
      }
    }

    // --- references --------------------------------------------------------
    if (isCodeChar(ch) && ch !== '-' && ch !== '.' && ch !== ' ') {
      const matched = matchKnownCode(src, i, known, maxCodeLen)
      const code = matched ?? readUnknownCode(src, i)
      if (code !== '') {
        const afterCode = i + code.length
        const yearPart = readYearOffset(src, afterCode)
        tokens.push({
          type: 'ref',
          text: code,
          start: i,
          end: afterCode,
          yearOffset: yearPart?.offset ?? 0,
          known: matched != null,
        })
        i = yearPart ? yearPart.next : afterCode
        continue
      }
    }

    // --- comparisons (before single-char operators: `<=` beats `<`) --------
    const two = src.slice(i, i + 2)
    if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
      tokens.push({ type: 'compare', text: two === '!=' ? '<>' : two, start: i, end: i + 2 })
      i += 2
      continue
    }
    if (ch === '<' || ch === '>' || ch === '=') {
      tokens.push({ type: 'compare', text: ch, start: i, end: i + 1 })
      i++
      continue
    }

    // --- operators and punctuation ----------------------------------------
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', text: ch, start: i, end: i + 1 })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', text: ch, start: i, end: i + 1 })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', text: ch, start: i, end: i + 1 })
      i++
      continue
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'comma', text: ',', start: i, end: i + 1 })
      i++
      continue
    }

    throw new FormulaError('syntax', `Unexpected character "${ch}" at position ${i}.`, {
      position: i,
    })
  }

  return tokens
}
