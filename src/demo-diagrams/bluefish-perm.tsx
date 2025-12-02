import { Align, createName, Group, Rect, Ref, StackH, Text } from "bluefish-js";
import { produce } from "immer";
import { SVGAttributes } from "react";
import { bluefish } from "../bluefish";
import { span } from "../DragSpec";
import { Manipulable } from "../manipulable";

export namespace BluefishPerm {
  export type State = {
    perm: string[];
  };

  export const state1: State = {
    perm: ["A", "B", "C", "D", "E"],
  };

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    const TILE_SIZE = 50;

    const attribsById: Record<string, SVGAttributes<SVGElement>> = {};

    return bluefish(
      StackH({ spacing: 0 }, [
        ...state.perm.map((p) => {
          attribsById[p] = {
            "data-on-drag": drag(() => {
              const draggedIdx = state.perm.indexOf(p);
              return span(
                state.perm.map((_, idx) =>
                  produce(state, (draft) => {
                    draft.perm.splice(draggedIdx, 1);
                    draft.perm.splice(idx, 0, p);
                  })
                )
              );
            }),
            ["data-z-index" as any]: p === draggedId ? 1 : 0,
          };

          const backgroundName = createName("background");
          const boxName = createName("box");
          const labelName = createName("label");

          // TODO: alternative to "background" – make new "Offset"
          // component... copy-paste "Group" and then offset paint
          // part as needed

          return Group({ id: p }, [
            Rect({
              name: backgroundName,
              width: TILE_SIZE,
              height: TILE_SIZE + 5,
              fill: "none",
            }),
            Rect({
              name: boxName,
              width: TILE_SIZE,
              height: TILE_SIZE,
              stroke: "black",
              "stroke-width": 2,
              fill: "white",
            }),
            Text(
              { name: labelName, "font-size": "20px", "font-weight": "normal" },
              p
            ),
            Align({ alignment: "center" }, [
              Ref({ select: labelName }),
              Ref({ select: boxName }),
            ]),
            Align(
              { alignment: draggedId === p ? "topCenter" : "bottomCenter" },
              [Ref({ select: labelName }), Ref({ select: backgroundName })]
            ),
          ]);
        }),
      ]),
      attribsById
    );
  };
}
