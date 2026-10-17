import { describe, expect, it } from "vitest";
import { calculateFees } from "../worker/calculation";
import type { ComputeModel } from "../../../shared/type/capability.types";

const model: ComputeModel = { fee_factors: [], fees: [["Fee", "fee", "70.01"]], funds: [["County", "county", "55.0"], ["Rest", "rest", "total_amount"]] };
const amounts = (items: { amount: string }[] | null | undefined) => items?.map(item => item.amount);

describe("Rust calculation parity", () => {
  it.each(["0.01", "0.04", "0.05", "0.06", "0.09", "0.99"])("preserves remaining cents %s", cents => {
    const result = calculateFees({ ...model, fees: [["Base", "base", "70.0"], ["Tax", "tax", cents]] }, []);
    expect(amounts(result.funds)).toEqual(["55.00", "15" + cents.slice(1)]);
  });
  it("rounds before dependent fees and funds and caps remaining allocations", () => {
    const result = calculateFees({ ...model, fees: [["First", "first", "0.014"], ["Second", "second", "first * 2"]], funds: [["Half", "half", "total_amount / 2"], ["Rest", "rest", "99.0"], ["Empty", "empty", "invalid !"]] }, []);
    expect(amounts(result.fees)).toEqual(["0.01", "0.02"]);
    expect(amounts(result.funds)).toEqual(["0.02", "0.01"]);
  });
  it.each([1, 4])("evaluates existing Rhai if/else syntax for %s pages", pages => {
    const result = calculateFees({ ...model, fees: [["Pages", "page_fee", "if total_pages > 2 { (total_pages - 2) * 5.0 } else { 0.0 }"]] }, [{ name: "total_pages", amount: String(pages) }]);
    expect(amounts(result.fees)).toEqual(pages === 1 ? [] : ["10.00"]);
  });
  it("retains fractional precision, normalized names, and existing missing-variable semantics", () => {
    const factors = [{ name: "tax rate", amount: "0.0125" }];
    expect(amounts(calculateFees({ ...model, fees: [["Rate", "rate_fee", "100.0 * tax_rate + missing"]] }, factors).fees)).toEqual(["1.25"]);
    expect(factors).toEqual([{ name: "tax rate", amount: "0.0125" }]);
  });
  it("uses prior fund values and remaining total in order", () => {
    const result = calculateFees({ ...model, fees: [["Fee", "fee", "60.0"]], funds: [["First", "first", "total_amount * 0.25"], ["Second", "second", "first"], ["Rest", "rest", "total_amount"]] }, []);
    expect(amounts(result.funds)).toEqual(["15.00", "15.00", "30.00"]);
  });
  it("skips blank formulas and filters nonpositive outputs as the manager does", () => {
    const result = calculateFees({ ...model, fees: [["Blank", "blank", "  "], ["Negative", "negative", "-1.0"], ["", "hidden", "5.0"]] }, []);
    expect(result.fees).toEqual([]);
  });
  it.each(["1 +", "globalThis.alert(1)", "fetch('url')"])("rejects invalid formulas without executing JavaScript: %s", formula => {
    expect(() => calculateFees({ ...model, fees: [["Invalid", "invalid", formula]] }, [])).toThrow();
  });
  it("keeps row identities during local recalculation so disclosures and focus survive", () => {
    const first = calculateFees(model, []);
    const next = calculateFees({ ...model, fees: [...model.fees, ["Extra", "extra", "2.50"]] }, [], first);
    expect(next.fees?.[0].code).toBe(first.fees?.[0].code);
    expect(next.funds?.map(item => item.code)).toEqual(first.funds?.map(item => item.code));
  });
  it.each([0, 1])("matches the master penalty formula for flag %s", flag => {
    const result = calculateFees({ ...model, fees: [["Penalty", "penalty_fee", "if filing_discrepancies_flag == 1 { 30.0 } else { 0.0 }"]] }, [{ name: "filing_discrepancies_flag", amount: String(flag) }]);
    expect(amounts(result.fees)).toEqual(flag === 1 ? ["30.00"] : []);
  });
});
