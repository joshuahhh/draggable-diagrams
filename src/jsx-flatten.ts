import {
  Children,
  cloneElement,
  isValidElement,
  ReactElement,
  SVGProps,
} from "react";

export type SvgElem = ReactElement<SVGProps<SVGElement>>;
export type FlattenedSvg = Map<string, SvgElem>;

const accumulatedTransformProp = "data-accumulated-transform";

/**
 * Flattens an SVG tree by pulling nodes with IDs to the top level.
 * Accumulates transform attributes from parent <g> nodes.
 * Returns a map of elements keyed by their path (id).
 * - Key "" contains the root with extracted nodes removed
 * - Extracted nodes are removed from their parents
 * - Recurses into nodes with IDs to find deeper IDs
 */
export function flattenSvg(
  element: SvgElem,
  addAccumulatedTransforms: boolean = false,
): FlattenedSvg {
  const result: FlattenedSvg = new Map();
  const rootWithExtractedRemoved = collectFlatNodes(
    element,
    "",
    result,
    addAccumulatedTransforms,
  );
  result.set("", rootWithExtractedRemoved);
  return result;
}

/**
 * Recursively collects nodes with IDs into flatNodes map.
 * Returns the element with extracted children removed.
 */
function collectFlatNodes(
  element: SvgElem,
  accumulatedTransform: string,
  flatNodes: FlattenedSvg,
  addAccumulatedTransforms: boolean,
): SvgElem {
  const props = element.props as any;
  const elementTransform = props.transform || "";
  const newAccumulatedTransform = combineTransforms(
    accumulatedTransform,
    elementTransform,
  );

  // Process children first, recursively
  const children = Children.toArray(props.children);
  const newChildren: SvgElem[] = [];

  for (const child of children) {
    if (isValidElement(child)) {
      const processedChild = collectFlatNodes(
        child as SvgElem,
        newAccumulatedTransform,
        flatNodes,
        addAccumulatedTransforms,
      );
      // Only keep the child if it doesn't have an ID (wasn't extracted)
      if (!(child.props as any).id) {
        newChildren.push(processedChild);
      }
    }
  }

  if (addAccumulatedTransforms && newAccumulatedTransform) {
    element = cloneElement(element, {
      [accumulatedTransformProp as any]: newAccumulatedTransform,
    });
  }

  // If this element has an ID, extract it with accumulated transform
  if (props.id) {
    const flattenedElement = cloneElement(element, {
      children: newChildren,
      transform: newAccumulatedTransform || undefined,
    });

    flatNodes.set(props.id, flattenedElement);
  }

  return cloneElement(element, { children: newChildren });
}

export function getAccumulatedTransform(element: SvgElem): string | undefined {
  const props = element.props as any;
  return props[accumulatedTransformProp];
}

function combineTransforms(t1: string, t2: string): string {
  if (!t1 && !t2) return "";
  if (!t1) return t2;
  if (!t2) return t1;
  return t1 + " " + t2;
}
