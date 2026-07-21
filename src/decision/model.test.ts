import { describe, expect, it } from "vitest";
import {
  advanceMatch,
  buildSystemLists,
  decisionStartMode,
  startSession,
} from "./model";

describe("decision start mode", () => {
  it("opens a single vendor directly", () => {
    expect(decisionStartMode(1)).toBe("single");
  });

  it("starts a tournament for 2 through 8 vendors", () => {
    for (let count = 2; count <= 8; count += 1)
      expect(decisionStartMode(count)).toBe("tournament");
  });

  it("starts swiping for more than 8 vendors", () => {
    expect(decisionStartMode(9)).toBe("swipe");
  });
});

describe("decision tournament", () => {
  it("advances an odd candidate with a bye", () => {
    const session = {
      ...startSession({
        id: "l",
        name: "L",
        description: "",
        tags: [],
        vendorIds: ["a", "b", "c"],
      }),
      tournamentRemaining: ["a", "b", "c"],
    };
    expect(advanceMatch(session, "a").tournamentRemaining).toEqual(["a", "c"]);
  });
  it("finishes with a winner", () => {
    const session = {
      ...startSession({
        id: "l",
        name: "L",
        description: "",
        tags: [],
        vendorIds: ["a", "b"],
      }),
      tournamentRemaining: ["a", "b"],
    };
    expect(advanceMatch(session, "b").resultVendorId).toBe("b");
  });
});

describe("decision lists", () => {
  it("places the four complete catalog lists first", () => {
    const vendors = [
      { id: "food", vendorType: "food" },
      { id: "game", vendorType: "game" },
      { id: "shop", vendorType: "shopping" },
    ] as any;
    expect(buildSystemLists(vendors).map((list) => list.name)).toEqual([
      "ALL VENDORS",
      "ALL FOODS",
      "ALL GAMES",
      "ALL SHOPPINGS",
    ]);
  });
});
