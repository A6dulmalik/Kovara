export default [
  {
    ignores: ["node_modules/", "dist/", "coverage/", "build/"],
  },
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    languageOptions: {
      globals: {
        node: true,
        es2021: true,
      },
    },
  },
];
