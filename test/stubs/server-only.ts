// Vitest stands in for the `server-only` package with this empty module. The
// real package throws on import outside a react-server bundle; Next.js
// enforces it in the build, which is where it matters.
export {};
