import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/application/**/*.ts", "src/**/repositories/*.ts"],
      exclude: [
        "node_modules",
        "**/*.test.ts",
        "**/vitest.config.ts",
        "**/sst-env.d.ts",
        "src/api.ts",
        "src/index.ts",
        "**/index.ts",
        "**/api.ts",
        "**/*.d.ts",
        "**/types/**",
        "**/emailProcessor.ts",
        // Thin Elysia route handlers — no functional logic to test
        "**/emailIngestionHandler.ts",
        "**/viewingBookHandler.ts",
        "**/viewingSlotsHandler.ts",
        "**/leadsCreateHandler.ts",
        "**/leadsGetHandler.ts",
        "**/leadsListHandler.ts",
        "**/leadsCommunicationHandler.ts",
        "**/leadsCommunicationService.ts",
        "**/qualificationSubmitHandler.ts",
        "**/elevenLabsWebhookHandler.ts",
        "**/elevenLabsWebhookService.ts",
      ],
      // Enforce 90% minimum coverage threshold across all files
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
