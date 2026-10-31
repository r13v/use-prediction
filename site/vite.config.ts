import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { Marked, type Token, type Tokens } from "marked"
import { createHighlighter } from "shiki"
import { defineConfig, type Plugin } from "vite"

import packageJson from "../package.json"

// The GitHub Pages site. README.md stays the single owner of the text: the
// hero, the feature cards and the docs are cut from it at build time.
const SITE_URL = "https://r13v.github.io/use-prediction/"
const REPOSITORY_FILES = "https://github.com/r13v/use-prediction/blob/main/"
const README = fileURLToPath(new URL("../README.md", import.meta.url))

const highlighter = await createHighlighter({
	themes: ["github-light", "github-dark"],
	langs: ["tsx", "ts", "bash", "css"],
})

const slug = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "")

const markdown = new Marked({
	async: false,
	walkTokens: (token) => rewriteLink(token),
	renderer: {
		code: ({ text, lang }) =>
			highlighter.codeToHtml(text, {
				lang: lang ?? "text",
				themes: { light: "github-light", dark: "github-dark" },
				// Only CSS variables, so that site.css picks the theme.
				defaultColor: false,
			}),
		heading({ tokens, depth, text }) {
			return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>`
		},
	},
})

const rewriteLink = (token: Token) => {
	if (token.type !== "link") return

	if (token.href === SITE_URL) {
		token.href = "#demo"
	} else if (!/^[a-z]+:|^#/.test(token.href)) {
		token.href = REPOSITORY_FILES + token.href
	}
}

const isSection = (token: Token) =>
	token.type === "heading" && token.depth === 2

const inline = (text: string) =>
	markdown.parseInline(text.replace(/\n/g, " "), { async: false })

/** The pitch before the first section becomes the hero and the feature cards. */
const renderReadme = async () => {
	const source = await readFile(README, "utf8")
	const firstSection = source.indexOf("\n## ")
	const pitch = markdown.lexer(source.slice(0, firstSection))
	const docs = source.slice(firstSection)

	const lead = pitch.find(
		(token): token is Tokens.Paragraph => token.type === "paragraph",
	)
	const [headline, ...subline] = inline(lead?.text ?? "").split(/(?<=\.)\s+/)
	const list = pitch.find(
		(token): token is Tokens.List => token.type === "list",
	)
	const features = (list?.items ?? []).map((item) => {
		const [, title, text] =
			/^<strong>(.*?)\.?<\/strong>\s*(.*)$/s.exec(inline(item.text)) ?? []

		return `<li><h3>${title}</h3><p>${text}</p></li>`
	})
	const toc = markdown
		.lexer(docs)
		.filter((token): token is Tokens.Heading => isSection(token))
		.map((token) => `<li><a href="#${slug(token.text)}">${token.text}</a></li>`)

	return {
		headline,
		subline: subline.join(" "),
		features: features.join(""),
		toc: toc.join(""),
		docs: markdown.parse(docs, { async: false }),
		version: packageJson.version,
	}
}

const readme = (): Plugin => ({
	name: "readme",
	async transformIndexHtml(html) {
		const parts = await renderReadme()

		return html.replace(
			/\{\{(\w+)\}\}/g,
			(_, name: keyof typeof parts) => parts[name],
		)
	},
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
