import React from "react";

// SVGX is our slang for "messing around with SVG represented as
// React elements, generally provided by an author as JSX".

export type Svgx = React.ReactElement<React.SVGProps<SVGElement>>;

/**
 * Determines if we should recurse into an element's children when
 * walking the tree. Returns false for stuff that shouldn't get
 * processed or layered.
 */
export function shouldRecurseIntoChildren(element: Svgx): boolean {
  return element.type !== "foreignObject" && element.type !== "defs";
}

/**
 * A helpful utility to map over an element's children and/or update
 * its props. Not inherently recursive – feel free to recurse in
 * childFn.
 */
export function updateElement(
  element: Svgx,
  childFn?: (el: Svgx, idx: number) => Svgx | null,
  newProps?: React.SVGProps<SVGElement>,
): Svgx {
  const { children } = element.props;

  if (childFn && children && shouldRecurseIntoChildren(element)) {
    const childrenArray = React.Children.toArray(children);
    let someChildChanged = false;
    const newChildren = childrenArray.map((child, index) => {
      if (React.isValidElement(child)) {
        const updated = childFn(child as Svgx, index);
        if (updated !== child) someChildChanged = true;
        return updated;
      } else {
        // Preserve non-element children (like text nodes)
        return child;
      }
    });
    if (someChildChanged) {
      newProps = { ...newProps, children: newChildren };
    }
  }

  return newProps ? React.cloneElement(element, newProps) : element;
}

export function findElement(
  element: Svgx,
  predicate: (el: Svgx) => boolean,
): Svgx | null {
  if (predicate(element)) {
    return element;
  }

  if (shouldRecurseIntoChildren(element)) {
    const children = React.Children.toArray(element.props.children);
    for (const child of children) {
      if (React.isValidElement(child)) {
        const found = findElement(child as Svgx, predicate);
        if (found) return found;
      }
    }
  }

  return null;
}

export function updatePropsDownTree(
  element: Svgx,
  mapFn: (el: Svgx) => React.SVGProps<SVGElement> | undefined,
): Svgx {
  return updateElement(
    element,
    (child) => updatePropsDownTree(child, mapFn),
    mapFn(element),
  );
}
