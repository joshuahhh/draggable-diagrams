import { Draggable } from "./draggable";
import { DragSpecBuilder } from "./DragSpec";
import { assignPaths } from "./svgx/path";
import { accumulateTransforms, layerSvg, LayeredSvgx } from "./svgx/layers";
import { pipe, throwError } from "./utils";

export function renderDraggableReadOnly<T extends object>(
  draggable: Draggable<T>,
  state: T,
  draggedId: string | null,
): LayeredSvgx {
  return pipe(
    draggable({
      state,
      d: new DragSpecBuilder<T>(),
      draggedId,
      setState: throwError,
    }),
    assignPaths,
    accumulateTransforms,
    layerSvg,
  );
}
