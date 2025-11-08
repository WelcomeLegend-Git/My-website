import { fileURLToPath } from "node:url";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist",
      "build",
      "node_modules",
      "apps/server/vitest.config.ts",
      "apps/server/prisma/seed.ts",
      "apps/web/vite.config.ts",
      "apps/web/vitest.config.ts",
      "apps/web/vitest.setup.ts",
      "apps/web/tailwind.config.ts",
    ],
  },
  {
    files: ["apps/server/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./apps/server/tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [["builtin", "external", "internal"], "parent", "sibling", "index"],
        },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/shared/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: [
          "./apps/web/tsconfig.json",
          "./packages/shared/tsconfig.json",
        ],
        tsconfigRootDir: __dirname,
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      import: importPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      // Relax overly-aggressive new rules for practical app state patterns
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "import/order": [
        "error",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [["builtin", "external", "internal"], "parent", "sibling", "index"],
        },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  }
);