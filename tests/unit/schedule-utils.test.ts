import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultLunch,
  isLunchActive,
  sanitizeLunch,
  validateLunch,
} from "@/lib/schedule-utils";

describe("Schedule Utils - Lunch Break Intelligence", () => {
  it("generates default 12:00-13:00 when shift covers standard lunch window", () => {
    const lunch = getDefaultLunch("08:00", "18:00");
    assert.deepEqual(lunch, { breakStart: "12:00", breakEnd: "13:00" });
  });

  it("calculates centered lunch for afternoon or non-standard shift", () => {
    const lunch = getDefaultLunch("14:00", "22:00");
    assert.ok(lunch.breakStart >= "17:00" && lunch.breakEnd <= "19:30");
    assert.ok(lunch.breakStart < lunch.breakEnd);
  });

  it("detects whether lunch is active or inactive", () => {
    assert.equal(isLunchActive("12:00", "13:00"), true);
    assert.equal(isLunchActive(null, null), false);
    assert.equal(isLunchActive("12:00", null), false);
    assert.equal(isLunchActive("", "13:00"), false);
    assert.equal(isLunchActive("   ", "   "), false);
  });

  it("sanitizes missing or partial lunch to null (clean continuous shift)", () => {
    assert.deepEqual(sanitizeLunch("08:00", "18:00", "", ""), {
      breakStart: null,
      breakEnd: null,
    });
    assert.deepEqual(sanitizeLunch("08:00", "18:00", "12:00", null), {
      breakStart: null,
      breakEnd: null,
    });
    assert.deepEqual(sanitizeLunch("08:00", "18:00", null, "13:00"), {
      breakStart: null,
      breakEnd: null,
    });
  });

  it("automatically clears lunch if employee works only until 12:00", () => {
    const sanitized = sanitizeLunch("08:00", "12:00", "12:00", "13:00");
    assert.deepEqual(sanitized, { breakStart: null, breakEnd: null });
  });

  it("validates valid and invalid lunch intervals", () => {
    assert.equal(validateLunch("08:00", "18:00", "12:00", "13:00").valid, true);
    assert.equal(validateLunch("08:00", "18:00", null, null).valid, true);

    const inverted = validateLunch("08:00", "18:00", "14:00", "13:00");
    assert.equal(inverted.valid, false);

    const outsideShift = validateLunch("08:00", "12:00", "12:30", "13:30");
    assert.equal(outsideShift.valid, false);
  });
});
