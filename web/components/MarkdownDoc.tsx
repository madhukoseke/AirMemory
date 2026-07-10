'use client'

import type { ReactNode } from 'react'

/** Minimal markdown renderer for incident / runbook docs (headings, lists, code, bold). */
export function MarkdownDoc({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/)

  return (
    <article className="doc-prose min-w-0 space-y-4 text-[14px] leading-7 text-muted">
      {blocks.map((block, index) => (
        <Block key={`${index}-${block.slice(0, 24)}`} block={block.trim()} />
      ))}
    </article>
  )
}

function Block({ block }: { block: string }) {
  if (!block) return null

  if (block.startsWith('# ')) {
    return <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text">{inline(block.slice(2))}</h1>
  }
  if (block.startsWith('## ')) {
    return <h2 className="pt-2 text-sm font-semibold tracking-[-0.01em] text-text">{inline(block.slice(3))}</h2>
  }
  if (block.startsWith('### ')) {
    return <h3 className="text-[13px] font-semibold text-text">{inline(block.slice(4))}</h3>
  }

  if (block.startsWith('```')) {
    const lines = block.split('\n')
    const body = lines.slice(1, lines[lines.length - 1]?.startsWith('```') ? -1 : undefined).join('\n')
    return (
      <pre className="overflow-x-auto rounded-control border border-border bg-surface px-3 py-3 font-mono text-[12px] leading-5 text-text">
        {body}
      </pre>
    )
  }

  if (block.split('\n').every((line) => /^[-*]\s+/.test(line) || line.trim() === '')) {
    return (
      <ul className="list-none space-y-1.5 pl-0">
        {block
          .split('\n')
          .filter(Boolean)
          .map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-[0.65em] h-1 w-1 shrink-0 rounded-full bg-muted" />
              <span>{inline(line.replace(/^[-*]\s+/, ''))}</span>
            </li>
          ))}
      </ul>
    )
  }

  if (block.split('\n').every((line) => /^\d+\.\s+/.test(line) || line.trim() === '')) {
    return (
      <ol className="list-none space-y-1.5 pl-0">
        {block
          .split('\n')
          .filter(Boolean)
          .map((line, i) => (
            <li key={line} className="flex gap-2">
              <span className="w-4 shrink-0 font-mono text-[11px] text-muted">{i + 1}.</span>
              <span>{inline(line.replace(/^\d+\.\s+/, ''))}</span>
            </li>
          ))}
      </ol>
    )
  }

  return (
    <p className="whitespace-pre-wrap">
      {block.split('\n').map((line, i) => (
        <span key={`${i}-${line}`}>
          {i > 0 ? <br /> : null}
          {inline(line)}
        </span>
      ))}
    </p>
  )
}

function inline(text: string): ReactNode {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-medium text-text">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="rounded bg-surface px-1 py-0.5 font-mono text-[12px] text-accent-strong">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      const link = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (link) {
        parts.push(
          <span key={key++} className="text-accent-strong">
            {link[1]}
          </span>
        )
      }
    }
    last = match.index + token.length
  }

  if (last < text.length) {
    parts.push(text.slice(last))
  }

  return parts.length ? parts : text
}
