import React, { Children, cloneElement, isValidElement } from "react";
import { Svgx } from ".";
import { emptyToUndefined } from "../utils";
import { shouldRecurseIntoChildren } from "./hoist";

const pathPropName = "data-path";

export function getPath(element: React.ReactElement): string | undefined {
  const props = element.props as any;
  return props[pathPropName];
}

/**
 * Walks a JSX tree and assigns paths to every element using data-path.
 * - Root gets "/"
 * - By default uses numerical indices for children (0, 1, 2, ...)
 * - If id is present, uses that as the absolute path
 * - Paths are stored as strings in data-path
 */
export function assignPaths(element: Svgx): Svgx {
  return assignPathsRecursive(element, "/");
}

function assignPathsRecursive(element: Svgx, currentPath: string): Svgx {
  // Check if this element has an id
  const props = element.props as any;
  const id = props.id;

  // Validate that id doesn't contain slashes
  if (id && id.includes("/")) {
    throw new Error(
      `Element id "${id}" contains a slash, which is not allowed. IDs are used as absolute paths and cannot contain slashes.`
    );
  }

  const elementPath: string = id ? id + "/" : currentPath;

  // Just to be helpful, warn against using keys
  if (typeof element.key === "string" && !element.key.startsWith(".")) {
    throw new Error(
      `Element with path "${elementPath}" has a key prop (${element.key}), which is not allowed.`
    );
  }

  // Process children (skip foreignObject children)
  const children = React.Children.toArray(props.children) as Svgx[];
  const newChildren = shouldRecurseIntoChildren(element)
    ? children.map((child, index) =>
        React.isValidElement(child)
          ? assignPathsRecursive(child, elementPath + String(index) + "/")
          : child
      )
    : children;

  return cloneElement(element, {
    [pathPropName as any]: elementPath,
    children: emptyToUndefined(newChildren),
  });
}

// TODO: actually follow paths rather than searching the whole tree
export function findByPath(path: string, node: Svgx): Svgx | null {
  const props = node.props as any;
  if (props[pathPropName] === path) {
    return node;
  }

  // Don't recurse into foreignObject children
  if (!shouldRecurseIntoChildren(node)) {
    return null;
  }

  for (const child of Children.toArray(props.children) as Svgx[]) {
    if (isValidElement(child)) {
      const found = findByPath(path, child);
      if (found) return found;
    }
  }

  return null;
}
