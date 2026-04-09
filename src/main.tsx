import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, useLocation } from "react-router-dom";
import { autoRoute } from "./autoRoute";
import { DemoPage } from "./demo/DemoPage";
import { SingleDemoPage } from "./demo/SingleDemoPage";
import "./index.css";
import { FiguresPage } from "./figures/FiguresPage";
import { NaturalNeighborTestPage } from "./NaturalNeighborTestPage";
import { StudioPage } from "./studio/StudioPage";
import { SingleStudyPage } from "./study/SingleStudyPage";
import { StudyPage } from "./study/StudyPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <ScrollToTop />
      {typeof __VITE_REACT_PROD__ !== "undefined" && (
        <div
          style={{
            position: "fixed",
            top: 4,
            left: 4,
            zIndex: 9999,
            background: "red",
            color: "white",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            pointerEvents: "none",
            opacity: 0.8,
          }}
        >
          REACT PROD
        </div>
      )}
      <Routes>
        {autoRoute("/", FiguresPage)}
        {autoRoute("/study", StudyPage)}
        {autoRoute("/study/:id", SingleStudyPage)}
        {autoRoute("/demos", DemoPage)}
        {autoRoute("/demos/:id", SingleDemoPage)}
        {autoRoute("/natural-neighbor", NaturalNeighborTestPage)}
        {autoRoute("/studio", StudioPage)}
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
