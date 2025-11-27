import { produce } from "immer";
import _ from "lodash";
import { Manipulable, span, straightTo } from "./manipulable";
import { group, rectangle } from "./shape";
import { Vec2 } from "./vec2";
import { XYWH } from "./xywh";

type Tile = { key: string; label: string };

type PermState = {
  items: Tile[];
  // these are the weird ones:
  store: Tile[];
  deleted?: Tile;
};

export const manipulableInsertAndRemove: Manipulable<PermState> = {
  sourceFile: "manipulable-insert-and-remove.ts",

  render(state, draggableKey) {
    // draw grid as rectangles
    const TILE_SIZE = 50;

    const drawTile = ({ label, key }: Tile) =>
      rectangle({
        xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
        strokeStyle: "black",
        lineWidth: 2,
        fillStyle: "white",
        label,
      })
        .draggable(key)
        .absoluteKey(key)
        .zIndex(key === draggableKey ? 1 : 0);

    return group(
      // Items
      state.items.map((tile, idx) =>
        drawTile(tile).translate(Vec2(idx * TILE_SIZE, TILE_SIZE * 1.5)),
      ),

      // Store
      rectangle({
        xywh: XYWH(0, 0, 60, TILE_SIZE),
        label: "Store:",
      }),
      state.store.map((tile, idx) =>
        drawTile(tile).translate(Vec2(80 + idx * TILE_SIZE, 0)),
      ),

      // Deleted
      group(
        rectangle({
          xywh: XYWH(0, 0, TILE_SIZE, TILE_SIZE),
          label: "🗑",
        }),
        state.deleted && drawTile(state.deleted),
      ).translate(Vec2(300, 0)),
    );
  },

  onDrag(state, draggableKey) {
    const itemIdx = state.items.findIndex((item) => item.key === draggableKey);
    if (itemIdx !== -1) {
      const draggedItem = state.items[itemIdx];
      return [
        // rearranging order
        span(
          _.range(state.items.length).map((idx) =>
            produce(state, (draft) => {
              draft.items.splice(itemIdx, 1);
              draft.items.splice(idx, 0, draggedItem);
            }),
          ),
        ),

        // deleting
        straightTo(
          produce(state, (draft) => {
            draft.items.splice(itemIdx, 1);
            draft.deleted = draggedItem;
          }),
        ),
      ];
    } else {
      const storeItemIdx = state.store.findIndex(
        (item) => item.key === draggableKey,
      );
      if (storeItemIdx !== -1) {
        // item is from store, can be inserted anywhere
        const storeItem = state.store[storeItemIdx];
        return span(
          _.range(state.items.length + 1).map((idx) =>
            produce(state, (draft) => {
              draft.items.splice(idx, 0, storeItem);
              draft.store[storeItemIdx].key += "-1";
            }),
          ),
        );
      }
    }
  },

  cleanTransientState(state) {
    if (state.deleted) {
      return produce(state, (draft) => {
        draft.deleted = undefined;
      });
    }
    return state;
  },
};

export const stateInsertAndRemove1: PermState = {
  store: [
    { key: "D", label: "🍎" },
    { key: "E", label: "🍌" },
    { key: "F", label: "🍇" },
  ],
  items: [
    { key: "A", label: "🍎" },
    { key: "B", label: "🍎" },
    { key: "C", label: "🍌" },
  ],
};
