/**
 * Safe calculator tool implementation.
 * Does NOT use unrestricted eval().
 * Parses and evaluates mathematical expressions using a recursive descent parser.
 */

export interface CalculatorResult {
  expression: string;
  result: number;
}

export function evaluateExpression(expression: string): CalculatorResult {
  const sanitized = expression.trim();
  if (!sanitized) {
    throw new Error('Empty expression provided');
  }

  // Tokenize safely: numbers, operators, parens
  const tokens: string[] = [];
  let i = 0;

  while (i < sanitized.length) {
    const char = sanitized[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/\d/.test(char) || char === '.') {
      let numStr = '';
      while (i < sanitized.length && (/[\d.]/.test(sanitized[i]))) {
        numStr += sanitized[i];
        i++;
      }
      tokens.push(numStr);
      continue;
    }

    // Two-character operators like **
    if (char === '*' && sanitized[i + 1] === '*') {
      tokens.push('^');
      i += 2;
      continue;
    }

    if (['+', '-', '*', '/', '^', '%', '(', ')'].includes(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    throw new Error(`Unsupported character in expression: '${char}'`);
  }

  // Parser: Grammar
  // Expression -> Term ((+ | -) Term)*
  // Term       -> Factor ((* | / | %) Factor)*
  // Factor     -> Power (^ Power)*
  // Power      -> Primary
  // Primary    -> Number | '(' Expression ')' | - Primary | + Primary

  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(expected?: string): string {
    const current = tokens[pos];
    if (expected && current !== expected) {
      throw new Error(`Expected '${expected}' but found '${current}'`);
    }
    pos++;
    return current;
  }

  function parseExpression(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (op === '+') result += right;
      else result -= right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = consume();
      const right = parseFactor();
      if (op === '*') {
        result *= right;
      } else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      } else if (op === '%') {
        if (right === 0) throw new Error('Modulo by zero');
        result %= right;
      }
    }
    return result;
  }

  function parseFactor(): number {
    let base = parsePrimary();
    if (peek() === '^') {
      consume('^');
      const exp = parseFactor(); // Right-associative exponent
      base = Math.pow(base, exp);
    }
    return base;
  }

  function parsePrimary(): number {
    const token = peek();
    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    // Unary minus or plus
    if (token === '-') {
      consume('-');
      return -parsePrimary();
    }
    if (token === '+') {
      consume('+');
      return parsePrimary();
    }

    if (token === '(') {
      consume('(');
      const val = parseExpression();
      consume(')');
      return val;
    }

    // Number
    const num = Number(token);
    if (isNaN(num)) {
      throw new Error(`Invalid numeric token: '${token}'`);
    }
    consume();
    return num;
  }

  const result = parseExpression();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token at position ${pos}: '${tokens[pos]}'`);
  }

  // Round floating point issues nicely, e.g. 0.1 + 0.2
  const cleanResult = Math.abs(result) < 1e-12 ? 0 : Math.round(result * 1e8) / 1e8;

  return {
    expression: sanitized,
    result: cleanResult,
  };
}
