import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes } from "react-router-dom";
import { autoRoute } from "./autoRoute";
import { DemoPage } from "./demo/DemoPage";
import { SingleDemoPage } from "./demo/SingleDemoPage";
import { DocsIndexPage } from "./DocsIndexPage";
import { DocsPage } from "./DocsPage";
import "./index.css";
import { IndexPage } from "./IndexPage";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        {autoRoute("/", IndexPage)}
        {autoRoute("/docs", DocsIndexPage)}
        {autoRoute("/docs/:slug", DocsPage)}
        {autoRoute("/demos", DemoPage)}
        {autoRoute("/demos/:id", SingleDemoPage)}
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
