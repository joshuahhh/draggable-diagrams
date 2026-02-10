import {
  Background,
  Circle,
  Ref,
  render,
  StackH,
  StackV,
  Text,
} from "bluefish-js";
import { useEffect, useState } from "react";
import { extractSvgContentsAsJsx } from "./dom-to-jsx";
import { extractSvgContentsAsJsxWithParser } from "./dom-to-jsx-parser";

const bluefishDiagram = () => [
  Background(
    { padding: 40, fill: "#859fc9", stroke: "none" },
    StackH({ spacing: 50 }, [
      Circle({
        name: "mercury",
        r: 15,
        fill: "#EBE3CF",
        "stroke-width": 3,
        stroke: "black",
      }),
      Circle({ r: 36, fill: "#DC933C", "stroke-width": 3, stroke: "black" }),
      Circle({
        r: 38,
        fill: "#179DD7",
        "stroke-width": 3,
        stroke: "black",
        id: "earth",
      }),
      Circle({ r: 21, fill: "#F1CF8E", "stroke-width": 3, stroke: "black" }),
    ]),
  ),
  Background(
    { rx: 10 },
    StackV({ spacing: 30 }, [Text("Mercury"), Ref({ select: "mercury" })]),
  ),
];

export function BluefishDemo() {
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const [jsxContents, setJsxContents] = useState<React.ReactElement | null>(
    null,
  );
  const [jsxContentsParser, setJsxContentsParser] =
    useState<React.ReactElement | null>(null);

  useEffect(() => {
    if (!div) return;
    render(bluefishDiagram, div);

    // Extract the SVG contents as JSX after rendering (custom approach)
    const jsx = extractSvgContentsAsJsx(div);
    setJsxContents(jsx);
    console.log("Custom DOM-to-JSX:", jsx);

    // Extract using html-react-parser
    const jsxParser = extractSvgContentsAsJsxWithParser(div);
    setJsxContentsParser(jsxParser);
    console.log("html-react-parser:", jsxParser);
  }, [div]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Bluefish (Original DOM)</h2>
      <div ref={setDiv} />

      {jsxContents && (
        <>
          <h2>Converted JSX (Custom)</h2>
          <svg width="600" height="200">
            {jsxContents}
          </svg>
        </>
      )}

      {jsxContentsParser && (
        <>
          <h2>Converted JSX (html-react-parser)</h2>
          <svg width="600" height="200">
            {jsxContentsParser}
          </svg>
        </>
      )}
    </div>
  );
}
