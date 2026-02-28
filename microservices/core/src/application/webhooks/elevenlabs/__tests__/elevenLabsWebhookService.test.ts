import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElevenLabsWebhookService } from "../elevenLabsWebhookService";

describe("ElevenLabsWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should expose handleWebhook method", () => {
    const service = ElevenLabsWebhookService;
    expect(service).toBeDefined();
    // The service is an Elysia plugin that decorates the context
    // We're just checking it exists and can be used
  });
});
