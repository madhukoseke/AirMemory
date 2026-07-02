'use client'

import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import type { GraphPath } from '@/lib/api'

const KIND_COLORS: Record<string, string> = {
  pipeline: '#e5e5e5',
  task: '#b8b8b8',
  table: '#4ade80',
  incident: '#fca5a5',
  resolution: '#93c5fd'
}

const POSITIONS: Record<string, { x: number; y: number }> = {
  'dag-customer-daily-migration': { x: 20, y: 120 },
  'task-extract-hana-customer': { x: 260, y: 24 },
  'task-validate-row-counts': { x: 260, y: 120 },
  'task-publish-metrics': { x: 260, y: 216 },
  'table-hana-customer-master': { x: 560, y: 24 },
  'table-bq-customer-master': { x: 560, y: 120 },
  'table-bq-customer-metrics': { x: 560, y: 216 },
  'incident-inc-1029': { x: 860, y: 88 },
  'resolution-window': { x: 860, y: 184 }
}

export function LineageGraph({ graph }: { graph: GraphPath | null }) {
  if (!graph) {
    return (
      <div className="flex h-[320px] items-center justify-center border border-dashed border-border text-xs text-muted">
        graph pending
      </div>
    )
  }

  const nodes: Node[] = graph.nodes.map((node) => ({
    id: node.id,
    position: POSITIONS[node.id] ?? { x: 0, y: 0 },
    data: { label: node.label },
    style: {
      borderColor: node.active ? '#4ade80' : '#2a2a2a',
      color: KIND_COLORS[node.kind],
      boxShadow: node.active ? '0 0 0 1px rgba(74, 222, 128, 0.35)' : 'none',
      width: 190,
      minHeight: 38,
      padding: 8,
      whiteSpace: 'normal',
      overflowWrap: 'anywhere'
    }
  }))

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    className: edge.active ? 'active' : '',
    animated: edge.active,
    style: { stroke: edge.active ? '#4ade80' : '#2a2a2a' },
    labelStyle: { fill: edge.active ? '#4ade80' : '#888888', fontSize: 10 },
    labelBgStyle: { fill: '#0a0a0a' }
  }))

  return (
    <div className="h-[320px] overflow-hidden border border-dashed border-border bg-surface">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.3} maxZoom={1.4}>
        <Background color="#242424" gap={18} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

