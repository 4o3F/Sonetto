import eslintPluginAstro from "eslint-plugin-astro";
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: ["dist/**", ".astro/**", ".ccg/**", ".claude/**", "public/**"] },
  ...eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
  },
  { rules: { "no-console": "error" } },
  {
    files: ["scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
];
