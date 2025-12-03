import { Children, cloneElement, isValidElement, ReactNode } from "react";
import { Svgx } from ".";
import { assert, emptyToUndefined } from "../utils";

export type HoistedSvgx = Map<string, Svgx>;

const accumulatedTransformProp = "data-accumulated-transform";

/**
 * Determines if we should recurse into an element's children when walking the tree.
 * Returns false for foreignObject to avoid processing non-SVG content inside it.
 * It's still fine to read the foreignObject element's props (like transform).
 */
export function shouldRecurseIntoChildren(element: Svgx): boolean {
  return element.type !== "foreignObject";
}

/**
 * Step 1: Walks the SVG tree and adds data-accumulated-transform to all elements.
 * Accumulates transform attributes from parent <g> nodes.
 */
export function accumulateTransforms(element: Svgx): Svgx {
  return walkAndAccumulateTransforms(element, "");
}

function walkAndAccumulateTransforms(
  element: Svgx,
  accumulatedTransform: string
): Svgx {
  const props = element.props as any;
  const elementTransform = props.transform || "";
  const newAccumulatedTransform = combineTransforms(
    accumulatedTransform,
    elementTransform
  );

  // Process children recursively (skip foreignObject children)
  const children = Children.toArray(props.children);
  const newChildren: ReactNode[] = [];

  if (shouldRecurseIntoChildren(element)) {
    for (const child of children) {
      if (isValidElement(child)) {
        const processedChild = walkAndAccumulateTransforms(
          child as Svgx,
          newAccumulatedTransform
        );
        newChildren.push(processedChild);
      } else {
        // Preserve non-element children (like text nodes)
        newChildren.push(child);
      }
    }
  } else {
    // For foreignObject, preserve children as-is
    newChildren.push(...children);
  }

  // Clone element with data-accumulated-transform and new children
  return cloneElement(element, {
    children: emptyToUndefined(newChildren),
    [accumulatedTransformProp as any]: newAccumulatedTransform || undefined,
  });
}

/**
 * Step 2: Partially flattens an SVG tree by pulling nodes with IDs
 * to the top level. Reads data-accumulated-transform and sets it as
 * transform for extracted nodes. Returns a map of elements keyed by
 * their id.
 * - Key "" contains the root with extracted nodes removed (or null
 *   if root has an ID)
 * - Extracted nodes are removed from their parents
 * - Recurses into nodes with IDs to find deeper IDs
 */
export function hoistSvg(element: Svgx): HoistedSvgx {
  const result: HoistedSvgx = new Map();
  const rootWithExtractedRemoved = extractIdNodes(element, result);

  // If the root element has an ID, it was extracted, so "" should be null
  const props = element.props as any;
  if (!props.id) {
    result.set("", rootWithExtractedRemoved);
  }

  return result;
}

/**
 * Recursively extracts nodes with IDs into hoistedSvg map. Returns
 * the element with extracted children removed.
 */
function extractIdNodes(element: Svgx, hoistedSvg: HoistedSvgx): Svgx {
  const props = element.props as any;

  // Validate: data-z-index can only be set on nodes with ids
  if (props["data-z-index"] !== undefined && !props.id) {
    throw new Error(
      `data-z-index can only be set on elements with an id attribute. Found data-z-index="${props["data-z-index"]}" on <${element.type}> without id.`
    );
  }

  // Process children first, recursively (skip foreignObject children)
  const children = Children.toArray(props.children);

  const newChildren: ReactNode[] = [];

  if (shouldRecurseIntoChildren(element)) {
    for (const child of children) {
      if (isValidElement(child)) {
        const processedChild = extractIdNodes(child as Svgx, hoistedSvg);

        // Only keep the child if it doesn't have an ID (wasn't extracted)
        if (!(child.props as any).id) {
          newChildren.push(processedChild);
        }
      } else {
        // Preserve non-element children (like text nodes)
        newChildren.push(child);
      }
    }
  } else {
    // For foreignObject, preserve children as-is
    newChildren.push(...children);
  }

  // If this element has an ID, extract it and set transform from data-accumulated-transform
  if (props.id) {
    // Check for duplicate IDs
    assert(
      !hoistedSvg.has(props.id),
      `Duplicate id "${props.id}" found in SVG tree. Each element must have a unique id.`
    );

    const accumulatedTransform = props[accumulatedTransformProp];
    const elementToHoist = cloneElement(element, {
      children: emptyToUndefined(newChildren),
      transform: accumulatedTransform || undefined,
    });

    hoistedSvg.set(props.id, elementToHoist);
  }

  return cloneElement(element, { children: newChildren });
}

export function getAccumulatedTransform(element: Svgx): string | undefined {
  const props = element.props as any;
  return props[accumulatedTransformProp];
}

function combineTransforms(t1: string, t2: string): string {
  if (!t1 && !t2) return "";
  if (!t1) return t2;
  if (!t2) return t1;
  return t1 + " " + t2;
}
