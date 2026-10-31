import "./site.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { Demo } from "./demo"

const COPIED_MS = 1500

const container = document.querySelector("#demo")

if (!container) {
	throw new Error("The site page has no #demo element")
}

ReactDOM.createRoot(container).render(
	<React.StrictMode>
		<Demo />
	</React.StrictMode>,
)

for (const button of document.querySelectorAll<HTMLElement>("[data-copy]")) {
	button.addEventListener("click", () => {
		void navigator.clipboard.writeText(button.dataset.copy ?? "").then(() => {
			button.dataset.copied = ""
			setTimeout(() => delete button.dataset.copied, COPIED_MS)
		})
	})
}
