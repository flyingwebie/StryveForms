import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
// biome-ignore lint/correctness/noUndeclaredDependencies: vite-plus is a root workspace tool
import { defineConfig } from "vite-plus";

export default defineConfig({
	server: {
		// 3001 is often taken by other dev tools; override with PORT.
		port: Number(process.env.PORT) || 3002,
		// Fail instead of moving to the next free port: sign-in only works on
		// the URL in BETTER_AUTH_URL. `bun run dev` frees the port first.
		strictPort: true,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		varlockVitePlugin({ ssrInjectMode: "auto-load" }),
		tailwindcss(),
		tanstackStart(),
		nitro({ preset: "bun" }),
		viteReact(),
	],
});
