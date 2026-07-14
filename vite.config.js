import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // If deploying to GitHub Pages at https://user.github.io/REPO/,
  // uncomment and set base: base: "/REPO/",
  plugins: [react(), tailwindcss()],
});
