import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiKeysService } from "../apiKeysService";

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockKeyRow = {
  id: "key-uuid-1",
  agencyId: "agency-uuid-1",
  name: "CI deploy", // DB column is `name`; service maps "" → null on reads
  prefix: "abc123de",
  keyHash: "abc123hash",
  lastUsedAt: null,
  revokedAt: null,
  createdAt: NOW,
};

const mockRepo = {
  create: vi.fn(),
  listForAgency: vi.fn(),
  revoke: vi.fn(),
};

vi.mock("@lettingsops/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../../auth/apiKeyRepository", () => ({
  ApiKeyRepository: vi.fn(() => mockRepo),
}));

const svc = ApiKeysService.decorator.apiKeysService;

describe("ApiKeysService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createApiKey ──────────────────────────────────────────────────────────

  describe("createApiKey", () => {
    it("returns a raw key and the row fields on success", async () => {
      mockRepo.create.mockResolvedValue(mockKeyRow);

      const result = await svc.createApiKey("agency-uuid-1", "CI deploy");

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId: "agency-uuid-1",
          name: "CI deploy", // stored as `name` in DB
          keyHash: expect.any(String),
        }),
      );
      expect(result.id).toBe("key-uuid-1");
      expect(result.agencyId).toBe("agency-uuid-1");
      expect(result.label).toBe("CI deploy"); // mapped back from row.name
      expect(typeof result.key).toBe("string");
      expect(result.key.length).toBeGreaterThanOrEqual(32);
      expect(result.createdAt).toBe(NOW.toISOString());
    });

    it("stores the SHA-256 hash, not the raw key", async () => {
      mockRepo.create.mockResolvedValue(mockKeyRow);
      await svc.createApiKey("agency-uuid-1");

      const { keyHash } = mockRepo.create.mock.calls[0][0] as {
        keyHash: string;
      };
      // Hash must be 64-char hex (SHA-256)
      expect(keyHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("passes empty-string name (null label) when none is provided", async () => {
      mockRepo.create.mockResolvedValue({ ...mockKeyRow, name: "" });
      const result = await svc.createApiKey("agency-uuid-1");

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "" }), // "" stored when no label given
      );
      expect(result.label).toBeNull(); // "" normalised to null on read
    });

    it("throws 401 when agencyId is null", async () => {
      await expect(svc.createApiKey(null)).rejects.toThrow("Authentication");
    });
  });

  // ── listApiKeys ───────────────────────────────────────────────────────────

  describe("listApiKeys", () => {
    it("returns mapped rows for the agency", async () => {
      mockRepo.listForAgency.mockResolvedValue([mockKeyRow]);

      const result = await svc.listApiKeys("agency-uuid-1");

      expect(mockRepo.listForAgency).toHaveBeenCalledWith("agency-uuid-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "key-uuid-1",
        agencyId: "agency-uuid-1",
        label: "CI deploy", // row.name mapped to label
        lastUsedAt: null,
        revokedAt: null,
        createdAt: NOW.toISOString(),
      });
    });

    it("maps revokedAt to ISO string when present", async () => {
      const revokedAt = new Date("2024-07-01T09:00:00.000Z");
      mockRepo.listForAgency.mockResolvedValue([{ ...mockKeyRow, revokedAt }]);

      const result = await svc.listApiKeys("agency-uuid-1");
      expect(result[0].revokedAt).toBe(revokedAt.toISOString());
    });

    it("returns empty array when agency has no keys", async () => {
      mockRepo.listForAgency.mockResolvedValue([]);

      const result = await svc.listApiKeys("agency-uuid-1");
      expect(result).toEqual([]);
    });

    it("throws 401 when agencyId is null", async () => {
      await expect(svc.listApiKeys(null)).rejects.toThrow("Authentication");
    });
  });

  // ── revokeApiKey ──────────────────────────────────────────────────────────

  describe("revokeApiKey", () => {
    it("calls revoke when the key belongs to the agency", async () => {
      mockRepo.listForAgency.mockResolvedValue([mockKeyRow]);
      mockRepo.revoke.mockResolvedValue(undefined);

      await svc.revokeApiKey("agency-uuid-1", "key-uuid-1");

      expect(mockRepo.revoke).toHaveBeenCalledWith("key-uuid-1");
    });

    it("throws 404 when the key is not found or belongs to a different agency", async () => {
      mockRepo.listForAgency.mockResolvedValue([mockKeyRow]);

      await expect(
        svc.revokeApiKey("agency-uuid-1", "key-other-agency"),
      ).rejects.toThrow("API key not found");
    });

    it("throws 404 when the agency has no keys at all", async () => {
      mockRepo.listForAgency.mockResolvedValue([]);

      await expect(
        svc.revokeApiKey("agency-uuid-1", "key-uuid-1"),
      ).rejects.toThrow("API key not found");
    });

    it("throws 401 when agencyId is null", async () => {
      await expect(svc.revokeApiKey(null, "key-uuid-1")).rejects.toThrow(
        "Authentication",
      );
    });
  });
});
