import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";

// Get git commit hash at build time
function getGitCommitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch (error) {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [".."],
    },
  },
  define: {
    __BUILD_COMMIT__: JSON.stringify(getGitCommitHash()),
  },
});
