import { crx, defineManifest } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

const manifest = defineManifest({
  manifest_version: 3,
  description:  "VODparty Chrome Extension Plugin",
  name: "VODparty",
  version: "0.2.1",
  "permissions": [
    "tabs",
  ],
  action: {
    default_title: "VODparty",
  },
  background: {
    service_worker: "src/background/index.ts",
  },
  content_scripts: [
    {
      "matches": [
        "https://www.youtube.com/*",
        "https://animestore.docomo.ne.jp/*",
      ],
      "js": ["src/content/index.ts", "src/content/dAnimeStore.ts"]
    }
  ],
});

export default defineConfig({
  plugins: [crx({ manifest })],
});