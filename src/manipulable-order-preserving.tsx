import _ from "lodash";
import { Manipulable } from "./manipulable";
import { drawBgTree, drawSubtree, FG_NODE_SIZE } from "./order-preserving";
import { group, keyed, lazy, PointInShape, translate } from "./shape";
import {
  buildHasseDiagram,
  HasseDiagram,
  tree3,
  tree7,
  TreeNode,
} from "./trees";

type OrderPreservingState = {
  domainTree: TreeNode;
  codomainTree: TreeNode;
  hasseDiagram: HasseDiagram;
  curMorphIdx: number;
  yForTradRep: number;
};

type OrderPreservingConfig = {
  showTradRep: boolean;
};

export const manipulableOrderPreserving: Manipulable<
  OrderPreservingState,
  OrderPreservingConfig
> = {
  sourceFile: "manipulable-order-preserving.ts",

  render(state, _draggableKey, config) {
    const morph = state.hasseDiagram.nodes[state.curMorphIdx];
    const g = group();
    const r = drawBgTree(state.codomainTree, state.domainTree, morph);
    g.shapes.push(r.shape);
    if (config.showTradRep) {
      const domNodeCenters: Record<string, PointInShape> = {};
      const domR = drawSubtree(
        state.domainTree,
        "domain",
        "fg",
        domNodeCenters,
      );
      g.shapes.push(translate([0, state.yForTradRep], domR.shape));
      const codNodeCenters: Record<string, PointInShape> = {};
      const codR = drawSubtree(
        state.codomainTree,
        "codomain",
        "bg",
        codNodeCenters,
      );
      g.shapes.push(translate([domR.w + 40, state.yForTradRep], codR.shape));
      for (const [domElem, codElem] of Object.entries(morph)) {
        g.shapes.push(
          translate(
            [0, 0],
            keyed(
              `morphism-${domElem}`,
              false,
              lazy((resolveHere) => {
                const from = resolveHere(domNodeCenters[domElem]);
                const to = resolveHere(codNodeCenters[codElem]);
                return {
                  type: "curve",
                  points: [
                    from.towards(to, FG_NODE_SIZE / 2),
                    from.lerp(to, 0.5).add([0, -10]),
                    to,
                  ],
                  strokeStyle: "#4287f5",
                  lineWidth: 2,
                };
              }),
            ),
          ),
        );
      }
    }
    return g;
  },

  accessibleFrom(state, draggableKey) {
    const { hasseDiagram, curMorphIdx } = state;
    const curMorph = hasseDiagram.nodes[curMorphIdx];
    const adjMorphIdxes = _.range(hasseDiagram.nodes.length).filter(
      (nodeIdx) => {
        const morph = hasseDiagram.nodes[nodeIdx];
        // all the mappings in morph must agree with those in the current morph,
        // except for the one with id draggableKey
        return Object.entries(morph).every(
          ([domainElem, codomainElem]) =>
            domainElem === draggableKey ||
            curMorph[domainElem] === codomainElem,
        );
      },
    );
    return adjMorphIdxes.map((idx) => ({
      ...state,
      curMorphIdx: idx,
    }));
  },

  defaultConfig: {
    showTradRep: false,
  },

  renderConfig(config, setConfig) {
    return (
      <>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={config.showTradRep}
            onChange={(e) =>
              setConfig({ ...config, showTradRep: e.target.checked })
            }
          />
          <span>Show Traditional Representation</span>
        </label>
      </>
    );
  },
};

export const stateOrderPreserving1: OrderPreservingState = {
  domainTree: tree3,
  codomainTree: tree3,
  hasseDiagram: buildHasseDiagram(tree3, tree3),
  curMorphIdx: 0,
  yForTradRep: 300,
};

export const stateOrderPreserving2: OrderPreservingState = {
  domainTree: tree7,
  codomainTree: tree7,
  hasseDiagram: buildHasseDiagram(tree7, tree7),
  curMorphIdx: 0,
  yForTradRep: 500,
};
