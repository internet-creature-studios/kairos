import { defineConfig } from "vite";

// The engine bench: an instrument for looking at the engine's numbers, not
// the KAIROS app.
export default defineConfig({
  root: "bench",
  server: { port: 5180, strictPort: true },
});
