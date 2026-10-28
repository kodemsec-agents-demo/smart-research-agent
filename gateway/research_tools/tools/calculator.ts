// Evaluates a mathematical expression with the common Math functions
export async function calculator({ expression }: { expression: string }) {
  const sanitized = expression.replace(/[^0-9+\-*/().,%^ a-zA-Z_]/g, "");

  const mathContext = {
    sqrt: Math.sqrt,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    log: Math.log,
    log10: Math.log10,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    PI: Math.PI,
    E: Math.E,
    pow: Math.pow,
  };

  const fn = new Function(
    ...Object.keys(mathContext),
    `"use strict"; return (${sanitized});`
  );
  const result = fn(...Object.values(mathContext)) as number;

  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error(`Expression did not evaluate to a finite number: ${expression}`);
  }

  return { expression, result };
}
