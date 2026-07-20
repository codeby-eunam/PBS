import { describe, expect, it, vi } from "vitest";
import { applyLineReport, findRecentDeviceReport } from "./lineReports";

describe("line reports", () => {
  it("adds, updates, and rejects a duplicate", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "report-1" });
    const added = applyLineReport([], "device-1", "Short", 1_000_000);
    expect(added.result).toBe("added");
    const updated = applyLineReport(
      added.history,
      "device-1",
      "Busy",
      1_060_000,
    );
    expect(updated.result).toBe("updated");
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].status).toBe("Busy");
    expect(
      applyLineReport(updated.history, "device-1", "Busy", 1_120_000).result,
    ).toBe("duplicate");
    vi.unstubAllGlobals();
  });

  it("caps history and finds the current device report", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "new-report" });
    const history = Array.from({ length: 10 }, (_, index) => ({
      id: `old-${index}`,
      deviceId: `other-${index}`,
      status: "Short" as const,
      at: 1000 - index,
      photo: null,
    }));
    const result = applyLineReport(history, "device-1", "No line", 1_000_000);
    expect(result.history).toHaveLength(10);
    expect(result.history[0].id).toBe("new-report");
    expect(
      findRecentDeviceReport(result.history, "device-1", 1_000_001),
    ).toBeDefined();
    vi.unstubAllGlobals();
  });
});
