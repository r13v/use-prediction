import React from "react"
import ReactDOM from "react-dom/client"

import { Example } from "./example"

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <Example />
  </React.StrictMode>,
)
