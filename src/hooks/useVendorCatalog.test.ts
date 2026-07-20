import { describe, expect, it } from "vitest";
import { nextVendorPage } from "./useVendorCatalog";

describe("vendor pagination", () => {
  it("bounds normal and final pages", () => {
    expect(nextVendorPage(0, 1_000_000)).toEqual({ offset: 0, limit: 50 });
    expect(nextVendorPage(999_980, 1_000_000)).toEqual({
      offset: 999_980,
      limit: 20,
    });
    expect(nextVendorPage(1_000_000, 1_000_000)).toEqual({
      offset: 1_000_000,
      limit: 0,
    });
  });
});
