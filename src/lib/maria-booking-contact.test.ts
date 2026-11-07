import { describe, expect, it } from "vitest";
import { isValidMariaBookingEmail, isValidMariaBookingPhone } from "./maria-booking-contact";

describe("Maria Preview email validation", () => {
  it.each([
    "someone@example.com", "ibbo.abdoli@gmail.com", "bride+trial@outlook.com",
    "sarah.ali+2028@gmail.com",
  ])("accepts syntactically plausible address %s", email => {
    expect(isValidMariaBookingEmail(email)).toBe(true);
  });

  it.each([
    "a@gmail.com", "a+tag@gmail.com", "abc@gmail.com",
    "a@outlook.com", "missing-at", "person@domain",
    "person@-invalid.com", "person@example.c", "first..last@example.com",
    "person@domain_.com",
  ])("rejects malformed address %s", email => {
    expect(isValidMariaBookingEmail(email)).toBe(false);
  });
});

describe("Maria Preview phone validation", () => {
  it.each([
    "0701234567", "08 123 456", "+46701234567",
    "+46 70 123 45 67", "+44 7700 900123",
    "+46 (0)70 123 45 67",
  ])("accepts plausibly formatted phone %s", phone => {
    expect(isValidMariaBookingPhone(phone)).toBe(true);
  });

  it.each([
    "+44444444xxxx", "070xxxxxxx", "abc1234567", "12345", "1234567890123456",
    "++++46701234567", "+0123456789", "0000000000", "555555555",
    "+46 (70 1234567", "0701234567#", "070.123.45",
  ])("rejects malformed phone %s", phone => {
    expect(isValidMariaBookingPhone(phone)).toBe(false);
  });
});
