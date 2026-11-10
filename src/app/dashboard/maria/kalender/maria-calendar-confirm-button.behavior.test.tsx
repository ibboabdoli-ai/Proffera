import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRef = vi.hoisted(() => ({
  input: { current: { value: "no" } },
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: () => mockRef.input,
}));

import { MariaCalendarConfirmButton } from "./maria-calendar-confirm-button";

type ButtonProps = {
  onClick: (event: { preventDefault: () => void }) => void;
  className: string;
  disabled?: boolean;
};
function getButton(kind: "open" | "close" = "close") {
  const element = MariaCalendarConfirmButton({
    label: "Confirm", confirmation: "Are you sure?", kind,
  }) as unknown as {
    props: { children: Array<{ props: Record<string, unknown> }> };
  };
  const [hidden, button] = element.props.children;
  expect(hidden.props.name).toBe("confirmed");
  expect(hidden.props.defaultValue).toBe("no");
  return button.props as unknown as ButtonProps;
}

beforeEach(() => {
  mockRef.input.current.value = "no";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Maria calendar confirmation button behavior", () => {
  it("blocks the submit when the manager cancels the browser confirmation", () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const preventDefault = vi.fn();
    getButton().onClick({ preventDefault });
    expect(confirm).toHaveBeenCalledWith("Are you sure?");
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mockRef.input.current.value).toBe("no");
  });

  it("marks the hidden server gate yes only after confirmed consent", () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const preventDefault = vi.fn();
    getButton("open").onClick({ preventDefault });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockRef.input.current.value).toBe("yes");
  });

  it("renders the open control with a white surface and readable mauve foreground", () => {
    const button = getButton("open");
    expect(button.className).toContain("bg-white");
    expect(button.className).toContain("text-[#754b5a]");
    expect(button.className).not.toContain("text-white");
  });
});
