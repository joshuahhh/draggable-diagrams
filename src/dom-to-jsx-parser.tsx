/**
 * Alternative DOM-to-JSX conversion using html-react-parser library
 */

import parse from "html-react-parser";
import React from "react";
import { calculateViewBoxTransform } from "./dom-to-jsx";
import { Svgx } from "./svgx";
import { assert } from "./utils";

/**
 * Extracts the contents of the SVG element from a container div and converts children to JSX
 * using html-react-parser library. Returns a <g> element with a transform that accounts
 * for the original SVG's viewBox.
 */
export function extractSvgContentsAsJsxWithParser(
  container: HTMLElement,
): Svgx {
  const svg = container.querySelector("svg");
  assert(!!svg, "No SVG element found in container");

  // Calculate transform to simulate viewBox effect
  const transform = calculateViewBoxTransform(svg);

  // Get the innerHTML of the SVG
  const svgContent = svg.innerHTML;

  // Parse with html-react-parser, which handles all the attribute conversions automatically
  const parsed = parse(svgContent);

  // Wrap in a <g> with transform
  return React.createElement("g", transform ? { transform } : {}, parsed);
}

/**
 * Alternative: Extract the entire SVG element (including the <svg> tag)
 */
export function extractSvgAsJsxWithParser(
  container: HTMLElement,
): React.ReactElement {
  const svg = container.querySelector("svg");
  assert(!!svg, "No SVG element found in container");

  // Get the outerHTML to include the SVG tag itself
  const svgHtml = svg.outerHTML;

  // Parse with html-react-parser
  return parse(svgHtml) as React.ReactElement;
}
