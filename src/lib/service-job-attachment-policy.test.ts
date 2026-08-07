import { describe, expect, it } from "vitest";

import {
  sanitizeServiceJobAttachmentName,
  serviceJobAttachmentMaxBytes,
  validateServiceJobAttachment,
} from "./service-job-attachment-policy";

describe("service job attachment policy", () => {
  it("accepts supported files within the size limit", () => {
    expect(validateServiceJobAttachment({ name: "Before photo.JPG", type: "image/jpeg", size: 1024 })).toEqual({
      ok: true,
      safeFileName: "before-photo.jpg",
    });
  });

  it("rejects executable and oversized files", () => {
    expect(validateServiceJobAttachment({ name: "payload.exe", type: "application/octet-stream", size: 1024 })).toEqual({ ok: false, code: "type" });
    expect(validateServiceJobAttachment({ name: "large.pdf", type: "application/pdf", size: serviceJobAttachmentMaxBytes + 1 })).toEqual({ ok: false, code: "size" });
  });

  it("normalizes traversal-like and unsafe file names", () => {
    expect(sanitizeServiceJobAttachmentName("  ../My customer photo (1).PNG  ")).toBe("my-customer-photo-1.png");
  });
});
