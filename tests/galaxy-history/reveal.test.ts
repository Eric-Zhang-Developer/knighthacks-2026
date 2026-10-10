import { expect, it } from "vitest";
import { createdLabel, revealMask, yearsOf } from "@/components/galaxy/stars";

const stars = [{ year: 2021 }, { year: 2019 }, { year: null }, {}, { year: 2021 }];

it("lists the distinct known years in order", () => {
  expect(yearsOf(stars)).toEqual([2019, 2021]);
});

it("shows stars up to the reveal year and always the ones with no year", () => {
  expect([...revealMask(stars, 2019)]).toEqual([0, 1, 1, 1, 0]);
  expect([...revealMask(stars, 2021)]).toEqual([1, 1, 1, 1, 1]);
  expect([...revealMask(stars, null)]).toEqual([1, 1, 1, 1, 1]);
});

it("labels the year as created, never as a bare year", () => {
  expect(createdLabel(2019)).toBe("created 2019");
  expect(createdLabel(null)).toBe("date unknown");
  expect(createdLabel(undefined)).toBe("date unknown");
});
