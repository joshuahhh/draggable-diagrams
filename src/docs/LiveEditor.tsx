import * as Babel from "@babel/standalone";
import { javascript } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";
import { produce } from "immer";
import _ from "lodash";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import { createElement, useMemo, useState } from "react";
import * as DragSpecModule from "../DragSpec";
import { ErrorBoundary } from "../ErrorBoundary";
import * as ManipulableModule from "../manipulable";
import { Manipulable, ManipulableDrawer } from "../manipulable";
import { normalizeIndent } from "../normalizeIndent";
import { numberScrubber } from "./numberScrubber";

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
  const [code, setCode] = useState(() => {
    const normalized = normalizeIndent`${initialCode}`;
    try {
      return prettier.format(normalized, {
        parser: "babel",
        plugins: [parserBabel],
        printWidth: 60,
      });
    } catch {
      return normalized;
    }
  });
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
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

      // Create a function that returns { manipulable, initialState }
      const fn = new Function(
        "createElement",
        "DragSpec",
        "Manipulable",
        "_",
        "produce",
        `
        const { numsAtPaths, straightTo, span, numAtPath } = DragSpec;
        const { translate, rotateDeg, scale } = Manipulable;
        ${transformed}
        return { manipulable, initialState };
        `
      );

      // Execute with dependencies
      const { manipulable, initialState } = fn(
        createElement,
        DragSpecModule,
        ManipulableModule,
        _,
        produce
      );

      setError(null);
      return { manipulable, initialState };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      return null;
    }
  }, [code, secretCode]);

  const [debugMode, setDebugMode] = useState(false);

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
              <label className="absolute top-2 right-2 text-xs text-gray-600 flex items-center gap-1 cursor-pointer z-20">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                />
                <span>Debug mode</span>
              </label>
              {error ? (
                <div className="p-4 m-4 text-red-700 text-sm border border-red-300 bg-red-50 rounded">
                  <div className="font-semibold mb-1">Error:</div>
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {error}
                  </pre>
                </div>
              ) : result ? (
                <ErrorBoundary resetOnChange={code}>
                  <ManipulableDrawer
                    manipulable={result.manipulable as Manipulable<any>}
                    initialState={result.initialState}
                    drawerConfig={{
                      snapRadius: 10,
                      chainDrags: true,
                      relativePointerMotion: false,
                      animationDuration: 300,
                    }}
                    height={height ?? minHeight}
                    debugMode={debugMode}
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
