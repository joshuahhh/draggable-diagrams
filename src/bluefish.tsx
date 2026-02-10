import { Child, render } from "bluefish-js";
import React, { ReactNode, SVGAttributes } from "react";
import { extractSvgContentsAsJsxWithParser } from "./dom-to-jsx-parser";
import { Svgx } from "./svgx";

function applyAttributesById(
  element: ReactNode,
  attribsById: Record<string, SVGAttributes<SVGElement>>,
  foundIds: Set<string>,
): ReactNode {
  if (!React.isValidElement(element)) {
    return element;
  }

  const props = element.props as { id?: string; children?: ReactNode };
  let newProps = props;

  if (props.children) {
    const childrenArray = React.Children.toArray(props.children);
    let someChildChanged = false;
    const newChildren = childrenArray.map((child) => {
      const updated = applyAttributesById(child, attribsById, foundIds);
      if (updated !== child) someChildChanged = true;
      return updated;
    });
    if (someChildChanged) {
      newProps = { ...newProps, children: newChildren };
    }
  }

  if (props.id && props.id in attribsById) {
    foundIds.add(props.id);
    newProps = {
      ...newProps,
      ...attribsById[props.id],
    };
  }

  return newProps === props ? element : React.cloneElement(element, newProps);
}

export function bluefish(
  spec: Child | Child[],
  attribsById?: Record<string, SVGAttributes<SVGElement>>,
): Svgx {
  const container = document.createElement("div");
  render(() => spec, container);
  let jsx = extractSvgContentsAsJsxWithParser(container);

  if (attribsById) {
    const foundIds = new Set<string>();
    jsx = applyAttributesById(jsx, attribsById, foundIds) as Svgx;
    const missingIds = Object.keys(attribsById).filter(
      (id) => !foundIds.has(id),
    );
    if (missingIds.length > 0) {
      throw new Error(
        `Missing elements with ids: ${missingIds.join(", ")}. ` +
          `These ids were specified in attribsById but not found in the Bluefish diagram.`,
      );
    }
  }

  return jsx;
}

export function bluefishWithAttach(
  specFunc: (
    attach: (id: string, attribs?: SVGAttributes<SVGElement>) => string,
  ) => Child | Child[],
): Svgx {
  const attribsById: Record<string, SVGAttributes<SVGElement>> = {};
  const spec = specFunc((id, attribs) => {
    attribsById[id] = attribs || {};
    return id;
  });
  return bluefish(spec, attribsById);
}
