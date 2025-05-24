import { crx, defineManifest } from "@crxjs/vite-plugin";
import zipPack, { Options } from "vite-plugin-zip-pack";
import { defineConfig } from "vite";

const manifest = defineManifest({
  manifest_version: 3,
  description:  "VODparty Chrome Extension Plugin",
  name: "VODparty",
  version: "0.2.6",
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
  icons: {
    128: "icons/icon.png"
  },
});

const zipOptions = {
  outFileName: "vodparty-chrome.zip"
} as Options;

export default defineConfig({
  plugins: [crx({ manifest }), zipPack(zipOptions)],
});