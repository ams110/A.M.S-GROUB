import nextConfig from "eslint-config-next";
import prettierConfig from "eslint-config-prettier";

export default [
  ...nextConfig,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The async fetch-in-effect pattern (call load() → setState inside async fn) is
      // legitimate. This rule is too aggressive for our existing codebase.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];
