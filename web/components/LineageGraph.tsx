'use client'

import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import type { GraphPath } from '@/lib/api'

const KIND_COLORS: Record<string, string> = {
  pipeline: '#27272a',
  task: '#71717a',
  table: '#168a5b',
  incident: '#d92d20',
  resolution: '#2563eb'
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
      <div className="flex h-[360px] items-center justify-center rounded-[6px] border border-border bg-surface text-xs text-muted">
        graph pending
      </div>
    )
  }

  const nodes: Node[] = graph.nodes.map((node) => ({
    id: node.id,
    position: POSITIONS[node.id] ?? { x: 0, y: 0 },
    data: { label: node.label },
    style: {
      borderColor: node.active ? '#18181b' : '#e4e4e7',
      color: KIND_COLORS[node.kind],
      boxShadow: node.active ? '0 0 0 1px rgba(24, 24, 27, 0.18)' : 'none',
      width: 190,
      minHeight: 38,
      padding: 8,
      whiteSpace: 'normal',
      overflowWrap: 'break-word'
    }
  }))

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    className: edge.active ? 'active' : '',
    animated: edge.active,
    style: { stroke: edge.active ? '#18181b' : '#d4d4d8' },
    labelStyle: { fill: edge.active ? '#18181b' : '#71717a', fontSize: 10 },
    labelBgStyle: { fill: '#ffffff' }
  }))

  return (
    <div className="overflow-x-auto rounded-[6px] border border-border bg-panel">
      <div className="h-[420px] min-w-[780px]">
        <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.3} maxZoom={1.4}>
          <Background color="#e4e4e7" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}
