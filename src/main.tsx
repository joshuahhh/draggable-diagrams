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
