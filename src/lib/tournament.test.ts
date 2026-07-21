import { describe, expect, it } from "vitest";
import { advanceTournament, shuffleTournament } from "./tournament";

describe("tournament bracket", () => {
  it("collects every winner in a round before starting the next round", () => {
    let bracket = {
      remaining: ["1", "2", "3", "4", "5", "6", "7", "8"],
      advancing: [] as string[],
    };

    bracket = advanceTournament(bracket, "1", () => 0.999);
    expect(bracket).toEqual({
      remaining: ["3", "4", "5", "6", "7", "8"],
      advancing: ["1"],
    });

    bracket = advanceTournament(bracket, "4", () => 0.999);
    bracket = advanceTournament(bracket, "5", () => 0.999);
    bracket = advanceTournament(bracket, "8", () => 0.999);

    expect(bracket).toEqual({
      remaining: ["1", "4", "5", "8"],
      advancing: [],
    });
  });

  it("advances an unmatched vendor with a bye", () => {
    const bracket = advanceTournament(
      { remaining: ["1", "2", "3"], advancing: [] },
      "2",
      () => 0.999,
    );

    expect(bracket).toEqual({ remaining: ["2", "3"], advancing: [] });
  });

  it("shuffles without changing the entrants", () => {
    expect(shuffleTournament(["1", "2", "3", "4"], () => 0)).toEqual([
      "2",
      "3",
      "4",
      "1",
    ]);
  });
});
