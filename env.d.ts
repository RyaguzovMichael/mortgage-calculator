/// <reference types="vite/client" />

// Typed as `unknown` on purpose: nothing checks the contents of a YAML file, so
// every import has to go through a validator before it is trusted. See
// src/infrastructure/depositCatalogue.ts.
declare module '*.yml' {
  const data: unknown
  export default data
}
