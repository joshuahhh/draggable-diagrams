import * as Babel from "@babel/standalone";
import Editor, { type Monaco } from "@monaco-editor/react";
import { produce } from "immer";
import _ from "lodash";
import type { editor } from "monaco-editor";
import * as parserEstree from "prettier/plugins/estree";
import parserTypescript from "prettier/plugins/typescript";
import prettier from "prettier/standalone";
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDemoSettings } from "../demo/ui";
import { Draggable } from "../draggable";
import { DraggableRenderer } from "../DraggableRenderer";
import { lessThan } from "../DragSpec";
import { ErrorBoundary } from "../ErrorBoundary";
import { normalizeIndent } from "../normalizeIndent";
import { path, rotateDeg, rotateRad, scale, translate } from "../svgx/helpers";
// These use the custom `dts:` / `dts-bundle:` Vite plugins to inline .d.ts files at build time
// @ts-expect-error virtual dts-bundle: import
import libTypesDts from "dts-bundle:src/docs/live-editor-imports.ts";
// @ts-expect-error virtual dts: import
import reactTypesDts from "dts:@types/react/index.d.ts";
// @ts-expect-error virtual dts: import
import reactGlobalDts from "dts:@types/react/global.d.ts";
// @ts-expect-error virtual dts: import
import cssTypeDts from "dts:csstype/index.d.ts";

// Globals available in LiveEditor code
const GLOBALS = {
  _,
  produce,
  translate,
  rotateDeg,
  rotateRad,
  scale,
  path,
  lessThan,
} as const;

/**
 * Convert the module .d.ts from dts-bundle-generator into ambient
 * declarations suitable for addExtraLib (no imports/exports).
 */
function toAmbient(moduleDts: string): string {
  return moduleDts
    .replace(/^import .*;\n?/gm, "")
    .replace(/^export \{\};\n?/gm, "")
    .replace(/^export declare /gm, "declare ")
    .replace(/^export type /gm, "declare type ")
    .replace(/^export interface /gm, "declare interface ")
    .replace(/^export class /gm, "declare class ")
    .replace(/^export function /gm, "declare function ")
    .replace(/^export const /gm, "declare const ")
    .replace(/React\$1/g, "React");
}

// Configure Monaco's TypeScript defaults once
let monacoConfigured = false;
function configureMonaco(monaco: Monaco) {
  if (monacoConfigured) return;
  monacoConfigured = true;

  const tsDefaults = monaco.languages.typescript.typescriptDefaults;

  tsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    // Treat every file as a module so type declarations in one
    // LiveEditor don't leak into others (e.g. duplicate `type State`)
    moduleDetection: 3, // ts.ModuleDetectionKind.Force
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: "createElement",
    strict: true,
    noEmit: true,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  } as any);

  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticsOptions: { noSemanticValidation: false },
  });

  // Auto-generated library types (converted from module to ambient)
  tsDefaults.addExtraLib(toAmbient(libTypesDts), "draggable-lib.d.ts");

  // Real React + csstype types so JSX elements have proper types
  tsDefaults.addExtraLib(cssTypeDts, "file:///node_modules/csstype/index.d.ts");
  tsDefaults.addExtraLib(
    reactGlobalDts,
    "file:///node_modules/@types/react/global.d.ts",
  );
  tsDefaults.addExtraLib(
    reactTypesDts,
    "file:///node_modules/@types/react/index.d.ts",
  );
  // Global declarations: JSX bridge, createElement, lodash, immer,
  // and custom SVG attributes (module augmentation from jsx.d.ts
  // isn't emitted by dts-bundle-generator)
  tsDefaults.addExtraLib(
    `
    declare function createElement(...args: any[]): any;
    declare namespace JSX {
      type ElementType = React.JSX.ElementType;
      interface Element extends React.JSX.Element {}
      interface ElementClass extends React.JSX.ElementClass {}
      interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
      interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
      type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
      interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
      interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
      interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    }
    declare namespace React {
      interface SVGAttributes<T> {
        "data-on-drag"?: ((params: DragParams) => DragSpec<any>) | false | null | undefined | 0 | "";
        "data-z-index"?: number;
        "data-transition"?: boolean;
      }
    }
    declare const _: {
      range(end: number): number[];
      range(start: number, end: number, step?: number): number[];
      clamp(number: number, lower: number, upper: number): number;
      clamp(number: number, upper: number): number;
      sortBy<T>(collection: T[], iteratee: (value: T) => unknown): T[];
      flatten<T>(array: T[][]): T[];
      chunk<T>(array: T[], size: number): T[][];
      zip<A, B>(a: A[], b: B[]): [A | undefined, B | undefined][];
      sum(values: number[]): number;
      min(values: number[]): number | undefined;
      max(values: number[]): number | undefined;
      uniq<T>(array: T[]): T[];
      groupBy<T>(collection: T[], iteratee: (value: T) => string): Record<string, T[]>;
      mapValues<T, R>(obj: Record<string, T>, fn: (value: T) => R): Record<string, R>;
      [key: string]: (...args: any[]) => any;
    };
    declare function produce<T>(base: T, recipe: (draft: T) => void): T;
    `,
    "globals.d.ts",
  );
}

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
  const modelUriRef = useRef<string | null>(null);
  const [editorHeight, setEditorHeight] = useState<number>(minHeight);

  const handleEditorMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor) => {
      const updateHeight = () => {
        const contentHeight = editorInstance.getContentHeight();
        setEditorHeight(Math.max(contentHeight, minHeight));
        editorInstance.layout();
      };
      editorInstance.onDidContentSizeChange(updateHeight);
      updateHeight();
    },
    [minHeight],
  );

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

      // Strip `export` keywords — user code uses them for TypeScript
      // (avoids "unused variable" fading) but new Function doesn't allow them
      const stripped = transformed!.replace(/^export /gm, "");

      // Create a function that returns { draggable, initialState }
      const fn = new Function(
        "createElement", // needed for JSX
        ...Object.keys(GLOBALS),
        `
        ${stripped}
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

  // Give each LiveEditor instance a unique model URI so Monaco
  // doesn't complain about duplicate models
  const modelUri = useMemo(() => {
    if (!modelUriRef.current) {
      modelUriRef.current = `file:///editor-${Math.random().toString(36).slice(2)}.tsx`;
    }
    return modelUriRef.current;
  }, []);

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
            <Editor
              height={`${editorHeight}px`}
              defaultLanguage="typescript"
              defaultValue={code}
              path={modelUri}
              onChange={(value) => setCode(value ?? "")}
              beforeMount={configureMonaco}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                fontSize: 13,
                tabSize: 2,
                automaticLayout: true,
                renderLineHighlight: "none",
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                scrollbar: {
                  vertical: "hidden",
                  horizontal: "auto",
                  alwaysConsumeMouseWheel: false,
                },
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
