import React, { Children, cloneElement, isValidElement } from "react";
import { SvgElem } from "./jsx-flatten";

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
export function assignPaths(element: SvgElem): SvgElem {
  return assignPathsRecursive(element, "/");
}

function assignPathsRecursive(element: SvgElem, currentPath: string): SvgElem {
  // Check if this element has an id
  const props = element.props as any;
  const id = props.id;
  const elementPath: string = id ? id + "/" : currentPath;

  // Process children
  const children = React.Children.toArray(props.children) as SvgElem[];
  const newChildren = children.map((child, index) => {
    if (React.isValidElement(child)) {
      const childPath = elementPath + String(index) + "/";
      return assignPathsRecursive(child, childPath);
    }
    return child;
  });

  return cloneElement(element, {
    [pathPropName as any]: elementPath,
    children: newChildren,
  });
}

// TODO: actually follow paths rather than searching the whole tree
export function findByPath(path: string, node: SvgElem): SvgElem | null {
  const props = node.props as any;
  if (props[pathPropName] === path) {
    return node;
  }

  for (const child of Children.toArray(props.children) as SvgElem[]) {
    if (isValidElement(child)) {
      const found = findByPath(path, child);
      if (found) return found;
    }
  }

  return null;
}
