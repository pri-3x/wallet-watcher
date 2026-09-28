"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cubicPoint,
  curvePath,
  flowGeometry,
  nodeBox,
  type GraphEdge,
  type GraphModel,
  type GraphNode,
} from "@/lib/graph/layout";
import { VerticalNetwork } from "@/components/graph/vertical-network";

export function ActivityGraph({
  model,
  onOpenEdge,
  interactive = true,
}: {
  model: GraphModel;
  onOpenEdge?: (edge: GraphEdge) => void;
  interactive?: boolean;
}) {
  return (
    <div className={`relative h-full ${interactive ? "md:min-h-[520px]" : ""}`}>
      <div className="hidden h-full md:block">
        <DesktopGraph model={model} onOpenEdge={onOpenEdge} interactive={interactive} />
      </div>
      <div className="md:hidden">
        <VerticalNetwork model={model} onOpenEdge={onOpenEdge} />
      </div>
    </div>
  );
}

function DesktopGraph({
  model,
  onOpenEdge,
  interactive,
}: {
  model: GraphModel;
  onOpenEdge?: (edge: GraphEdge) => void;
  interactive: boolean;
}) {
  const router = useRouter();
  const markerId = useId().replace(/:/g, "");
  const inMarker = `flow-in-${markerId}`;
  const outMarker = `flow-out-${markerId}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const particles = useRef<Record<string, SVGCircleElement | null>>({});
  const viewRef = useRef({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  function commitView(next: { x: number; y: number; k: number }) {
    viewRef.current = next;
    setView(next);
  }
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<GraphEdge | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const nodes = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const started = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (media.matches || svgRef.current?.getClientRects().length === 0) return;
      const elapsed = (time - started) / 1000;
      for (const edge of model.edges) {
        const source = nodes.get(edge.source);
        const target = nodes.get(edge.target);
        if (!source || !target) continue;
        const geometry = geometryFor(edge, model.edges, source, target, nodes);
        for (let index = 0; index < 2; index += 1) {
          const dot = particles.current[`${edge.id}:${index}`];
          if (!dot) continue;
          const progress = (elapsed * 0.16 + index * 0.5) % 1;
          const point = cubicPoint(geometry.start, geometry.c1, geometry.c2, geometry.end, progress);
          dot.setAttribute("cx", point.x.toFixed(2));
          dot.setAttribute("cy", point.y.toFixed(2));
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [model.edges, nodes]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !interactive) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = clientToSvg(svg, event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.07 : 0.93;
      setView((current) => {
        const k = clamp(current.k * factor, 0.75, 2.4);
        const worldX = (point.x - current.x) / current.k;
        const worldY = (point.y - current.y) / current.k;
        const next = { k, x: point.x - worldX * k, y: point.y - worldY * k };
        viewRef.current = next;
        return next;
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [interactive]);

  function movePointer(event: React.PointerEvent) {
    const bounds = shellRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPointer({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    const target = event.target as Element;
    if (target.closest("[data-node]") || target.closest("[data-edge]")) return;
    const point = clientToSvg(event.currentTarget, event.clientX, event.clientY);
    drag.current = { x: point.x, y: point.y, vx: viewRef.current.x, vy: viewRef.current.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const point = clientToSvg(event.currentTarget, event.clientX, event.clientY);
    const next = {
      ...viewRef.current,
      x: drag.current.vx + (point.x - drag.current.x),
      y: drag.current.vy + (point.y - drag.current.y),
    };
    viewRef.current = next;
    setView(next);
  }

  const hovered = hoverEdge;

  return (
    <div ref={shellRef} className="relative h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${model.width} ${model.height}`}
        className="h-full w-full touch-none font-sans select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          drag.current = null;
        }}
        role="img"
        aria-label="Wallet activity graph"
      >
        <defs>
          <marker id={inMarker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1.4 L 8.5 5 L 0 8.6 Z" fill="var(--inflow)" />
          </marker>
          <marker id={outMarker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1.4 L 8.5 5 L 0 8.6 Z" fill="var(--outflow)" />
          </marker>
        </defs>
        <rect width={model.width} height={model.height} fill="transparent" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {model.edges.map((edge) => {
            const source = nodes.get(edge.source);
            const target = nodes.get(edge.target);
            if (!source || !target) return null;
            const geometry = geometryFor(edge, model.edges, source, target, nodes);
            const path = curvePath(geometry);
            const along = cubicPoint(
              geometry.start,
              geometry.c1,
              geometry.c2,
              geometry.end,
              edge.direction === "in" ? 0.36 : 0.64,
            );
            const horizontal = Math.abs(geometry.end.x - geometry.start.x) > Math.abs(geometry.end.y - geometry.start.y);
            const labelAt = horizontal ? { x: along.x, y: along.y - 20 } : along;
            const color = edge.direction === "in" ? "var(--inflow)" : "var(--outflow)";
            const marker = edge.direction === "in" ? `url(#${inMarker})` : `url(#${outMarker})`;
            const opacity = edgeOpacity(edge, hoverNode, hoverEdge?.id ?? null);
            const labelWidth = Math.max(62, edge.label.length * 7.1);
            return (
              <g key={edge.id} data-edge opacity={opacity} className="transition-opacity duration-150">
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={flowWidth(edge, model.edges)}
                  strokeLinecap="round"
                  markerEnd={marker}
                />
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  className="cursor-pointer"
                  onPointerEnter={(event) => {
                    setHoverEdge(edge);
                    movePointer(event);
                  }}
                  onPointerMove={(event) => {
                    setHoverEdge(edge);
                    movePointer(event);
                  }}
                  onPointerLeave={() => setHoverEdge(null)}
                  onClick={() => onOpenEdge?.(edge)}
                />
                <rect
                  x={labelAt.x - labelWidth / 2}
                  y={labelAt.y - 11}
                  width={labelWidth}
                  height={22}
                  rx={11}
                  fill="var(--canvas)"
                  stroke={color}
                />
                <text
                  x={labelAt.x}
                  y={labelAt.y + 4}
                  textAnchor="middle"
                  fill={color}
                  fontSize={11}
                  className="pointer-events-none font-mono"
                >
                  {edge.label}
                </text>
                {[0, 1].map((index) => (
                  <circle
                    key={index}
                    ref={(element) => {
                      particles.current[`${edge.id}:${index}`] = element;
                    }}
                    r={index === 0 ? 2.4 : 1.5}
                    fill={color}
                    opacity={index === 0 ? 0.95 : 0.45}
                    className="pointer-events-none"
                  />
                ))}
              </g>
            );
          })}

          {model.nodes.map((node) => (
            <NodeShape
              key={node.id}
              node={node}
              active={hoverNode === node.id}
              dimmed={Boolean(hoverNode && hoverNode !== node.id && !connected(node.id, hoverNode, model.edges))}
              onHover={setHoverNode}
              onOpen={() => {
                if (!node.address || node.kind === "cluster") return;
                router.push(`/wallet/${node.address}`);
              }}
            />
          ))}
        </g>
      </svg>

      {hovered && pointer ? (
        <div
          className="pointer-events-none absolute z-10 w-56 border border-line bg-canvas px-3 py-2.5"
          style={{ left: Math.min(pointer.x + 14, 520), top: pointer.y + 14 }}
        >
          <p className="eyebrow">{hovered.latest.type}</p>
          <p className="mt-2 text-sm">{hovered.latest.summary}</p>
          <p className="mt-1 font-mono text-xs text-muted">{hovered.label}</p>
          {hovered.count > 1 ? (
            <p className="mt-2 text-xs text-faint">{hovered.count} transfers on this path</p>
          ) : null}
        </div>
      ) : null}

      {interactive ? (
        <div className="absolute right-0 bottom-0 flex items-center gap-3 font-mono text-[11px] text-faint">
          <span>Drag to pan</span>
          <button type="button" className="hover:text-ink" onClick={() => commitView({ ...viewRef.current, k: clamp(viewRef.current.k - 0.15, 0.75, 2.4) })}>
            −
          </button>
          <span className="text-muted">{Math.round(view.k * 100)}%</span>
          <button type="button" className="hover:text-ink" onClick={() => commitView({ ...viewRef.current, k: clamp(viewRef.current.k + 0.15, 0.75, 2.4) })}>
            +
          </button>
          <button type="button" className="hover:text-ink" onClick={() => commitView({ x: 0, y: 0, k: 1 })}>
            Fit
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NodeShape({
  node,
  active,
  dimmed,
  onHover,
  onOpen,
}: {
  node: GraphNode;
  active: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onOpen: () => void;
}) {
  const box = nodeBox(node.kind);
  const x = -box.w / 2;
  const y = -box.h / 2;
  const stroke = active ? "var(--ink)" : "var(--line-strong)";

  return (
    <g
      data-node
      transform={`translate(${node.x} ${node.y})`}
      opacity={dimmed ? 0.28 : 1}
      className="cursor-pointer transition-opacity duration-150"
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      role="link"
      tabIndex={0}
      aria-label={node.sublabel ? `${node.label} ${node.sublabel}` : node.label}
    >
      <rect
        x={x}
        y={y}
        width={box.w}
        height={box.h}
        fill="var(--panel)"
        stroke={stroke}
        strokeDasharray={node.kind === "cluster" ? "3 3" : undefined}
      />
      {node.kind === "focus" ? <rect x={x} y={y} width={3} height={box.h} fill="var(--brass)" /> : null}
      <text y={node.kind === "focus" ? -10 : -6} textAnchor="middle" fill="var(--faint)" fontSize={9} letterSpacing="1.6">
        {kindLabel(node.kind)}
      </text>
      <text
        y={node.kind === "focus" ? 14 : 12}
        textAnchor="middle"
        fill={node.kind === "cluster" ? "var(--faint)" : "var(--ink)"}
        fontSize={node.kind === "wallet" || node.kind === "focus" ? 12 : 14}
        className={node.kind === "wallet" || node.kind === "focus" ? "font-mono" : undefined}
      >
        {node.kind === "focus" ? node.sublabel ?? node.label : node.label}
      </text>
    </g>
  );
}

function kindLabel(kind: GraphNode["kind"]) {
  if (kind === "focus") return "WALLET";
  if (kind === "exchange") return "EXCHANGE";
  if (kind === "protocol") return "PROTOCOL";
  if (kind === "contract") return "CONTRACT";
  if (kind === "cluster") return "GROUPED";
  return "ADDRESS";
}

function flowWidth(edge: GraphEdge, edges: GraphEdge[]) {
  const max = Math.max(...edges.map((item) => item.amountUsd), 1);
  return 1.15 + (edge.amountUsd / max) * 1.7;
}

function geometryFor(
  edge: GraphEdge,
  edges: GraphEdge[],
  source: GraphNode,
  target: GraphNode,
  nodes: Map<string, GraphNode>,
) {
  const focus = source.kind === "focus" ? source : target.kind === "focus" ? target : null;
  if (!focus) return flowGeometry(source, target);
  const sameSide = edges.filter(
    (item) =>
      (item.source === focus.id || item.target === focus.id) && item.direction === edge.direction,
  );
  const ordered = [...sameSide].sort((a, b) => counterpartyX(a, focus.id, nodes) - counterpartyX(b, focus.id, nodes));
  const index = Math.max(0, ordered.findIndex((item) => item.id === edge.id));
  const along = (index + 1) / (ordered.length + 1);
  if (source.kind === "focus") return flowGeometry(source, target, along, 0.5);
  return flowGeometry(source, target, 0.5, along);
}

function counterpartyX(edge: GraphEdge, focusId: string, nodes: Map<string, GraphNode>) {
  const id = edge.source === focusId ? edge.target : edge.source;
  return nodes.get(id)?.x ?? 0;
}

function connected(nodeId: string, hoverId: string, edges: GraphEdge[]) {
  return edges.some(
    (edge) =>
      (edge.source === nodeId && edge.target === hoverId) ||
      (edge.target === nodeId && edge.source === hoverId),
  );
}

function edgeOpacity(edge: GraphEdge, hoverNode: string | null, hoverEdge: string | null) {
  if (hoverEdge) return hoverEdge === edge.id ? 1 : 0.14;
  if (hoverNode) return edge.source === hoverNode || edge.target === hoverNode ? 1 : 0.14;
  return 0.9;
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const mapped = point.matrixTransform(matrix.inverse());
  return { x: mapped.x, y: mapped.y };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
