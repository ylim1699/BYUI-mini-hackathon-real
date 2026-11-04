/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local dev: the FastAPI backend runs on :8000 (uvicorn main:app --reload --port 8000).
// On Vercel, /api is routed to the backend service by vercel.json.
export default defineConfig({
  plugins: [react()],
  envDir: "..",
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
  test: { environment: "node" },
});
