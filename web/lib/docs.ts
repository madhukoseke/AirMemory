import docsData from '@/lib/docs-data.json'

export type DocKind = 'index' | 'incident' | 'runbook' | 'pattern'

export type DocEntry = {
  id: string
  title: string
  kind: DocKind
  body: string
}

export const DOCS = docsData as DocEntry[]

export function listDocs(kind?: DocKind) {
  return kind ? DOCS.filter((doc) => doc.kind === kind) : DOCS
}

export function getDoc(id: string) {
  return DOCS.find((doc) => doc.id === id) ?? DOCS[0]
}

export function docsForIncident(incidentId: string) {
  const needle = incidentId.toLowerCase().replace(/_/g, '-')
  return DOCS.filter(
    (doc) =>
      doc.kind === 'incident' &&
      (doc.id.toLowerCase().includes(needle.replace(/-/g, '_')) ||
        doc.body.toLowerCase().includes(incidentId.toLowerCase()) ||
        doc.id.toLowerCase().includes(needle.replace(/-/g, '')))
  )
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  index: 'Overview',
  incident: 'Incidents',
  runbook: 'Runbooks',
  pattern: 'Patterns'
}
