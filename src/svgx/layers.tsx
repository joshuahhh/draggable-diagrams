import React, { cloneElement, Fragment } from "react";
import { Svgx, updateElement, updatePropsDownTree } from ".";
import { Vec2, Vec2able } from "../math/vec2";
import { assert, objectEntries } from "../utils";
import { findByPath } from "./path";
import { combineTransforms, globalToLocal, localToGlobal, parseTransform } from "./transform";

export type LayeredSvgx = {
  /**
   * Svgx nodes keyed by ID (or "" for root).
   */
  byId: Map<string, Svgx>;
  /**
   * Map of ID to its set of descendents' IDs (including
   * transitively). Will be null if we did wacky stuff to the
   * LayeredSvgx and don't want to bother preserving this info.
   */
  descendents: Map<string, Set<string>> | null;
};

const accumulatedTransformProp = "data-accumulated-transform";

/**
 * Step 1: Walks the SVG tree and adds data-accumulated-transform to
   all elements.
 * Accumulates transform attributes from parent <g> nodes.
 */
export function accumulateTransforms(element: Svgx): Svgx {
  return walkAndAccumulateTransforms(element, "");
}

function walkAndAccumulateTransforms(
  element: Svgx,
  accumulatedTransform: string,
): Svgx {
  const props = element.props as any;
  const elementTransform = props.transform || "";
  const newAccumulatedTransform = combineTransforms(
    accumulatedTransform,
    elementTransform,
  );

  return updateElement(
    element,
    (child) => walkAndAccumulateTransforms(child, newAccumulatedTransform),
    {
      [accumulatedTransformProp as any]: newAccumulatedTransform || undefined,
    },
  );
}

/**
 * Step 2: Partially flattens an SVG tree by pulling nodes with IDs
 * to the top level as separate layers. Reads data-accumulated-transform
 * and sets it as transform for extracted nodes. Returns a map of elements
 * keyed by their id, plus a descendents map tracking parent-child
 * relationships.
 * - Key "" contains the root with extracted nodes removed (or is not
 *   set if root has an ID)
 * - Extracted nodes are removed from their parents
 * - Recurses into nodes with IDs to find deeper IDs
 */
export function layerSvg(element: Svgx): LayeredSvgx {
  let byId = new Map<string, Svgx>();
  const descendents = new Map<string, Set<string>>();
  const rootWithExtractedRemoved = extractIdNodes(
    element,
    byId,
    descendents,
    null,
  );
  if (rootWithExtractedRemoved) {
    // we gotta put the root at the beginning of the map
    byId = new Map([["", rootWithExtractedRemoved], ...byId]);
  }
  return { byId, descendents };
}

/**
 * Recursively extracts nodes with IDs into byId map and tracks
 * descendents. Returns the element with extracted children removed
 * (or null if this element itself has an ID and is extracted).
 *
 * @param ancestorId - The ID of the nearest ancestor with an ID, or null if none
 */
function extractIdNodes(
  element: Svgx,
  byId: Map<string, Svgx>,
  descendents: Map<string, Set<string>>,
  ancestorId: string | null,
): Svgx | null {
  const props = element.props as any;

  // Validate: data-z-index can only be set on nodes with ids
  if (props["data-z-index"] !== undefined && !props.id) {
    throw new Error(
      `data-z-index can only be set on elements with an id attribute. Found data-z-index="${props["data-z-index"]}" on <${element.type}> without id.`,
    );
  }

  const currentId = props.id;
  const newAncestorId = currentId || ancestorId;

  const newElement = updateElement(element, (child) =>
    extractIdNodes(child, byId, descendents, newAncestorId),
  );

  if (currentId) {
    assert(
      !byId.has(currentId),
      `Duplicate id "${currentId}" found in SVG tree. Each element must have a unique id.`,
    );

    // Track this ID as a descendent of its ancestor (if any)
    if (ancestorId) {
      if (!descendents.has(ancestorId)) {
        descendents.set(ancestorId, new Set());
      }
      descendents.get(ancestorId)!.add(currentId);

      // Also add all of this element's descendants to the ancestor's descendants (transitive)
      if (descendents.has(currentId)) {
        for (const desc of descendents.get(currentId)!) {
          descendents.get(ancestorId)!.add(desc);
        }
      }
    }

    const accumulatedTransform = props[accumulatedTransformProp];
    const elementToLayer = cloneElement(newElement, {
      transform: accumulatedTransform || undefined,
    });

    byId.set(currentId, elementToLayer);
    return null;
  } else {
    return newElement;
  }
}

export function getAccumulatedTransform(element: Svgx): string | undefined {
  const props = element.props as any;
  return props[accumulatedTransformProp];
}

/** Convert a local point to global using an element's accumulated transform. */
export function elementLocalToGlobal(
  element: Svgx,
  localPoint: Vec2able,
): Vec2 {
  const transforms = parseTransform(getAccumulatedTransform(element) || "");
  return localToGlobal(transforms, localPoint);
}

/** Convert a global point to local using an element's accumulated transform. */
export function elementGlobalToLocal(
  element: Svgx,
  globalPoint: Vec2able,
): Vec2 {
  const transforms = parseTransform(getAccumulatedTransform(element) || "");
  return globalToLocal(transforms, globalPoint);
}

