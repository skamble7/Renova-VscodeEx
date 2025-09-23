import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { vscode } from "./lib/vscode";

vscode.postMessage({ type: "hello", payload: { from: "Renova React app started" } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
