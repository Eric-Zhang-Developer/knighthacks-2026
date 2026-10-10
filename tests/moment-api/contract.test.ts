import { expect, test, vi } from "vitest";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { groundClaim, momentSchema } from "@/lib/moment/contract";

const v = "11111111-1111-4111-8111-111111111111";
const fields = ["Team meal planner", "Collect each teammate's dietary constraints, then choose a shared meal", null];
const claim = (text: string, label: "supported" | "inferred" | "unverified", sourceIds: string[] = []) => ({ text, label, sourceIds });
const step = { judgeDoes: "Types two allergies", appears: "One shared meal", demonstrates: claim("choose a shared meal", "supported") };

test("supported only when the text quotes the version verbatim; the version becomes its source", () => {
  expect(groundClaim(claim("choose a shared meal", "supported"), v, fields)).toEqual(claim("choose a shared meal", "supported", [v]));
  expect(groundClaim(claim("Orders food through DoorDash", "supported", [v]), v, fields).label).toBe("inferred");
  expect(groundClaim(claim("Teams decide faster", "inferred", ["other-source"]), v, fields)).toEqual(claim("Teams decide faster", "inferred"));
  expect(groundClaim(claim("Unknown demand", "unverified"), v, fields).label).toBe("unverified");
});
test("exactly three complete steps, each part at most 160 characters", () => {
  const basis = [claim("Team meal planner", "supported")];
  expect(momentSchema.safeParse({ steps: [step, step, step], basis }).success).toBe(true);
  expect(momentSchema.safeParse({ steps: [step, step], basis }).success).toBe(false);
  expect(momentSchema.safeParse({ steps: [step, step, { judgeDoes: "x", appears: "y" }], basis }).success).toBe(false);
  expect(momentSchema.safeParse({ steps: [step, step, { ...step, appears: "x".repeat(161) }], basis }).success).toBe(false);
});
