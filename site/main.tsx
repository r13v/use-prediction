import "./site.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { Demo } from "./demo"

const container = document.querySelector("#demo")

if (!container) {
	throw new Error("The site page has no #demo element")
}

ReactDOM.createRoot(container).render(
	<React.StrictMode>
		<Demo />
	</React.StrictMode>,
)
