import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { marked } from "marked"
import { defineConfig, type Plugin } from "vite"

// The GitHub Pages site: the live demo and README.md, rendered at build time
// so that README.md stays the single owner of the documentation.
const SITE_URL = "https://r13v.github.io/use-prediction/"
const REPOSITORY_FILES = "https://github.com/r13v/use-prediction/blob/main/"
const README = fileURLToPath(new URL("../README.md", import.meta.url))

const renderReadme = async () => {
	const markdown = await readFile(README, "utf8")
	const html = await marked.parse(markdown, {
		walkTokens(token) {
			if (token.type !== "link") return

			if (token.href === SITE_URL) {
				token.href = "#demo"
			} else if (!/^[a-z]+:|^#/.test(token.href)) {
				token.href = REPOSITORY_FILES + token.href
			}
		},
	})

	// The demo goes after the pitch, before the first section.
	const firstSection = html.indexOf("<h2")

	return `${html.slice(0, firstSection)}<div id="demo"></div>${html.slice(firstSection)}`
}

const readme = (): Plugin => ({
	name: "readme",
	transformIndexHtml: async (html) =>
		html.replace("<!-- readme -->", await renderReadme()),
	configureServer(server) {
		server.watcher.add(README)
		server.watcher.on("change", (file) => {
			if (file === README) server.ws.send({ type: "full-reload" })
		})
	},
})

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	base: "/use-prediction/",
	plugins: [react(), readme()],
	cacheDir: "../node_modules/.vite-site",
})
