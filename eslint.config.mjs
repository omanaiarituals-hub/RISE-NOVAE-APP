import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "coverage/**",
      "logs/**",
      "public/sw.js",
      "test-env.js",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",

      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",

      "@next/next/no-img-element": "warn",
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;