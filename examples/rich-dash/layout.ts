/**
 * Layout builder — turns a declarative LayoutSpec tree into a Layout.
 *
 * [LAW:dataflow-not-control-flow] Every node runs the same code path. Leaves
 * carry a `name` that matches a widget id; branches carry `children` plus a
 * `split` direction. No special cases per widget kind.
 */

import { Layout } from "../../src/index.js";

export interface LayoutSpec {
  /** Cell name (only set on leaves). Must equal the bound widget id. */
  name?: string;
  /** Flex ratio when sharing space with siblings. */
  ratio?: number;
  /** Fixed size (rows for column splits, columns for row splits). */
  size?: number;
  /** Minimum size in cells. */
  minimumSize?: number;
  /** Branch direction. Required iff `children` is non-empty. */
  split?: "row" | "column";
  /** Child cells. Empty = leaf. */
  children?: LayoutSpec[];
}

export function buildLayout(spec: LayoutSpec): Layout {
  const node = new Layout(undefined, {
    name: spec.name,
    ratio: spec.ratio ?? 1,
    size: spec.size,
    minimumSize: spec.minimumSize ?? 1,
  });

  const children = (spec.children ?? []).map(buildLayout);
  if (children.length > 0) {
    if (spec.split === "row") {
      node.splitRow(...children);
    } else {
      node.splitColumn(...children);
    }
  }
  return node;
}
