/**
 * eslint-config-next 16 ships flat configs directly, so the old `FlatCompat`
 * shim is no longer needed — and no longer works: routing the modern config
 * back through the eslintrc compatibility layer throws on a circular reference
 * in the react plugin.
 */

import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
];
