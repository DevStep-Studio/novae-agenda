import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPhoneForWhatsApp,
  formatPhoneDisplay,
  maskPhoneInput,
  isValidPhone,
} from "@/lib/api-client";
import {
  formatPhoneForWhatsApp as mobileFormatPhoneForWhatsApp,
  formatPhoneInput as mobileFormatPhoneInput,
} from "../mobile/src/lib/formatters";

describe("Phone Formatting & WhatsApp Normalization Suite", () => {
  it("sanitizes 14-digit numbers with extra digits (+55219967891719 -> 5521996789171)", () => {
    assert.equal(formatPhoneForWhatsApp("+55219967891719"), "5521996789171");
    assert.equal(mobileFormatPhoneForWhatsApp("+55219967891719"), "5521996789171");
  });

  it("sanitizes 12-digit national numbers with extra trailing digit (219967891719 -> 5521996789171)", () => {
    assert.equal(formatPhoneForWhatsApp("219967891719"), "5521996789171");
    assert.equal(mobileFormatPhoneForWhatsApp("219967891719"), "5521996789171");
  });

  it("formats standard Brazilian mobile numbers correctly", () => {
    assert.equal(formatPhoneForWhatsApp("(21) 99678-9171"), "5521996789171");
    assert.equal(formatPhoneForWhatsApp("21996789171"), "5521996789171");
    assert.equal(formatPhoneForWhatsApp("+55 21 99678-9171"), "5521996789171");
    assert.equal(formatPhoneForWhatsApp("5521996789171"), "5521996789171");
  });

  it("handles leading zero on DDD properly (021996789171 -> 5521996789171)", () => {
    assert.equal(formatPhoneForWhatsApp("021996789171"), "5521996789171");
    assert.equal(mobileFormatPhoneForWhatsApp("021996789171"), "5521996789171");
  });

  it("formats standard landline numbers correctly", () => {
    assert.equal(formatPhoneForWhatsApp("(11) 3456-7890"), "551134567890");
    assert.equal(formatPhoneForWhatsApp("1134567890"), "551134567890");
    assert.equal(formatPhoneForWhatsApp("551134567890"), "551134567890");
  });

  it("handles empty or null phone numbers gracefully", () => {
    assert.equal(formatPhoneForWhatsApp(null), "");
    assert.equal(formatPhoneForWhatsApp(undefined), "");
    assert.equal(formatPhoneForWhatsApp(""), "");
  });

  it("formats display and mask inputs correctly", () => {
    assert.equal(formatPhoneDisplay("21996789171"), "(21) 99678-9171");
    assert.equal(formatPhoneDisplay("5521996789171"), "(21) 99678-9171");
    assert.equal(maskPhoneInput("21996789171"), "(21) 99678-9171");
    assert.equal(maskPhoneInput("1134567890"), "(11) 3456-7890");
    assert.equal(mobileFormatPhoneInput("21996789171"), "(21) 99678-9171");
  });

  it("validates phone validity with isValidPhone", () => {
    assert.equal(isValidPhone("21996789171"), true);
    assert.equal(isValidPhone("(21) 99678-9171"), true);
    assert.equal(isValidPhone("1134567890"), true);
    assert.equal(isValidPhone("123"), false);
    assert.equal(isValidPhone(""), false);
    assert.equal(isValidPhone(null), false);
  });
});
