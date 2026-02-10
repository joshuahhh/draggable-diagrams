import { produce } from "immer";
import * as PeggyPattern from "./peggy/pattern";
import { assert, hasKey, templateLiteralTagOrNot } from "./utils";

export type Tree = {
  id: string;
  label: string;
  children: Tree[];
};

export function isOp(node: Tree): boolean {
  return node.label === "+" || node.label === "×";
}

export function isBinaryOp(node: Tree): boolean {
  return isOp(node) && node.children.length === 2;
}

// # rewrites

/**
 * A pattern is like a tree, but can have wildcards. A pattern
 * matches a tree if there is a way to substitute subtrees for the
 * wildcards to get the tree. Also, we are often interested in
 * matching a pattern in response to a node being "triggered" (by a
 * drag). A pattern can mark any number of nodes as "trigger" nodes,
 * meaning that at least one of those nodes must correspond to the
 * triggered node in order for the match to succeed.
 */
export type Pattern = { id: string; isTrigger?: boolean } & (
  | {
      type: "op";
      label: string;
      children: Pattern[];
    }
  | {
      type: "wildcard";
    }
);

export function isWildcard(
  node: Pattern,
): node is Pattern & { type: "wildcard" } {
  return hasKey(node, "type") && node.type === "wildcard";
}

// # microlang

export const pattern = templateLiteralTagOrNot((s: string): Pattern => {
  return processPattern(PeggyPattern.parse(s));
});

function processPattern(node: PeggyPattern.Pattern): Pattern {
  const isTrigger = node[0] === "#";

  const contents = node[2];
  if (typeof contents === "string") {
    return {
      type: "wildcard",
      id: contents,
      isTrigger,
    };
  } else {
    const op = contents[2];
    const children = contents[4];
    return {
      type: "op",
      label: op[0],
      id: op[0] + (op[1] ?? ""),
      children: children.map(processPattern),
      isTrigger,
    };
  }
}

// # rewrites

export type Rewrite = {
  from: Pattern;
  to: Pattern;
};

export function rewr(from: string, to: string): Rewrite {
  return {
    from: pattern(from),
    to: pattern(to),
  };
}

type Match = Map<string, Tree>;

/**
 * Attempt to match a pattern against a tree. If successful, returns
 * a map from pattern IDs to subtrees of the tree. If not successful,
 * returns null.
 */
function match(pattern: Pattern, tree: Tree, triggerId: string): Match | null {
  const result = matchHelper(pattern, tree, triggerId);
  if (result === null || !result.isTriggered) {
    return null;
  } else {
    return result.match;
  }
}

function matchHelper(
  pattern: Pattern,
  tree: Tree,
  triggerId: string,
): { match: Match; isTriggered: boolean } | null {
  let result = {
    match: new Map<string, Tree>(),
    isTriggered: !!(pattern.isTrigger && tree.id === triggerId),
  };
  if (isWildcard(pattern)) {
    result.match.set(pattern.id, tree);
    return result;
  } else {
    if (pattern.label !== tree.label) {
      return null;
    }
    if (pattern.children.length !== tree.children.length) {
      return null;
    }
    for (let i = 0; i < pattern.children.length; i++) {
      const childPattern = pattern.children[i];
      const childTree = tree.children[i];
      const childMap = matchHelper(childPattern, childTree, triggerId);
      if (childMap === null) {
        return null;
      }
      for (const [key, value] of childMap.match.entries()) {
        assert(!result.match.has(key));
        result.match.set(key, value);
      }
      result.isTriggered = result.isTriggered || childMap.isTriggered;
    }
    result.match.set(pattern.id, tree);
    return result;
  }
}

/**
 * If a tree has matched the LHS of a rewrite, resulting in a match,
 * this function applies the rewrite to produce a new tree.
 */
export function applyRewrite(match: Match, rewriteTo: Pattern): Tree {
  function build(pattern: Pattern): Tree {
    const subtree = match.get(pattern.id);
    assert(subtree !== undefined);
    if (isWildcard(pattern)) {
      return subtree;
    } else {
      return {
        id: subtree.id,
        label: pattern.label,
        children: pattern.children.map(build),
      };
    }
  }

  return build(rewriteTo);
}

/**
 * Given a tree and a set of rewrites, return all possible trees
 * resulting from applying rewrites at any depth in the tree,
 * triggered by the node with triggerId.
 */
export function allPossibleRewrites(
  tree: Tree,
  rewrites: Rewrite[],
  triggerId: string,
): Tree[] {
  const results: Tree[] = [];

  for (const rewrite of rewrites) {
    const matchResult = match(rewrite.from, tree, triggerId);
    if (matchResult !== null) {
      results.push(applyRewrite(matchResult, rewrite.to));
    }
  }

  for (const [i, child] of tree.children.entries()) {
    const childRewrites = allPossibleRewrites(child, rewrites, triggerId);
    for (const newChild of childRewrites) {
      results.push(
        produce(tree, (draft) => {
          draft.children[i] = newChild;
        }),
      );
    }
  }

  return results;
}
