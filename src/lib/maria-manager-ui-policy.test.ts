import { describe, expect, it } from "vitest";
import {
  isMariaBookingDetailReadOnly,
  isMariaGenericBookingHoursReadOnly,
} from "./maria-manager-ui-policy";

describe("Maria manager UI safety and action availability", () => {
  it.each(["preview", "production"])("does not offer Maria's broken generic hours save in %s", (env) => {
    expect(isMariaGenericBookingHoursReadOnly("makeup-by-maria", env)).toBe(true);
  });

  it("preserves the generic hours editor for unrelated workspaces and local development", () => {
    for (const env of ["preview", "production", "development", undefined]) {
      expect(isMariaGenericBookingHoursReadOnly("unrelated-workspace", env)).toBe(false);
    }
    expect(isMariaGenericBookingHoursReadOnly("makeup-by-maria", "development")).toBe(false);
  });

  it("shows Maria booking detail mutation controls only in isolated Preview", () => {
    expect(isMariaBookingDetailReadOnly("makeup-by-maria", "preview")).toBe(false);
    for (const env of ["production", "development", undefined]) {
      expect(isMariaBookingDetailReadOnly("makeup-by-maria", env)).toBe(true);
    }
  });

  it("does not hide existing booking controls for unrelated workspaces", () => {
    for (const env of ["preview", "production", "development", undefined]) {
      expect(isMariaBookingDetailReadOnly("unrelated-workspace", env)).toBe(false);
    }
  });
});
