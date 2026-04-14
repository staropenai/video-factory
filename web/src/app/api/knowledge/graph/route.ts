/**
 * GET  /api/knowledge/graph — Graph stats, node listing, stale detection.
 * POST /api/knowledge/graph — Add nodes/edges, detect contradictions, generate proposals.
 *
 * v7 P0-5: Knowledge graph management endpoint. Supports the Karpathy
 * principle: "知识图谱比代码更值钱" — knowledge graph over RAG.
 */

import { NextRequest } from 'next/server'
import {
  loadGraph,
  saveNode,
  saveEdge,
  createNode,
  createEdge,
  graphStats,
  findStaleNodes,
  detectContradictions,
  generateUpdateProposals,
  findNodesByType,
  findNodesByTag,
} from '@/lib/knowledge/graph'
import type { KGNodeType } from '@/lib/knowledge/graph'
import { logError } from '@/lib/audit/logger'
import { ok, fail, rateLimited } from '@/lib/utils/api-response'
import { checkRateLimit, extractClientIp, RATE_LIMIT_PRESETS } from '@/lib/security/rate-limit'
import { sanitizeInput, stripControlChars } from '@/lib/utils/sanitize'

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`kg:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const graph = loadGraph()
    const stats = graphStats(graph)
    const type = req.nextUrl.searchParams.get('type') as KGNodeType | null
    const tag = req.nextUrl.searchParams.get('tag')
    const staleOnly = req.nextUrl.searchParams.get('stale') === 'true'

    let nodes = graph.nodes
    if (type) nodes = findNodesByType(graph, type)
    if (tag) nodes = findNodesByTag(graph, tag)
    if (staleOnly) nodes = findStaleNodes(graph)

    return ok({
      stats,
      nodes: nodes.slice(0, 100),
      edges: graph.edges.slice(0, 200),
    })
  } catch (error) {
    logError('knowledge_graph_get_error', error)
    return fail('Internal error', 500)
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`kg:${extractClientIp(req.headers)}`, RATE_LIMIT_PRESETS.api);
  if (!rl.allowed) return rateLimited(Math.ceil((rl.retryAfterMs ?? 60000) / 1000));

  try {
    const body = await req.json()
    const action = String(body.action ?? '').trim()

    if (action === 'add_node') {
      const raw = body.node ?? {}
      if (typeof raw.title === 'string') {
        raw.title = stripControlChars(sanitizeInput(raw.title, 200))
      }
      if (typeof raw.content === 'string') {
        raw.content = stripControlChars(sanitizeInput(raw.content, 4000))
      }
      if (typeof raw.createdBy === 'string') {
        raw.createdBy = stripControlChars(sanitizeInput(raw.createdBy, 120))
      }
      if (Array.isArray(raw.tags)) {
        raw.tags = raw.tags.map((t: unknown) =>
          typeof t === 'string' ? stripControlChars(sanitizeInput(t, 120)) : t,
        )
      }
      const node = createNode(raw)
      saveNode(node)
      return ok({ node })
    }

    if (action === 'add_edge') {
      const edge = createEdge(body.edge)
      saveEdge(edge)
      return ok({ edge })
    }

    if (action === 'detect_contradictions') {
      const graph = loadGraph()
      const contradictions = detectContradictions(graph)
      return ok({ contradictions, count: contradictions.length })
    }

    if (action === 'find_stale') {
      const threshold = Number(body.threshold ?? 0.5)
      const graph = loadGraph()
      const stale = findStaleNodes(graph, threshold)
      return ok({ staleNodes: stale, count: stale.length })
    }

    if (action === 'generate_proposals') {
      if (!body.newEvidence) {
        return fail('newEvidence required', 400, 'MISSING_EVIDENCE')
      }
      const rawEvidence = body.newEvidence
      if (typeof rawEvidence.title === 'string') {
        rawEvidence.title = stripControlChars(sanitizeInput(rawEvidence.title, 200))
      }
      if (typeof rawEvidence.content === 'string') {
        rawEvidence.content = stripControlChars(sanitizeInput(rawEvidence.content, 4000))
      }
      const graph = loadGraph()
      const evidenceNode = createNode(rawEvidence)
      const proposals = generateUpdateProposals(graph, evidenceNode)
      return ok({ proposals, count: proposals.length })
    }

    return fail(`Unknown action: ${action}`, 400, 'UNKNOWN_ACTION')
  } catch (error) {
    logError('knowledge_graph_post_error', error)
    return fail('Internal error', 500)
  }
}
