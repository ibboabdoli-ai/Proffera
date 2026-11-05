import { afterEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement, type ReactElement } from "react";

const fixture = vi.hoisted(() => ({
  field: { current: { value: "no" } as HTMLInputElement | null },
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useRef: () => fixture.field };
});

import { MariaCalendarConfirmButton } from "./maria-calendar-confirm-button";

type ClickHandler = (event: { preventDefault: () => void }) => void;
function renderButton() {
  const fragment = MariaCalendarConfirmButton({
    label: "Save Maria calendar", confirmation: "Are you sure?", kind: "close",
  }) as ReactElement<{ children: unknown }>;
  const children = Children.toArray(fragment.props.children);
  const input = children.find((item) => isValidElement(item) && item.type === "input");
  const button = children.find((item) => isValidElement(item) && item.type === "button");
  expect(input && isValidElement(input) ? input.props : null).toMatchObject({
    type: "hidden", name: "confirmed", defaultValue: "no",
  });
  if (!button || !isValidElement(button)) throw new Error("Submit button not rendered");
  const onClick = (button.props as { onClick?: ClickHandler }).onClick;
  if (!onClick) throw new Error("Confirmation handler missing");
  return onClick;
}

describe("Maria calendar confirmation before submitting a mutation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    fixture.field.current = { value: "no" } as HTMLInputElement;
  });

  it("does not permit a rejected confirmation", () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("window", { confirm });
    const onClick = renderButton();
    const preventDefault = vi.fn();
    onClick({ preventDefault });
    expect(confirm).toHaveBeenCalledExactlyOnceWith("Are you sure?");
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(fixture.field.current?.value).toBe("no");
  });

  it("permits only an explicitly confirmed submission", () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("window", { confirm });
    const onClick = renderButton();
    const preventDefault = vi.fn();
    onClick({ preventDefault });
    expect(confirm).toHaveBeenCalledExactlyOnceWith("Are you sure?");
    expect(preventDefault).not.toHaveBeenCalled();
    expect(fixture.field.current?.value).toBe("yes");
  });

  it("fails closed if the hidden input is unavailable", () => {
    fixture.field.current = null;
    vi.stubGlobal("window", { confirm: vi.fn().mockReturnValue(true) });
    const onClick = renderButton();
    const preventDefault = vi.fn();
    onClick({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
