import { createHmac, timingSafeEqual } from "crypto";

interface VerificationResult {
  valid: boolean;
  error?: string;
}

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verifies the HMAC signature from an ElevenLabs webhook.
 *
 * ElevenLabs sends a header in the format: t=<timestamp>,v0=<hmac_signature>
 * The signature is computed as HMAC-SHA256 of `<timestamp>.<rawBody>` using the webhook secret.
 *
 * @param signatureHeader - The ElevenLabs-Signature header value
 * @param rawBody - The raw request body as a string
 * @returns An object with `valid` boolean and optional `error` message
 */
export function verifyElevenLabsSignature(
  signatureHeader: string | undefined,
  rawBody: string,
): VerificationResult {
  // Check if signature header is present
  if (!signatureHeader) {
    return {
      valid: false,
      error: "Missing ElevenLabs-Signature header",
    };
  }

  // Parse the signature header (format: t=<timestamp>,v0=<signature>)
  const parts = signatureHeader.split(",");
  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v0") {
      signature = value;
    }
  }

  if (!timestamp || !signature) {
    return {
      valid: false,
      error: "Invalid signature header format",
    };
  }

  // Verify timestamp is recent (replay attack protection)
  const timestampMs = parseInt(timestamp, 10);
  if (isNaN(timestampMs)) {
    return {
      valid: false,
      error: "Invalid timestamp format",
    };
  }

  const now = Date.now();
  const age = now - timestampMs;
  if (age >= TIMESTAMP_TOLERANCE_MS + 1000) {
    // Allow up to 5 minutes + 1 second for clock skew
    return {
      valid: false,
      error: "Timestamp is too old (older than 5 minutes)",
    };
  }

  // Compute the expected signature
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    return {
      valid: false,
      error: "Webhook secret is not configured",
    };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Compare signatures using timing-safe comparison
  try {
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        error: "Signature verification failed",
      };
    }

    const isEqual = timingSafeEqual(signatureBuffer, expectedBuffer);
    if (!isEqual) {
      return {
        valid: false,
        error: "Signature verification failed",
      };
    }
  } catch {
    return {
      valid: false,
      error: "Signature verification failed",
    };
  }

  return {
    valid: true,
  };
}
