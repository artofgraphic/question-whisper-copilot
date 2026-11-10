import { describe, expect, it } from "vitest";
import { looksLikeQuestion } from "@/lib/answer";

describe("Interview question detection", () => {
  it("recognizes a request after an introductory phrase", () => {
    expect(looksLikeQuestion("Oh, tell us about your experience.")).toBe(true);
  });
  it("recognizes a question after earlier speech without punctuation", () => {
    expect(looksLikeQuestion("Thanks for joining us today could you explain how you resolve a team conflict")).toBe(true);
  });
  it("recognizes short follow-up questions", () => {
    expect(looksLikeQuestion("Why not?")).toBe(true);
  });
  it("does not treat a greeting as a question", () => {
    expect(looksLikeQuestion("Thanks for joining us today.")).toBe(false);
  });
});