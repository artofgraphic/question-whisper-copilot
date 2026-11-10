import { describe, expect, it } from "vitest";
import { countStatuses, overallStatus } from "@/lib/verify/types";
describe("verification overall status", () => {
  it("contradicted beats everything", () => expect(overallStatus([{ status: "supported" }, { status: "stale" }, { status: "contradicted" }])).toBe("contradicted"));
  it("stale beats supported", () => expect(overallStatus([{ status: "supported" }, { status: "stale" }])).toBe("stale"));
  it("personal-only answers need personal confirmation", () => expect(overallStatus([{ status: "personal" }])).toBe("personal"));
  it("personal claims don't downgrade supported facts", () => expect(overallStatus([{ status: "personal" }, { status: "supported" }])).toBe("supported"));
  it("counts per status", () => expect(countStatuses([{ status: "stale" }, { status: "stale" }]).stale).toBe(2));
});
