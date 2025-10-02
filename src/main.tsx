import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import "./styles/animations.css"
import App from "./App.tsx"
import AuthProvider from "./contexts/AuthContext.tsx"

import { BrowserRouter as Router } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const client = new QueryClient()

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Router>
          <App />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
