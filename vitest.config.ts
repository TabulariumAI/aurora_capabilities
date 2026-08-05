import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
      "@radix-ui/react-checkbox": path.resolve(rootDir, "node_modules/@radix-ui/react-checkbox"),
      "@radix-ui/react-compose-refs": path.resolve(rootDir, "node_modules/@radix-ui/react-compose-refs"),
      "@radix-ui/react-collapsible": path.resolve(rootDir, "node_modules/@radix-ui/react-collapsible"),
      "@radix-ui/react-context": path.resolve(rootDir, "node_modules/@radix-ui/react-context"),
      "@radix-ui/react-direction": path.resolve(rootDir, "node_modules/@radix-ui/react-direction"),
      "@radix-ui/react-presence": path.resolve(rootDir, "node_modules/@radix-ui/react-presence"),
      "@radix-ui/react-primitive": path.resolve(rootDir, "node_modules/@radix-ui/react-primitive"),
      "@radix-ui/react-popover": path.resolve(rootDir, "node_modules/@radix-ui/react-popover"),
      "@radix-ui/react-scroll-area": path.resolve(rootDir, "node_modules/@radix-ui/react-scroll-area"),
      "@radix-ui/react-slot": path.resolve(rootDir, "node_modules/@radix-ui/react-slot"),
      "@radix-ui/react-tooltip": path.resolve(rootDir, "node_modules/@radix-ui/react-tooltip"),
      "@radix-ui/react-use-callback-ref": path.resolve(rootDir, "node_modules/@radix-ui/react-use-callback-ref"),
      "@radix-ui/react-use-layout-effect": path.resolve(rootDir, "node_modules/@radix-ui/react-use-layout-effect"),
      "aurorra-index": fileURLToPath(new URL("../aurorra_index/src/public-api.ts", import.meta.url)),
      "aurorra-ui": fileURLToPath(new URL("../aurorra_ui/src/public-api.ts", import.meta.url))
    },
    dedupe: ["react", "react-dom", "@radix-ui/react-checkbox", "@radix-ui/react-collapsible", "@radix-ui/react-context", "@radix-ui/react-popover", "@radix-ui/react-scroll-area", "@radix-ui/react-tooltip"],
    preserveSymlinks: true
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "test/**/*.vitest.{test,spec}.{ts,tsx}"],
    exclude: ["test/**/*.visual.spec.ts", "node_modules", "dist"]
  }
});
