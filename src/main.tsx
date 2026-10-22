import "./stand.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { Stand } from "./stand"

const container = document.querySelector("#root")

if (!container) {
	throw new Error("The stand page has no #root element")
}

ReactDOM.createRoot(container).render(
	<React.StrictMode>
		<Stand />
	</React.StrictMode>,
)
