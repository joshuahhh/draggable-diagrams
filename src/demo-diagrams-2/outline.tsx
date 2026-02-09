import { useMemo, useState } from "react";
import { ConfigCheckbox } from "../configurable";
import { DemoDrawer } from "../DemoDrawer";
import { closest, floating, just, span, withBackground } from "../DragSpec2";
import { Drag, Manipulable } from "../manipulable2";
import { Svgx } from "../svgx";
import { translate } from "../svgx/helpers";

type Tree = {
  id: string;
  label: string;
  children: Tree[];
};

type State = Tree;

const state1: State = {
  id: "root",
  label: "+",
  children: [
    { id: "A", label: "A", children: [] },
    { id: "B", label: "B", children: [] },
  ],
};

const state2: State = {
  id: "plus-1",
  label: "+",
  children: [
    {
      id: "plus-2",
      label: "+",
      children: [
        { id: "A", label: "A", children: [] },
        { id: "B", label: "B", children: [] },
      ],
    },
    {
      id: "plus-3",
      label: "+",
      children: [
        { id: "C", label: "C", children: [] },
        { id: "D", label: "D", children: [] },
      ],
    },
  ],
};

const state3: State = {
  id: "root",
  label: "+",
  children: [
    {
      id: "root-1",
      label: "+",
      children: [
        {
          id: "root-1-1",
          label: "+",
          children: [
            { id: "root-1-1-1", label: "⛅", children: [] },
            {
              id: "root-1-1-2",
              label: "-",
              children: [{ id: "root-1-1-2-1", label: "🍄", children: [] }],
            },
          ],
        },
        { id: "root-1-2", label: "🍄", children: [] },
      ],
    },
    {
      id: "root-2",
      label: "+",
      children: [
        {
          id: "root-2-1",
          label: "×",
          children: [
            { id: "root-2-1-1", label: "🎲", children: [] },
            { id: "root-2-1-2", label: "🦠", children: [] },
          ],
        },
        {
          id: "root-2-2",
          label: "×",
          children: [
            { id: "root-2-2-1", label: "🎲", children: [] },
            { id: "root-2-2-2", label: "🐝", children: [] },
          ],
        },
      ],
    },
  ],
};

const stateTreeOfLife: State = {
  id: "animalia",
  label: "Animalia",
  children: [
    {
      id: "chordata",
      label: "Chordata",
      children: [
        {
          id: "mammalia",
          label: "Mammalia",
          children: [
            {
              id: "carnivora",
              label: "Carnivora",
              children: [
                {
                  id: "felidae",
                  label: "Felidae",
                  children: [
                    { id: "cat", label: "🐱 Cat", children: [] },
                    { id: "lion", label: "🦁 Lion", children: [] },
                    { id: "tiger", label: "🐯 Tiger", children: [] },
                  ],
                },
                {
                  id: "canidae",
                  label: "Canidae",
                  children: [
                    { id: "dog", label: "🐕 Dog", children: [] },
                    { id: "fox", label: "🦊 Fox", children: [] },
                    { id: "wolf", label: "🐺 Wolf", children: [] },
                  ],
                },
              ],
            },
            {
              id: "primates",
              label: "Primates",
              children: [
                { id: "monkey", label: "🐵 Monkey", children: [] },
                { id: "gorilla", label: "🦍 Gorilla", children: [] },
                { id: "orangutan", label: "🦧 Orangutan", children: [] },
              ],
            },
            {
              id: "cetacea",
              label: "Cetacea",
              children: [
                { id: "whale", label: "🐋 Whale", children: [] },
                { id: "dolphin", label: "🐬 Dolphin", children: [] },
              ],
            },
          ],
        },
        {
          id: "aves",
          label: "Aves",
          children: [
            { id: "eagle", label: "🦅 Eagle", children: [] },
            { id: "parrot", label: "🦜 Parrot", children: [] },
            { id: "penguin", label: "🐧 Penguin", children: [] },
            { id: "owl", label: "🦉 Owl", children: [] },
          ],
        },
        {
          id: "reptilia",
          label: "Reptilia",
          children: [
            { id: "turtle", label: "🐢 Turtle", children: [] },
            { id: "lizard", label: "🦎 Lizard", children: [] },
            { id: "crocodile", label: "🐊 Crocodile", children: [] },
            { id: "snake", label: "🐍 Snake", children: [] },
          ],
        },
      ],
    },
    {
      id: "arthropoda",
      label: "Arthropoda",
      children: [
        {
          id: "insecta",
          label: "Insecta",
          children: [
            { id: "butterfly", label: "🦋 Butterfly", children: [] },
            { id: "bee", label: "🐝 Bee", children: [] },
            { id: "ant", label: "🐜 Ant", children: [] },
            { id: "ladybug", label: "🐞 Ladybug", children: [] },
          ],
        },
        {
          id: "arachnida",
          label: "Arachnida",
          children: [
            { id: "spider", label: "🕷️ Spider", children: [] },
            { id: "scorpion", label: "🦂 Scorpion", children: [] },
          ],
        },
      ],
    },
    {
      id: "mollusca",
      label: "Mollusca",
      children: [
        { id: "octopus", label: "🐙 Octopus", children: [] },
        { id: "squid", label: "🦑 Squid", children: [] },
        { id: "snail", label: "🐌 Snail", children: [] },
      ],
    },
  ],
};

