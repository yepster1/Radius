export type HighwayWay = { nodes: number[] };

/**
 * A junction is a node shared by two or more highway ways.
 *
 * Counting every node on every way — which is what an `out count` over
 * `node(w)` does — also counts curve vertices, inflating the figure several
 * fold and stopping the Walk Score connectivity penalty from ever firing.
 */
export function countJunctions(ways: HighwayWay[]): number {
  const wayCountByNode = new Map<number, number>();

  for (const way of ways) {
    // A closed way repeats its first node at the end; dedupe within the way
    // so a loop does not count as a junction with itself.
    for (const id of new Set(way.nodes)) {
      wayCountByNode.set(id, (wayCountByNode.get(id) ?? 0) + 1);
    }
  }

  let junctions = 0;
  for (const count of wayCountByNode.values()) {
    if (count >= 2) junctions += 1;
  }
  return junctions;
}
