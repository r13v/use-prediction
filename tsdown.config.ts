import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		index: "lib/use-prediction.ts",
	},
	format: ["esm", "cjs"],
	platform: "neutral",
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	clean: true,
	deps: {
		neverBundle: true,
		dts: {
			neverBundle: true,
		},
	},
	tsconfig: "tsconfig.build.json",
})