type Config = {
  useFloating: boolean;
};

const defaultConfig: Config = {
  useFloating: true,
};

const HEIGHT = 25;
const WIDTH = 100;
const INDENT = 20;

function renderTree(
  tree: Tree,
  rootState: Tree,
  draggedId: string | null,
  drag: Drag<Tree>,
  config: Config
): {
  elem: Svgx;
  h: number;
} {
  const block = (
    <g>
      <rect
        x={0}
        y={0}
        width={WIDTH}
        height={HEIGHT}
        stroke="gray"
        strokeWidth={1}
        fill="white"
      />
      <text
        x={5}
        y={HEIGHT / 2}
        dominantBaseline="middle"
        textAnchor="start"
        fontSize={14}
        fill="black"
      >
        {tree.label}
      </text>
    </g>
  );

  let y = HEIGHT;

  return {
    elem: (
      <g
        id={tree.id}
        data-z-index={tree.id === draggedId ? 1 : 0}
        data-on-drag={drag(() => {
          const stateWithout = structuredClone(rootState);
          let foundNode: Tree | null = null;
          function removeKey(node: Tree): boolean {
            for (let i = 0; i < node.children.length; i++) {
              if (node.children[i].id === tree.id) {
                foundNode = node.children[i];
                node.children.splice(i, 1);
                return true;
              }
              if (removeKey(node.children[i])) {
                return true;
              }
            }
            return false;
          }
          removeKey(stateWithout);
          if (!foundNode) {
            return just(rootState);
          }

          const statesWith = insertAtAllPositions(stateWithout, foundNode);

          if (config.useFloating) {
            return withBackground(
              closest(statesWith.map((s) => floating(s))),
              floating(stateWithout)
            );
          } else {
            return span(statesWith);
          }
        })}
      >
        {block}
        {tree.children.map((child) => {
          const childRender = renderTree(
            child,
            rootState,
            draggedId,
            drag,
            config
          );
          const childPositioned = (
            <g id={`position-${child.id}`} transform={translate(INDENT, y)}>
              {childRender.elem}
            </g>
          );
          y += childRender.h;
          return childPositioned;
        })}
      </g>
    ),
    h: y,
  };
}

function insertAtAllPositions(tree: Tree, child: Tree): Tree[] {
  function helper(node: Tree): Tree[] {
    const results: Tree[] = [];

    const len = node.children.length;
    for (let i = 0; i <= len; i++) {
      const newChildren = [
        ...node.children.slice(0, i),
        child,
        ...node.children.slice(i),
      ];
      results.push({
        ...node,
        children: newChildren,
      });
    }

    for (let i = 0; i < len; i++) {
      const originalChild = node.children[i];
      const subtreeVariants = helper(originalChild);
      for (const variant of subtreeVariants) {
        const newChildren = node.children.slice();
        newChildren[i] = variant;
        results.push({
          ...node,
          children: newChildren,
        });
      }
    }

    return results;
  }

  return helper(tree);
}

function manipulableFactory(config: Config): Manipulable<State> {
  return ({ state, drag, draggedId }) => (
    <g transform={translate(10, 10)}>
      {renderTree(state, state, draggedId, drag, config).elem}
    </g>
  );
}

// # Component

export const Outline = () => {
  const [config, setConfig] = useState(defaultConfig);

  const manipulable = useMemo(() => manipulableFactory(config), [config]);

  return (
    <div className="flex gap-4 items-start">
      <div>
        <h3 className="text-md font-medium italic mt-6 mb-1">simple</h3>
        <DemoDrawer
          manipulable={manipulable}
          initialState={state1}
          width={200}
          height={100}
        />
        <h3 className="text-md font-medium italic mt-6 mb-1">nested</h3>
        <DemoDrawer
          manipulable={manipulable}
          initialState={state2}
          width={250}
          height={200}
        />
        <h3 className="text-md font-medium italic mt-6 mb-1">complex</h3>
        <DemoDrawer
          manipulable={manipulable}
          initialState={state3}
          width={350}
          height={350}
        />
        <h3 className="text-md font-medium italic mt-6 mb-1">tree of life</h3>
        <DemoDrawer
          manipulable={manipulable}
          initialState={stateTreeOfLife}
          width={350}
          height={1100}
        />
      </div>
      <div className="bg-gray-50 rounded p-3 shrink-0 sticky top-4">
        <div className="text-xs font-medium text-gray-700 mb-2">Options</div>
        <ConfigCheckbox
          value={config.useFloating}
          onChange={(v) => setConfig((c) => ({ ...c, useFloating: v }))}
        >
          Use <span className="font-mono">floating</span>
        </ConfigCheckbox>
      </div>
    </div>
  );
};
