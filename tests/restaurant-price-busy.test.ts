import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { parseRestaurantPrice } from "@/lib/restaurant-price";

const source = ts.createSourceFile(
  "restaurant-editor.tsx",
  readFileSync("src/app/dashboard/restaurang/restaurant-editor.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const priceInput = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "PriceInput",
);
if (!priceInput) throw new Error("PriceInput definition not found");

// Exercise the real input handlers with one isolated state cell. This is not
// a browser/React-renderer test and does not exercise the persistence backend.
const compiledInput = ts.transpileModule(priceInput.getText(source), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
    jsxFactory: "createElement",
  },
}).outputText;

type InputElement = {
  type: string;
  props: {
    value: string;
    disabled: boolean;
    onChange: (event: { target: { value: string } }) => void;
    onBlur: () => void;
  };
};

function inputHarness(initialValue: number | null = 19500) {
  let raw = initialValue === null ? "" : String(initialValue / 100);
  let canonical = initialValue;
  let writes = 0;
  const render = runInNewContext(`${compiledInput}\nPriceInput;`, {
    input: "price-input",
    parseRestaurantPrice,
    createElement: (type: string, props: InputElement["props"]) => ({ type, props }),
    useState: () => [
      raw,
      (next: string | ((current: string) => string)) => {
        writes += 1;
        raw = typeof next === "function" ? next(raw) : next;
      },
    ],
  }, { timeout: 1000 }) as (props: {
    value: number | null;
    label: string;
    disabled: boolean;
    onChange: (value: number | null) => void;
  }) => InputElement;

  return {
    render: (disabled: boolean) => render({
      value: canonical,
      label: "Pris Test",
      disabled,
      onChange: (value) => { canonical = value; },
    }),
    state: () => ({ raw, canonical, writes }),
  };
}

describe("restaurant price input busy boundary", () => {
  it("binds both detailed and quick-price inputs to the editor busy state", () => {
    const calls: ts.JsxSelfClosingElement[] = [];
    function visit(node: ts.Node): void {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "PriceInput") {
        calls.push(node);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      const disabled = call.attributes.properties.find(
        (prop): prop is ts.JsxAttribute =>
          ts.isJsxAttribute(prop) && prop.name.getText(source) === "disabled",
      );
      expect(disabled?.initializer?.getText(source)).toBe("{busy}");
    }
  });

  it("sets the native disabled attribute and rejects input events while busy", () => {
    const harness = inputHarness();
    const element = harness.render(true);
    expect(element.type).toBe("input");
    expect(element.props.disabled).toBe(true);
    element.props.onChange({ target: { value: "249,50" } });
    expect(harness.state()).toEqual({ raw: "195", canonical: 19500, writes: 0 });
  });

  it("preserves the saved value while busy and accepts edits after unlocking", () => {
    const harness = inputHarness();
    harness.render(false).props.onChange({ target: { value: "199,50" } });
    const saved = harness.state();
    harness.render(true).props.onChange({ target: { value: "299" } });
    expect(harness.state()).toEqual(saved);
    expect(harness.render(false).props.disabled).toBe(false);
    harness.render(false).props.onChange({ target: { value: "210" } });
    expect(harness.state()).toEqual({ raw: "210", canonical: 21000, writes: 2 });
  });

  it("does not mutate local formatting on blur while disabled", () => {
    const harness = inputHarness();
    harness.render(false).props.onChange({ target: { value: "199," } });
    const before = harness.state();
    harness.render(true).props.onBlur();
    expect(harness.state()).toEqual(before);
    harness.render(false).props.onBlur();
    expect(harness.state()).toEqual({ raw: "199", canonical: 19900, writes: 2 });
  });

  it("retains existing decimal, invalid, zero and empty-input behavior", () => {
    const harness = inputHarness();
    harness.render(false).props.onChange({ target: { value: "249.50" } });
    expect(harness.state().canonical).toBe(24950);
    const before = harness.state();
    harness.render(false).props.onChange({ target: { value: "not a price" } });
    expect(harness.state()).toEqual(before);
    harness.render(false).props.onChange({ target: { value: "0" } });
    expect(harness.state().canonical).toBe(0);
    harness.render(false).props.onChange({ target: { value: "" } });
    expect(harness.state().canonical).toBe(null);
  });
});
