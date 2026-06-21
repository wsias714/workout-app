import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" makes all asset paths relative, so the app works at
// https://<user>.github.io/<any-repo-name>/ without editing this file.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
