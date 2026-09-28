"use client";

import { useRouter } from "next/navigation";
import type { GraphEdge, GraphModel, GraphNode } from "@/lib/graph/layout";

export function VerticalNetwork({
  model,
  onOpenEdge,
}: {
  model: GraphModel;
  onOpenEdge?: (edge: GraphEdge) => void;
}) {
  const router = useRouter();
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const focus = model.nodes.find((node) => node.kind === "focus");
  const incoming = model.edges.filter((edge) => edge.direction === "in");
  const outgoing = model.edges.filter((edge) => edge.direction === "out");

  return (
    <div className="mx-auto max-w-md py-2">
      {incoming.map((edge) => (
        <div key={edge.id}>
          <FlowNode node={nodes.get(edge.source)} onOpen={() => open(router, nodes.get(edge.source))} />
          <Rail edge={edge} onOpen={() => onOpenEdge?.(edge)} />
        </div>
      ))}
      {focus ? <FlowNode node={focus} emphasis onOpen={() => open(router, focus)} /> : null}
      {outgoing.map((edge) => (
        <div key={edge.id}>
          <Rail edge={edge} onOpen={() => onOpenEdge?.(edge)} />
          <FlowNode node={nodes.get(edge.target)} onOpen={() => open(router, nodes.get(edge.target))} />
        </div>
      ))}
    </div>
  );
}

function FlowNode({
  node,
  emphasis = false,
  onOpen,
}: {
  node?: GraphNode;
  emphasis?: boolean;
  onOpen: () => void;
}) {
  if (!node) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full flex-col items-start gap-1 border px-4 py-3 text-left ${
        emphasis ? "border-brass" : "border-line"
      }`}
    >
      {emphasis ? <span className="eyebrow">Wallet</span> : null}
      <span className={node.kind === "wallet" || emphasis ? "font-mono text-sm" : "text-sm"}>
        {emphasis ? node.sublabel ?? node.label : node.label}
      </span>
    </button>
  );
}

function Rail({ edge, onOpen }: { edge: GraphEdge; onOpen: () => void }) {
  const color = edge.direction === "in" ? "text-inflow" : "text-outflow";
  return (
    <button type="button" onClick={onOpen} className="relative flex h-14 w-full items-center gap-3 pl-5 text-left">
      <span className="absolute top-0 bottom-0 left-5 w-px bg-line" />
      <span className={`rail-flow absolute left-[18px] h-1.5 w-1.5 rounded-full ${edge.direction === "in" ? "bg-inflow" : "bg-outflow"}`} />
      <span className={`pl-4 font-mono text-xs ${color}`}>{edge.label}</span>
      <span className="text-xs text-faint">↓</span>
    </button>
  );
}

function open(router: ReturnType<typeof useRouter>, node?: GraphNode) {
  if (!node?.address || node.kind === "cluster") return;
  router.push(`/wallet/${node.address}`);
}
