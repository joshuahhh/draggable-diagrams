import { produce } from "immer";
import { amb, produceAmb, require } from "../amb";
import { detachReattach } from "../DragSpec";
import { Manipulable } from "../manipulable";
import { translate } from "../svgx/helpers";

export namespace Hanoi {
  export type State = {
    pegs: number[][]; // Each peg holds disk IDs (smallest to largest from top to bottom)
  };

  export const state3: State = {
    pegs: [[1, 2, 3], [], []],
  };

  export const state4: State = {
    pegs: [[1, 2, 3, 4], [], []],
  };

  const PEG_WIDTH = 10;
  const BASE_HEIGHT = 10;
  const DISK_HEIGHT = 20;
  const MIN_DISK_WIDTH = 40;
  const DISK_WIDTH_INCREMENT = 25;
  const X_OFFSET = 80;

  function diskWidth(diskId: number): number {
    return MIN_DISK_WIDTH + (diskId - 1) * DISK_WIDTH_INCREMENT;
  }

  export const manipulable: Manipulable<State> = ({
    state,
    drag,
    draggedId,
  }) => {
    const allDisks = state.pegs.flat();
    const maxDiskId = Math.max(
      ...allDisks,
      draggedId ? parseInt(draggedId) : 0
    );
    const PEG_HEIGHT = (maxDiskId + 1) * DISK_HEIGHT;
    const BASE_WIDTH = diskWidth(maxDiskId + 1);
    const PEG_SPACING = BASE_WIDTH + 40;

    return (
      <g>
        {/* Draw pegs and bases */}
        {[0, 1, 2].map((pegIdx) => {
          const x = X_OFFSET + pegIdx * PEG_SPACING;
          return (
            <g transform={translate(x, 0)}>
              {/* Base */}
              <rect
                x={-BASE_WIDTH / 2}
                y={PEG_HEIGHT}
                width={BASE_WIDTH}
                height={BASE_HEIGHT}
                fill="#8B4513"
                stroke="black"
                strokeWidth={2}
              />
              {/* Peg */}
              <rect
                x={-PEG_WIDTH / 2}
                y={0}
                width={PEG_WIDTH}
                height={PEG_HEIGHT}
                fill="#654321"
                stroke="black"
                strokeWidth={2}
              />
            </g>
          );
        })}

        {/* Draw disks */}
        {state.pegs.map((peg, pegIdx) =>
          peg.map((diskId, positionOnPeg) => {
            const isDragged = diskId.toString() === draggedId;
            const isTopDisk = positionOnPeg === 0;
            const width = diskWidth(diskId);
            const x = X_OFFSET + pegIdx * PEG_SPACING - width / 2;
            const y = PEG_HEIGHT - (peg.length - positionOnPeg) * DISK_HEIGHT;

            // Colors for disks
            const colors = [
              "#FF6B6B",
              "#4ECDC4",
              "#45B7D1",
              "#FFA07A",
              "#98D8C8",
            ];
            const color = colors[(diskId - 1) % colors.length];

            return (
              <g
                id={diskId.toString()}
                transform={translate(x, y)}
                data-z-index={isDragged ? 2 : 1}
                data-on-drag={
                  isTopDisk &&
                  drag(() => {
                    const detached = produce(state, (draft) => {
                      draft.pegs[pegIdx].shift();
                    });

                    const reattached = produceAmb(detached, (draft) => {
                      const newPeg = draft.pegs[amb([0, 1, 2])];
                      newPeg.unshift(diskId);
                      require(newPeg.length === 1 || newPeg[0] < newPeg[1]);
                    });

                    return detachReattach(detached, reattached);
                  })
                }
              >
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={DISK_HEIGHT}
                  fill={color}
                  stroke="black"
                  strokeWidth={2}
                  rx={4}
                />
                <text
                  x={width / 2}
                  y={DISK_HEIGHT / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={14}
                  fill="black"
                  fontWeight="bold"
                >
                  {diskId}
                </text>
              </g>
            );
          })
        )}
      </g>
    );
  };
}
