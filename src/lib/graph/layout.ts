import { shortAddress } from "@/lib/address";
import { formatUsd } from "@/lib/format";
import type { ActivityEvent, Direction, NodeKind, Party } from "@/lib/types";

export type GraphNode = {
  id: string;
  address: string;
  label: string;
  sublabel?: string;
  kind: NodeKind;
  x: number;
  y: number;
  volumeUsd: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  amountUsd: number;
  label: string;
  count: number;
  direction: Direction;
  latest: ActivityEvent;
  bend: number;
};

export type GraphModel = {
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type Aggregate = {
  key: string;
  counterparty: Party;
  direction: Direction;
  amountUsd: number;
  events: ActivityEvent[];
};

const WIDTH = 1200;
const HEIGHT = 720;
const MAX_PER_SIDE = 5;

function focusId(address: string) {
  return `focus:${address.toLowerCase()}`;
}

export function layoutActivity(events: ActivityEvent[], focusAddress: string): GraphModel {
  const focus = focusAddress.toLowerCase();
  const grouped = new Map<string, Aggregate>();

  for (const event of events) {
    const fromFocus = event.from.address.toLowerCase() === focus;
    const toFocus = event.to.address.toLowerCase() === focus;
    if (!fromFocus && !toFocus) continue;
    const direction: Direction = toFocus && !fromFocus ? "in" : "out";
    const counterparty = direction === "in" ? event.from : event.to;
    const key = `${direction}:${counterparty.address.toLowerCase()}`;
    const current = grouped.get(key);
    if (current) {
      current.amountUsd += event.amountUsd;
      current.events.push(event);
    } else {
      grouped.set(key, {
        key,
        counterparty,
        direction,
        amountUsd: event.amountUsd,
        events: [event],
      });
    }
  }

  const incoming = [...grouped.values()].filter((item) => item.direction === "in");
  const outgoing = [...grouped.values()].filter((item) => item.direction === "out");
  const inTaken = take(incoming);
  const outTaken = take(outgoing);

  const volume = new Map<string, { usd: number; party: Party; inUsd: number; outUsd: number }>();
  for (const item of [...inTaken.kept, ...outTaken.kept]) {
    const id = item.counterparty.address.toLowerCase();
    const current = volume.get(id) ?? { usd: 0, party: item.counterparty, inUsd: 0, outUsd: 0 };
    current.usd += item.amountUsd;
    if (item.direction === "in") current.inUsd += item.amountUsd;
    else current.outUsd += item.amountUsd;
    volume.set(id, current);
  }

  const inNodes: GraphNode[] = [];
  const outNodes: GraphNode[] = [];
  for (const [id, entry] of volume) {
    const node: GraphNode = {
      id,
      address: entry.party.address,
      label: entry.party.kind === "wallet" ? shortAddress(entry.party.address) : entry.party.label,
      kind: entry.party.kind,
      x: 0,
      y: 0,
      volumeUsd: entry.usd,
    };
    if (entry.inUsd >= entry.outUsd) inNodes.push(node);
    else outNodes.push(node);
  }

  if (inTaken.cluster) inNodes.push(clusterNode(inTaken.cluster, "in"));
  if (outTaken.cluster) outNodes.push(clusterNode(outTaken.cluster, "out"));

  place(centerWeighted(inNodes), 56);
  place(centerWeighted(outNodes), 640);

  const focusNode: GraphNode = {
    id: focusId(focusAddress),
    address: focusAddress,
    label: "Wallet",
    sublabel: shortAddress(focusAddress),
    kind: "focus",
    x: WIDTH / 2,
    y: 340,
    volumeUsd: [...volume.values()].reduce((sum, entry) => sum + entry.usd, 0),
  };

  const nodes = [focusNode, ...inNodes, ...outNodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GraphEdge[] = [];

  const pushEdge = (item: Aggregate, cluster = false) => {
    const counterId = cluster ? `cluster:${item.direction}` : item.counterparty.address.toLowerCase();
    if (!nodeIds.has(counterId)) return;
    const latest = [...item.events].sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!latest) return;
    const inbound = item.direction === "in";
    edges.push({
      id: item.key,
      source: inbound ? counterId : focusNode.id,
      target: inbound ? focusNode.id : counterId,
      amountUsd: item.amountUsd,
      label: edgeLabel(item),
      count: item.events.length,
      direction: item.direction,
      latest,
      bend: inbound ? 42 : -42,
    });
  };

  for (const item of [...inTaken.kept, ...outTaken.kept]) pushEdge(item);
  if (inTaken.cluster) pushEdge(collapse(inTaken.cluster, "in"), true);
  if (outTaken.cluster) pushEdge(collapse(outTaken.cluster, "out"), true);

  const frame = fitFrame(nodes);
  return { width: frame.width, height: frame.height, nodes, edges };
}

/** Pulls the canvas in around the nodes so a sparse wallet fills the stage. */
function fitFrame(nodes: GraphNode[]) {
  const pad = 88;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const box = nodeBox(node.kind);
    minX = Math.min(minX, node.x - box.w / 2);
    maxX = Math.max(maxX, node.x + box.w / 2);
    minY = Math.min(minY, node.y - box.h / 2);
    maxY = Math.max(maxY, node.y + box.h / 2);
  }
  if (!Number.isFinite(minX)) return { width: WIDTH, height: HEIGHT };
  const shiftX = pad - minX;
  const shiftY = pad - minY;
  for (const node of nodes) {
    node.x += shiftX;
    node.y += shiftY;
  }
  return {
    width: Math.ceil(maxX - minX + pad * 2),
    height: Math.ceil(maxY - minY + pad * 2),
  };
}

