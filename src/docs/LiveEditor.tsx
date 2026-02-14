import * as Babel from "@babel/standalone";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";
import { produce } from "immer";
import _ from "lodash";
import * as parserEstree from "prettier/plugins/estree";
import parserTypescript from "prettier/plugins/typescript";
import prettier from "prettier/standalone";
import { createElement, useEffect, useMemo, useState } from "react";
import { useDemoSettings } from "../demo/ui";
import { Draggable } from "../draggable";
import { DraggableRenderer } from "../DraggableRenderer";
import { ErrorBoundary } from "../ErrorBoundary";
import { normalizeIndent } from "../normalizeIndent";
import { path, rotateDeg, rotateRad, scale, translate } from "../svgx/helpers";
import { numberScrubber } from "./numberScrubber";

// Globals available in LiveEditor code
const GLOBALS = {
  _,
  produce,
  translate,
  rotateDeg,
  rotateRad,
  scale,
  path,
} as const;

interface LiveEditorProps {
  secretCode?: string;
  code: string;
  height?: number;
  minHeight?: number;
}

export function LiveEditor({
  secretCode = "",
  code: initialCode,
  height,
  minHeight = 200,
}: LiveEditorProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // initialize the code; in useEffect cuz prettier is async :(
    const normalized = normalizeIndent`${initialCode}`;
    prettier
      .format(normalized, {
        parser: "typescript",
        plugins: [parserTypescript, parserEstree],
        printWidth: 60,
      })
      .then(setCode)
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        throw err;
      });
  }, [initialCode]);

  const result = useMemo(() => {
    if (!code) return null;

    try {
      // Transform JSX to JavaScript using classic runtime
      const transformed = Babel.transform(secretCode + "\n" + code, {
        presets: [
          "typescript",
          [
            "react",
            {
              runtime: "classic",
              pragma: "createElement",
            },
          ],
        ],
        filename: "editor.tsx",
      }).code;

      // Create a function that returns { draggable, initialState }
      const fn = new Function(
        "createElement", // needed for JSX
        ...Object.keys(GLOBALS),
        `
        ${transformed}
        return { draggable, initialState };
        `,
      );

      // Execute with dependencies
      const { draggable, initialState } = fn(
        createElement,
        ...Object.values(GLOBALS),
      );

      setError(null);
      return { draggable, initialState };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      return null;
    }
  }, [code, secretCode]);

  const { showDebugOverlay } = useDemoSettings();

  if (code === null) return null;

  return (
    <div
      className="my-6"
      style={{
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
      }}
    >
      <div
        className="border border-gray-300 rounded-lg shadow-lg mx-auto"
        style={{
          maxWidth: "min(1200px, calc(100vw - 3rem))",
        }}
      >
        <div className="flex flex-col md:grid md:grid-cols-2 rounded-lg">
          {/* Preview (top on mobile, right on desktop) */}
          <div className="bg-white flex flex-col md:order-2 md:border-l border-gray-300">
            <div className="bg-blue-600 text-white text-xs font-semibold px-3 py-2">
              Preview
            </div>
            <div
              style={{
                minHeight: `${minHeight}px`,
                height: height ? `${height}px` : undefined,
              }}
              className="flex select-text items-start bg-white md:sticky md:top-0 relative"
            >
              {error ? (
                <div className="p-4 m-4 text-red-700 text-sm border border-red-300 bg-red-50 rounded">
                  <div className="font-semibold mb-1">Error:</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {error}
                  </pre>
                </div>
              ) : result ? (
                <ErrorBoundary resetOnChange={code}>
                  <DraggableRenderer
                    draggable={result.draggable as Draggable<any>}
                    initialState={result.initialState}
                    height={height ?? minHeight}
                    showDebugOverlay={showDebugOverlay}
                  />
                </ErrorBoundary>
              ) : null}
            </div>
          </div>

          {/* Code Editor (bottom on mobile, left on desktop) */}
          <div className="bg-gray-50 flex flex-col md:order-1 border-t md:border-t-0 border-gray-300">
            <div className="bg-gray-700 text-white text-xs font-semibold px-3 py-2">
              Code
            </div>
            <CodeMirror
              value={code}
              height={height ? `${height}px` : undefined}
              minHeight={`${minHeight}px`}
              extensions={[
                javascript({ jsx: true, typescript: true }),
                numberScrubber(),
              ]}
              onChange={(value) => setCode(value)}
              theme="light"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: false,
                highlightActiveLine: false,
                foldGutter: false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
