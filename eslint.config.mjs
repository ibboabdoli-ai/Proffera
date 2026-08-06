import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["src/app/boka/[slug]/booking-request-form.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "src/app/dashboard/kalender/page.tsx",
      "src/app/mina-bokningar/[token]/page.tsx",
    ],
    rules: {
      "react-hooks/purity": "off",
    },
  },
  {
    // Workspace media URLs may use the internal media route or a tenant-specific
    // Vercel Blob URL, and original image dimensions are not stored. Keep direct
    // rendering scoped to these media surfaces so arbitrary aspect ratios and
    // remote hosts are not rewritten or blocked by the Next image optimizer.
    files: [
      "src/app/demo/primeview/gallery/page.tsx",
      "src/app/dashboard/galleri/page.tsx",
      "src/app/boka/*/page.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
