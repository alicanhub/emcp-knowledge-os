import eslint from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["js/**/*.js", "admin/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-prototype-builtins": "error",
      "no-implied-eval": "error",
      eqeqeq: "error",
    },
  },
  {
    files: ["service-worker.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.serviceworker },
    },
    rules: { "no-unused-vars": "warn" },
  },
  {
    files: [
      "scripts/**/*.mjs",
      "tests/**/*.mjs",
      "production-engine/**/*.js",
      "playwright.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: { "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["tests/browser/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
