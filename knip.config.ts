import type { KnipConfig } from "knip"

export default {
	// Knip finds the other entries in package.json and the tool configs.
	entry: [
		"index.html",
		// An example for readers to copy: all its exports are its API.
		"examples/server.ts",
	],
	project: ["{lib,src,examples,bench,e2e,scripts}/**/*.{ts,tsx,mjs}"],
} satisfies KnipConfig
