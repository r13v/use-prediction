import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

import { handlePrediction } from "./examples/server"

// Dev server for the stand only; the library is built with tsdown.
// REACT_VERSION=19 runs the stand on the React 19 copy in test/react-19.
const react19 = (name: string) =>
	fileURLToPath(new URL(`test/react-19/node_modules/${name}`, import.meta.url))

const predictionApi = (): Plugin => ({
	name: "prediction-api",
	configureServer(server) {
		server.middlewares.use("/api/predict", (req, res) => {
			void handlePrediction(req, res)
		})
	},
})

export default defineConfig(({ mode }) => {
	for (const [key, value] of Object.entries(
		loadEnv(mode, process.cwd(), "LLM_"),
	)) {
		process.env[key] ??= value
	}

	const useReact19 = process.env.REACT_VERSION === "19"
	const react19Aliases = [
		{ find: /^react$/, replacement: react19("react") },
		{ find: /^react\/(.*)$/, replacement: `${react19("react")}/$1` },
		{ find: /^react-dom$/, replacement: react19("react-dom") },
		{ find: /^react-dom\/(.*)$/, replacement: `${react19("react-dom")}/$1` },
	]

	return {
		plugins: [react(), predictionApi()],
		resolve: useReact19 ? { alias: react19Aliases } : undefined,
		// Each React version keeps its own pre-bundled dependencies.
		cacheDir: `node_modules/.vite-react-${process.env.REACT_VERSION ?? "18"}`,
	}
})
