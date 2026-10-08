import { parse } from "acorn";

// Maps acorn's raw error text to a short concept tag + plain-English label.
// Order matters: more specific patterns should come before generic ones.
const CONCEPT_PATTERNS = [
  { test: /unterminated string/i, tag: "unterminated-string", label: "Unterminated string" },
  { test: /unexpected end of input/i, tag: "unclosed-bracket", label: "Unclosed bracket or brace" },
  { test: /unexpected token '?\}'?/i, tag: "unclosed-bracket", label: "Unclosed bracket or brace" },
  { test: /unexpected token '?\)'?/i, tag: "unclosed-paren", label: "Unclosed parenthesis" },
  { test: /missing \) after argument list/i, tag: "unclosed-paren", label: "Unclosed parenthesis" },
  { test: /unexpected token/i, tag: "unexpected-token", label: "Unexpected character" },
  { test: /unexpected identifier/i, tag: "missing-operator", label: "Missing comma, operator, or semicolon" },
];

function classify(message) {
  const match = CONCEPT_PATTERNS.find((p) => p.test.test(message));
  return match ?? { tag: "other", label: "Syntax error" };
}

export function findSyntaxError(code) {
  try {
    parse(code, { ecmaVersion: "latest", sourceType: "script", locations: true });
    return null;
  } catch (err) {
    if (!err.loc) return null;
    const message = err.message.replace(/\s*\(\d+:\d+\)$/, "");
    const { tag, label } = classify(message);
    return {
      message,
      line: err.loc.line,
      column: err.loc.column + 1,
      concept: tag,
      conceptLabel: label,
    };
  }
}