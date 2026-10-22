import "./stand.css"

import React from "react"
import ReactDOM from "react-dom/client"

import { Stand } from "./stand"

ReactDOM.createRoot(document.querySelector("#root")!).render(
	<React.StrictMode>
		<Stand />
	</React.StrictMode>,
)
