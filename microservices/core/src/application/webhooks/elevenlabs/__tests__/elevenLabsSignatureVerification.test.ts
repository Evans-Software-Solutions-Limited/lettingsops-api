import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyElevenLabsSignature } from "../elevenLabsSignatureVerification";
import { createHmac } from "crypto";

describe("verifyElevenLabsSignature", () => {
  const SECRET = "test-webhook-secret";
  const NOW = Date.now();

  function createValidSignature(body: string, timestamp: number) {
    const signedPayload = `${timestamp}.${body}`;
    return createHmac("sha256", SECRET).update(signedPayload).digest("hex");
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELEVENLABS_WEBHOOK_SECRET = SECRET;
  });

  it("should validate a correct HMAC signature", () => {
    const body = '{"callId":"call-123","agentId":"agent-456"}';
    const timestamp = NOW;
    const signature = createValidSignature(body, timestamp);
    const header = `t=${timestamp},v0=${signature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject an invalid HMAC signature", () => {
    const body = '{"callId":"call-123","agentId":"agent-456"}';
    const timestamp = NOW;
    const wrongSignature = "0".repeat(64); // Invalid signature
    const header = `t=${timestamp},v0=${wrongSignature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Signature verification failed");
  });

  it("should reject when signature header is missing", () => {
    const body = '{"callId":"call-123"}';

    const result = verifyElevenLabsSignature(undefined, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing ElevenLabs-Signature header");
  });

  it("should reject when signature header format is invalid", () => {
    const body = '{"callId":"call-123"}';
    const invalidHeader = "invalid-format";

    const result = verifyElevenLabsSignature(invalidHeader, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature header format");
  });

  it("should reject when timestamp is older than 5 minutes", () => {
    const body = '{"callId":"call-123"}';
    const oldTimestamp = NOW - 6 * 60 * 1000; // 6 minutes ago
    const signature = createValidSignature(body, oldTimestamp);
    const header = `t=${oldTimestamp},v0=${signature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Timestamp is too old");
  });

  it("should accept a timestamp that is exactly 5 minutes old", () => {
    const body = '{"callId":"call-123"}';
    const oldTimestamp = NOW - 5 * 60 * 1000; // exactly 5 minutes ago
    const signature = createValidSignature(body, oldTimestamp);
    const header = `t=${oldTimestamp},v0=${signature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject when timestamp is invalid", () => {
    const body = '{"callId":"call-123"}';
    const header = `t=not-a-number,v0=${createValidSignature(body, NOW)}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid timestamp format");
  });

  it("should reject when signature is missing from header", () => {
    const body = '{"callId":"call-123"}';
    const header = `t=${NOW}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature header format");
  });

  it("should reject when timestamp is missing from header", () => {
    const body = '{"callId":"call-123"}';
    const signature = createValidSignature(body, NOW);
    const header = `v0=${signature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid signature header format");
  });

  it("should be resistant to signature length mismatch attacks", () => {
    const body = '{"callId":"call-123"}';
    const timestamp = NOW;
    const shortSignature = "deadbeef"; // Wrong length
    const header = `t=${timestamp},v0=${shortSignature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Signature verification failed");
  });

  it("should correctly verify with complex JSON body", () => {
    const body = JSON.stringify({
      callId: "call-456",
      agentId: "agent-789",
      intent: "viewing_enquiry",
      extractedFields: {
        name: "John Doe",
        email: "john@example.com",
        phone: "07700000000",
        propertyRef: "PROP-001",
        moveInDate: "2024-04-01",
      },
      transcript: [
        {
          role: "agent",
          message: "Hello, how can I help?",
          timestamp: "2024-01-01T10:00:00Z",
        },
        {
          role: "user",
          message: "I'm interested in viewing the property",
          timestamp: "2024-01-01T10:01:00Z",
        },
      ],
      callDurationSeconds: 300,
    });
    const timestamp = NOW;
    const signature = createValidSignature(body, timestamp);
    const header = `t=${timestamp},v0=${signature}`;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject if body changes after signature is created", () => {
    const originalBody = '{"callId":"call-123"}';
    const timestamp = NOW;
    const signature = createValidSignature(originalBody, timestamp);
    const header = `t=${timestamp},v0=${signature}`;

    // Try to verify with different body
    const tamperedBody = '{"callId":"call-456"}';
    const result = verifyElevenLabsSignature(header, tamperedBody);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Signature verification failed");
  });

  it("should reject when webhook secret is not configured", () => {
    const body = '{"callId":"call-123"}';
    const timestamp = NOW;
    const signature = createValidSignature(body, timestamp);
    const header = `t=${timestamp},v0=${signature}`;

    // Clear the secret
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;

    const result = verifyElevenLabsSignature(header, body);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Webhook secret is not configured");
  });
});
