import { join } from "node:path";
import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import type { UserConfig } from "vite";

import htmlTerserCompression from "vite-plugin-simple-html";
import license, { Options as LicenseOptions } from "rollup-plugin-license";

const licenseOptions: LicenseOptions = {
  sourcemap: true,
  thirdParty: {
    includePrivate: true,
    includeSelf: true,
    multipleVersions: true,

    output: {
      file: join(__dirname, "dist", "licenses.html"),

      template(dependencies) {
        const template = readFileSync(
          join(__dirname, "config", "licenses.template.html"),
          "utf-8"
        );
        const licenses = dependencies
          .filter((d) => d.license && d.licenseText)
          .sort((a, b) => a.license!.localeCompare(b.license!))
          .map(
            (d) =>
              `<h2>${d.name}@${d.version}</h2>
               <p class="license-text">${d.licenseText}</p>
              `
          )
          .join("\n");

        return template.replace("{{licenses}}", licenses);
      },
    },
  },
};

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("node_modules") > -1) {
            return id.split("node_modules/")[1].split("/")[0];
          }
        },
      },
    },
  },

  plugins: [license(licenseOptions), htmlTerserCompression({ minify: true })],

  clearScreen: false,
  resolve: {
    preserveSymlinks: true,
  },
} as UserConfig);
