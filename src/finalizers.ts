import {
  Diagram,
  groupBuilder,
  PointInDiagram,
  resolvePointInDiagram,
} from "./shape";
import { Vec2 } from "./vec2";

// Finalizers is a little pattern for accumulating drawing operations
// that operate on PointInDiagrams.
//
// See manipulable-order-preserving.tsx for a heavyweight example.
// Maybe someday I'll make a gentler example.

export type Finalizer = (resolve: (pid: PointInDiagram) => Vec2) => Diagram;

export class Finalizers {
  private finalizers: Finalizer[] = [];

  push(finalizer: Finalizer) {
    this.finalizers.push(finalizer);
  }

  finish(diagram: Diagram): Diagram {
    const finalDiagram = groupBuilder();
    finalDiagram.push(diagram);
    const resolve = (pid: PointInDiagram) =>
      resolvePointInDiagram(pid, finalDiagram);
    for (const finalizer of this.finalizers) {
      finalDiagram.push(finalizer(resolve));
    }
    return finalDiagram;
  }
}