export function drawLayered(layered: LayeredSvgx): Svgx {
  return (
    <>
      {Array.from(layered.byId.entries())
        .sort(([_keyA, elemA], [_keyB, elemB]) => {
          const zIndexA = parseInt((elemA.props as any)["data-z-index"]) || 0;
          const zIndexB = parseInt((elemB.props as any)["data-z-index"]) || 0;
          return zIndexA - zIndexB;
        })
        .map(([key, element]) => (
          <Fragment key={key}>
            {updatePropsDownTree(element, (el) => {
              // Strip non-serializable data- props (e.g. data-on-drag functions)
              const newProps: React.SVGProps<SVGElement> = {};
              for (const [propName, propValue] of objectEntries(el.props)) {
                if (
                  propName.startsWith("data-") &&
                  typeof propValue !== "string" &&
                  typeof propValue !== "number"
                ) {
                  newProps[propName] = undefined;
                }
              }
              return newProps;
            })}
          </Fragment>
        ))}
    </>
  );
}

export function layeredExtract(
  layered: LayeredSvgx,
  id: string,
): { remaining: LayeredSvgx; extracted: LayeredSvgx } {
  assert(layered.descendents !== null, "layered.descendents is null");
  assert(layered.byId.has(id), `Layered SVG does not contain id "${id}"`);

  // Collect the ID and all its descendants
  const extractedIds = new Set([id]);
  if (layered.descendents.has(id)) {
    for (const descId of layered.descendents.get(id)!) {
      extractedIds.add(descId);
    }
  }

  // Split byId into extracted and remaining
  const extractedById = new Map<string, Svgx>();
  const remainingById = new Map<string, Svgx>();
  for (const [key, value] of layered.byId.entries()) {
    if (extractedIds.has(key)) {
      extractedById.set(key, value);
    } else {
      remainingById.set(key, value);
    }
  }

  // Split descendents into extracted and remaining
  // Only keep descendent relationships where both ancestor and descendent are in the same set
  const extractedDescendents = new Map<string, Set<string>>();
  const remainingDescendents = new Map<string, Set<string>>();

  for (const [ancestorId, descIds] of layered.descendents.entries()) {
    const isAncestorExtracted = extractedIds.has(ancestorId);

    const filteredDescs = new Set<string>();
    for (const descId of descIds) {
      const isDescExtracted = extractedIds.has(descId);
      // Only keep the relationship if both are in the same set
      if (isAncestorExtracted === isDescExtracted) {
        filteredDescs.add(descId);
      }
    }

    if (filteredDescs.size > 0) {
      if (isAncestorExtracted) {
        extractedDescendents.set(ancestorId, filteredDescs);
      } else {
        remainingDescendents.set(ancestorId, filteredDescs);
      }
    }
  }

  return {
    remaining: { byId: remainingById, descendents: remainingDescendents },
    extracted: { byId: extractedById, descendents: extractedDescendents },
  };
}

export function layeredMerge(h1: LayeredSvgx, h2: LayeredSvgx): LayeredSvgx {
  const mergedById = new Map<string, Svgx>(h1.byId);
  for (const [key, value] of h2.byId.entries()) {
    assert(
      !mergedById.has(key),
      `Cannot merge LayeredSvgx: duplicate id "${key}" found`,
    );
    mergedById.set(key, value);
  }
  return { byId: mergedById, descendents: null };
}

export function layeredTransform(
  layered: LayeredSvgx,
  transform: string,
): LayeredSvgx {
  const transformedById = new Map<string, Svgx>();
  for (const [key, element] of layered.byId.entries()) {
    const props = element.props as any;
    const elementTransform = props.transform || "";
    const newTransform = combineTransforms(transform, elementTransform);
    const transformedElement = cloneElement(element, {
      transform: newTransform || undefined,
    });
    transformedById.set(key, transformedElement);
  }
  return { byId: transformedById, descendents: layered.descendents };
}

export function layeredPrefixIds(
  layered: LayeredSvgx,
  prefix: string,
): LayeredSvgx {
  const prefixedById = new Map<string, Svgx>();
  for (const [key, element] of layered.byId.entries()) {
    const newId = prefix + key;
    const prefixedElement = cloneElement(element, {
      id: newId,
      ["data-path" as any]: newId + "/",
    });
    prefixedById.set(newId, prefixedElement);
  }
  return { byId: prefixedById, descendents: null };
}

export function layeredShiftZIndices(
  layered: LayeredSvgx,
  shift: number,
): LayeredSvgx {
  const shiftedById = new Map<string, Svgx>();
  for (const [key, element] of layered.byId.entries()) {
    const props = element.props as any;
    const zIndex = parseInt(props["data-z-index"]) || 0;
    const newZIndex = zIndex + shift;
    const shiftedElement = cloneElement(element, {
      "data-z-index": newZIndex,
    });
    shiftedById.set(key, shiftedElement);
  }
  return { ...layered, byId: shiftedById };
}

export function layeredSetAttributes(
  layered: LayeredSvgx,
  attrs: Partial<React.SVGProps<SVGElement>>,
): LayeredSvgx {
  const newById = new Map<string, Svgx>();
  for (const [key, element] of layered.byId.entries()) {
    newById.set(key, cloneElement(element, attrs));
  }
  return { ...layered, byId: newById };
}

export function findByPathInLayered(
  path: string,
  layered: LayeredSvgx,
): Svgx | null {
  for (const element of layered.byId.values()) {
    const found = findByPath(path, element);
    if (found) return found;
  }
  return null;
}
