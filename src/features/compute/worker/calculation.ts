import type { MetadataFeeFactor, MetadataFeeItem } from "aurora-core";
import type { ComputeModel, ComputeResult } from "../../../shared/type/capability.types";

type Expression = { kind: "number"; value: number } | { kind: "variable"; name: string }
  | { kind: "unary"; operator: string; value: Expression }
  | { kind: "binary"; operator: string; left: Expression; right: Expression }
  | { kind: "if"; condition: Expression; yes: Expression; no: Expression };

const precedence: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };

function parseFormula(formula: string): Expression {
  const tokens: string[] = [];
  let source = formula.trim();
  while (source) {
    const match = /^(?:\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||[+\-*/%<>(){}!;])/.exec(source);
    if (!match) throw new Error("Invalid fee formula: " + formula);
    tokens.push(match[0]);
    source = source.slice(match[0].length).trimStart();
  }
  let position = 0;
  function take(token: string) {
    if (tokens[position++] !== token) throw new Error("Expected " + token + " in fee formula: " + formula);
  }
  function expression(minimum = 0): Expression {
    const token = tokens[position++];
    let left: Expression;
    if (token === "if") {
      const condition = expression();
      take("{");
      const yes = expression();
      if (tokens[position] === ";") position++;
      take("}");
      take("else");
      let no: Expression;
      if (tokens[position] === "if") no = expression();
      else {
        take("{");
        no = expression();
        if (tokens[position] === ";") position++;
        take("}");
      }
      left = { kind: "if", condition, yes, no };
    } else if (token === "(") {
      left = expression();
      take(")");
    } else if (["+", "-", "!"].includes(token)) {
      left = { kind: "unary", operator: token, value: expression(7) };
    } else if (token && /^\d/.test(token)) left = { kind: "number", value: Number(token) };
    else if (token && /^[A-Za-z_]\w*$/.test(token) && !["else", "while", "for", "let", "fn", "return"].includes(token)) left = { kind: "variable", name: token };
    else throw new Error("Invalid fee formula: " + formula);
    while (position < tokens.length && precedence[tokens[position]] >= minimum) {
      const operator = tokens[position++];
      left = { kind: "binary", operator, left, right: expression(precedence[operator] + 1) };
    }
    return left;
  }
  const result = expression();
  if (tokens[position] === ";") position++;
  if (position !== tokens.length) throw new Error("Invalid fee formula: " + formula);
  return result;
}

function evaluate(expression: Expression, factors: ReadonlyMap<string, number>): number | boolean {
  if (expression.kind === "number") return expression.value;
  if (expression.kind === "variable") {
    if (expression.name === "true" || expression.name === "false") return expression.name === "true";
    // CalculationProcessor binds absent numeric factors to zero.
    return factors.get(expression.name) ?? 0;
  }
  if (expression.kind === "if") {
    const condition = evaluate(expression.condition, factors);
    if (typeof condition !== "boolean") throw new Error("Fee condition must be boolean.");
    return evaluate(condition ? expression.yes : expression.no, factors);
  }
  if (expression.kind === "unary") {
    const value = evaluate(expression.value, factors);
    if (expression.operator === "!" && typeof value === "boolean") return !value;
    if (expression.operator !== "!" && typeof value === "number") return expression.operator === "-" ? -value : value;
    throw new Error("Invalid fee formula operand.");
  }
  const left = evaluate(expression.left, factors);
  if (expression.operator === "&&" && left === false) return false;
  if (expression.operator === "||" && left === true) return true;
  const right = evaluate(expression.right, factors);
  if (expression.operator === "==") return left === right;
  if (expression.operator === "!=") return left !== right;
  if (typeof left === "boolean" && typeof right === "boolean") {
    if (expression.operator === "&&") return left && right;
    if (expression.operator === "||") return left || right;
  }
  if (typeof left !== "number" || typeof right !== "number") throw new Error("Invalid fee formula operands.");
  switch (expression.operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return left / right;
    case "%": return left % right;
    case "<": return left < right;
    case "<=": return left <= right;
    case ">": return left > right;
    case ">=": return left >= right;
    default: throw new Error("Invalid fee formula operator.");
  }
}

export function calculateFees(model: ComputeModel, inputs: readonly MetadataFeeFactor[], previous?: ComputeResult): ComputeResult {
  const factors = new Map<string, number>();
  const fee_factors = inputs.map(factor => ({ ...factor }));
  const codes = new Map<string, string[]>();
  for (const segment of ["fees", "funds", "fee_factors"] as const) {
    for (const item of previous?.[segment] ?? []) {
      if (!item.code) continue;
      const key = JSON.stringify([segment, item.name, "formula" in item ? item.formula : null, item.explanation]);
      codes.set(key, [...(codes.get(key) ?? []), item.code]);
    }
  }
  function itemCode(segment: "fees" | "funds" | "fee_factors", name: string, explanation: string, formula: string | null): string {
    return codes.get(JSON.stringify([segment, name, formula, explanation]))?.shift() ?? crypto.randomUUID();
  }
  for (const factor of inputs) {
    if (factor.amount.trim() && Number.isFinite(Number(factor.amount))) factors.set(factor.name.replaceAll(" ", "_"), Number(factor.amount));
  }
  let remaining = 0;
  const fees: MetadataFeeItem[] = [], funds: MetadataFeeItem[] = [];
  for (const [segment, items] of [["fees", model.fees], ["funds", model.funds]] as const) {
    for (const [explanation, name, formula] of items) {
      if (!formula.trim()) continue;
      let amount = 0;
      if (segment === "fees" || remaining > 0) {
        const value = evaluate(parseFormula(formula), factors);
        if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Fee formula must return a finite number.");
        amount = value > 0 ? Math.round(value * 100) / 100 : 0;
        if (segment === "funds") amount = Math.min(amount, remaining);
      }
      const item = { explanation, name, formula, amount: amount.toFixed(2), code: itemCode(segment, name, explanation, formula) };
      (segment === "fees" ? fees : funds).push(item);
      factors.set(name.replaceAll(" ", "_"), Number(item.amount));
      fee_factors.push({ name, amount: item.amount, explanation: "", ambiguous: "NO", code: itemCode("fee_factors", name, "", null) });
      remaining += segment === "fees" ? amount : -amount;
      if (segment === "funds") {
        factors.set("total_amount", Number(remaining.toFixed(2)));
        fee_factors.find(factor => factor.name === "total_amount")!.amount = remaining.toFixed(2);
      }
    }
    if (segment === "fees") {
      factors.set("total_amount", Number(remaining.toFixed(2)));
      fee_factors.push({ name: "total_amount", amount: remaining.toFixed(2), explanation: "", ambiguous: "NO", code: itemCode("fee_factors", "total_amount", "", null) });
    }
  }
  return {
    fee_factors: fee_factors.filter(factor => Number(factor.amount) > 0),
    fees: fees.filter(item => item.explanation?.trim() && Number(item.amount) > 0),
    funds: funds.filter(item => item.explanation?.trim() && Number(item.amount) > 0),
  };
}
