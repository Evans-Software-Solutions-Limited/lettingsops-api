import { lettingsAPI } from "./api";

const region = aws.getRegionOutput().name;

export const frontend = new sst.aws.StaticSite("web", {
  path: "packages/web",
  build: {
    output: "dist",
    command: "bun run build",
  },
  environment: {
    VITE_REGION: region,
    VITE_CORE_API_URL: lettingsAPI.url,
  },
});
