'use client'

import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import type { GraphPath } from '@/lib/api'

const KIND_COLORS: Record<string, string> = {
  pipeline: '#e5e5e5',
  task: '#a3a3a3',
  table: '#34d399',
  incident: '#f87171',
  resolution: '#60a5fa'
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
      <div className="flex h-[360px] items-center justify-center rounded-card border border-border bg-panel text-xs text-muted">
        graph pending
      </div>
    )
  }

  const nodes: Node[] = graph.nodes.map((node) => ({
    id: node.id,
    position: POSITIONS[node.id] ?? { x: 0, y: 0 },
    data: { label: node.label },
    style: {
      borderColor: node.active ? 'rgba(59, 130, 246, 0.55)' : 'rgba(255, 255, 255, 0.08)',
      background: '#0c0c0c',
      color: KIND_COLORS[node.kind],
      boxShadow: node.active ? '0 0 0 1px rgba(59, 130, 246, 0.25)' : 'none',
      width: 190,
      minHeight: 38,
      padding: 8,
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      borderRadius: 6
    }
  }))

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    className: edge.active ? 'active' : '',
    animated: edge.active,
    style: { stroke: edge.active ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)' },
    labelStyle: { fill: edge.active ? '#ededed' : '#8a8a8a', fontSize: 10 },
    labelBgStyle: { fill: '#0c0c0c' }
  }))

  return (
    <div className="h-[360px] w-full min-w-0 overflow-hidden rounded-card border border-border bg-panel">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.25} maxZoom={1.4}>
        <Background color="rgba(255,255,255,0.06)" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
