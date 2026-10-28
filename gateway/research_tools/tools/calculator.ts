import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const calculatorTool = createTool({
  id: "calculator",
  description:
    "Evaluate a mathematical expression. Supports arithmetic, exponents, parentheses, and common math functions (sqrt, abs, ceil, floor, round, min, max, log, sin, cos, tan, PI, E).",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("A mathematical expression to evaluate, e.g. '(12 * 8) + sqrt(144)'"),
  }),
  outputSchema: z.object({
    expression: z.string(),
    result: z.number(),
  }),
  execute: async ({ expression }) => {
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
  },
});