function edgeLabel(item: Aggregate) {
  if (item.amountUsd >= 1) return formatUsd(item.amountUsd);
  const kind = [...item.events].sort((a, b) => b.timestamp - a.timestamp)[0]?.type;
  if (kind === "nft") return "NFT";
  if (kind === "contract") return "Call";
  return formatUsd(item.amountUsd);
}

function take(items: Aggregate[]) {
  const sorted = [...items].sort((a, b) => b.amountUsd - a.amountUsd);
  if (sorted.length <= MAX_PER_SIDE) return { kept: sorted, cluster: null as Aggregate[] | null };
  return { kept: sorted.slice(0, MAX_PER_SIDE - 1), cluster: sorted.slice(MAX_PER_SIDE - 1) };
}

function clusterNode(items: Aggregate[], direction: Direction): GraphNode {
  return {
    id: `cluster:${direction}`,
    address: "",
    label: `${items.length} more`,
    kind: "cluster",
    x: 0,
    y: 0,
    volumeUsd: items.reduce((sum, item) => sum + item.amountUsd, 0),
  };
}

function collapse(items: Aggregate[], direction: Direction): Aggregate {
  const events = items.flatMap((item) => item.events);
  const first = items[0];
  return {
    key: `cluster:${direction}`,
    counterparty: first?.counterparty ?? {
      address: "",
      label: `${items.length} more`,
      kind: "wallet",
    },
    direction,
    amountUsd: items.reduce((sum, item) => sum + item.amountUsd, 0),
    events,
  };
}

function centerWeighted(nodes: GraphNode[]) {
  const sorted = [...nodes].sort((a, b) => b.volumeUsd - a.volumeUsd);
  const row: GraphNode[] = [];
  sorted.forEach((node, index) => {
    if (index % 2 === 0) row.push(node);
    else row.unshift(node);
  });
  return row;
}

function place(nodes: GraphNode[], y: number) {
  const count = nodes.length;
  if (count === 0) return;
  const gap = 220;
  const origin = WIDTH / 2 - ((count - 1) * gap) / 2;
  nodes.forEach((node, index) => {
    node.y = y;
    node.x = count === 1 ? WIDTH / 2 : origin + index * gap;
  });
}

export function nodeBox(kind: NodeKind) {
  if (kind === "focus") return { w: 196, h: 78 };
  if (kind === "exchange" || kind === "protocol") return { w: 148, h: 58 };
  if (kind === "cluster") return { w: 104, h: 44 };
  return { w: 136, h: 52 };
}

export type Point = { x: number; y: number };
export type Curve = { start: Point; c1: Point; c2: Point; end: Point };

export function flowGeometry(
  source: GraphNode,
  target: GraphNode,
  sourceAlong = 0.5,
  targetAlong = 0.5,
): Curve {
  const vertical = Math.abs(target.y - source.y) >= Math.abs(target.x - source.x) * 0.45;
  if (vertical) {
    const down = target.y >= source.y;
    const start = port(source, down ? "bottom" : "top", sourceAlong);
    const end = port(target, down ? "top" : "bottom", targetAlong);
    const pull = Math.max(42, Math.abs(end.y - start.y) * 0.46);
    const dir = down ? 1 : -1;
    return {
      start,
      end,
      c1: { x: start.x, y: round(start.y + dir * pull) },
      c2: { x: end.x, y: round(end.y - dir * pull) },
    };
  }

  const right = target.x >= source.x;
  const start = port(source, right ? "right" : "left", sourceAlong);
  const end = port(target, right ? "left" : "right", targetAlong);
  const pull = Math.max(48, Math.abs(end.x - start.x) * 0.42);
  const dir = right ? 1 : -1;
  return {
    start,
    end,
    c1: { x: round(start.x + dir * pull), y: start.y },
    c2: { x: round(end.x - dir * pull), y: end.y },
  };
}

function port(node: GraphNode, side: "top" | "bottom" | "left" | "right", along: number): Point {
  const box = nodeBox(node.kind);
  const left = node.x - box.w / 2;
  const top = node.y - box.h / 2;
  const shiftX = (along - 0.5) * box.w * 0.92;
  const shiftY = (along - 0.5) * box.h * 0.4;
  if (side === "top") return { x: round(node.x + shiftX), y: top };
  if (side === "bottom") return { x: round(node.x + shiftX), y: top + box.h };
  if (side === "left") return { x: left, y: round(node.y + shiftY) };
  return { x: left + box.w, y: round(node.y + shiftY) };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function cubicPoint(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

export function curvePath(curve: Curve) {
  const place = (point: Point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  return `M ${place(curve.start)} C ${place(curve.c1)} ${place(curve.c2)} ${place(curve.end)}`;
}
