/**
 * Knowledge Graph type system and operations — JTG v7.
 *
 * Upgrades from RAG (fragment retrieval) to a self-evolving knowledge graph.
 * Karpathy principle: "知识图谱比代码更值钱"
 *
 * Architecture: pure/I/O separation.
 *   - All domain logic is pure (no side effects, no I/O).
 *   - I/O wrappers live at the bottom and handle JSONL persistence.
 *
 * Node types cover the six v7 knowledge categories; edge types cover the six
 * relationship types. Confidence decay reuses the patent decay math from
 * confidence-decay.ts but is self-contained here for graph-level operations.
 */

// =====================================================================
// Types
// =====================================================================

export type KGNodeType = 'policy' | 'scene' | 'pattern' | 'template' | 'evidence' | 'landlord'

export interface KGNode {
  id: string
  type: KGNodeType
  title: string
  content: string
  metadata: Record<string, unknown>
  confidenceBase: number        // 0-1
  decayType: 'linear' | 'exponential' | 'step'
  collectDate: string           // ISO date
  expiryDate?: string           // optional hard expiry
  tags: string[]
  locale: 'ja' | 'zh' | 'en' | 'multi'
  createdBy: string
  updatedAt: string
}

export type KGEdgeType = 'causes' | 'prevents' | 'triggers' | 'validates' | 'supersedes' | 'observed_in'

export interface KGEdge {
  id: string
  type: KGEdgeType
  sourceId: string
  targetId: string
  weight: number               // 0-1 strength of relationship
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface KGContradiction {
  nodeA: string
  nodeB: string
  conflictType: 'factual' | 'temporal' | 'statistical'
  confidenceGap: number
  description: string
  resolution: 'pending' | 'nodeA_wins' | 'nodeB_wins' | 'both_updated' | 'human_review_required'
}

export interface KGUpdateProposal {
  id: string
  targetNodeId: string
  reason: string
  proposedChanges: Partial<KGNode>
  triggeredBy: string          // nodeId or 'manual'
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export interface KnowledgeGraph {
  nodes: KGNode[]
  edges: KGEdge[]
}

// =====================================================================
// Pure helpers
// =====================================================================

let _counter = 0

function generateId(prefix: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  _counter = (_counter + 1) % 1_000_000
  return `${prefix}${ts}_${rand}_${_counter}`
}

function daysBetween(from: string | Date, to: Date): number {
  const fromMs = typeof from === 'string' ? Date.parse(from) : from.getTime()
  if (!Number.isFinite(fromMs)) return 0
  return Math.max(0, (to.getTime() - fromMs) / 86_400_000)
}

// =====================================================================
// Pure: node and edge creation
// =====================================================================

export function createNode(input: Omit<KGNode, 'id' | 'updatedAt'>): KGNode {
  return {
    ...input,
    id: generateId('kg_node_'),
    updatedAt: new Date().toISOString(),
  }
}

export function createEdge(input: Omit<KGEdge, 'id' | 'createdAt'>): KGEdge {
  return {
    ...input,
    id: generateId('kg_edge_'),
    createdAt: new Date().toISOString(),
  }
}

// =====================================================================
// Pure: query operations
// =====================================================================

export function findNodesByType(graph: KnowledgeGraph, type: KGNodeType): KGNode[] {
  return graph.nodes.filter((n) => n.type === type)
}

export function findNodesByTag(graph: KnowledgeGraph, tag: string): KGNode[] {
  return graph.nodes.filter((n) => n.tags.includes(tag))
}

export function getNeighbors(
  graph: KnowledgeGraph,
  nodeId: string,
): { node: KGNode; edge: KGEdge; direction: 'outgoing' | 'incoming' }[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const results: { node: KGNode; edge: KGEdge; direction: 'outgoing' | 'incoming' }[] = []

  for (const edge of graph.edges) {
    if (edge.sourceId === nodeId) {
      const target = nodeMap.get(edge.targetId)
      if (target) results.push({ node: target, edge, direction: 'outgoing' })
    } else if (edge.targetId === nodeId) {
      const source = nodeMap.get(edge.sourceId)
      if (source) results.push({ node: source, edge, direction: 'incoming' })
    }
  }

  return results
}

/**
 * Follow 'supersedes' edges from startNodeId to build a temporal chain.
 * Returns nodes newest-first (start node is the newest, following supersedes
 * edges leads to progressively older versions).
 */
export function traverseSupersedes(
  graph: KnowledgeGraph,
  startNodeId: string,
): KGNode[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const chain: KGNode[] = []
  const visited = new Set<string>()
  let currentId: string | undefined = startNodeId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const node = nodeMap.get(currentId)
    if (!node) break
    chain.push(node)

    // Find what this node supersedes (outgoing 'supersedes' edge).
    const supersedesEdge = graph.edges.find(
      (e) => e.type === 'supersedes' && e.sourceId === currentId,
    )
    currentId = supersedesEdge?.targetId
  }

  return chain
}

// =====================================================================
// Pure: confidence decay
// =====================================================================

/**
 * Compute the current confidence for a node using its decay function.
 *
 * Decay math:
 *   - linear:      conf = base * max(0, 1 - 0.001 * days)
 *   - exponential: conf = base * exp(-ln(2) * days / 180)
 *   - step:        conf = base * stepMultiplier(days)
 *                  where step drops: 0.8 at 90d, 0.5 at 180d, 0.1 at 365d
 *
 * If the node has a hard expiryDate and asOf is past it, returns 0.
 */
export function computeNodeConfidence(node: KGNode, asOf?: Date): number {
  const now = asOf ?? new Date()

  // Hard expiry check.
  if (node.expiryDate) {
    const expiryMs = Date.parse(node.expiryDate)
    if (Number.isFinite(expiryMs) && now.getTime() >= expiryMs) return 0
  }

  const days = daysBetween(node.collectDate, now)

  let multiplier: number
  switch (node.decayType) {
    case 'linear':
      multiplier = Math.max(0, 1 - 0.001 * days)
      break
    case 'exponential':
      multiplier = Math.exp((-Math.LN2 * days) / 180)
      break
    case 'step':
      if (days < 90) multiplier = 1.0
      else if (days < 180) multiplier = 0.8
      else if (days < 365) multiplier = 0.5
      else multiplier = 0.1
      break
    default:
      multiplier = 1.0
  }

  return node.confidenceBase * multiplier
}

// =====================================================================
// Pure: staleness detection
// =====================================================================

export function findStaleNodes(
  graph: KnowledgeGraph,
  threshold: number = 0.5,
  asOf?: Date,
): KGNode[] {
  return graph.nodes.filter((n) => computeNodeConfidence(n, asOf) < threshold)
}

// =====================================================================
// Pure: contradiction detection
// =====================================================================

/**
 * Detect contradictions in the graph:
 *   1. Nodes connected by edges where the confidence gap > 0.3
 *   2. Policy nodes sharing a tag but with different content
 */
export function detectContradictions(graph: KnowledgeGraph): KGContradiction[] {
  const contradictions: KGContradiction[] = []
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  // Strategy 1: edge-connected nodes with confidence gap > 0.3
  for (const edge of graph.edges) {
    const source = nodeMap.get(edge.sourceId)
    const target = nodeMap.get(edge.targetId)
    if (!source || !target) continue

    const sourceConf = computeNodeConfidence(source)
    const targetConf = computeNodeConfidence(target)
    const gap = Math.abs(sourceConf - targetConf)

    if (gap > 0.3) {
      contradictions.push({
        nodeA: source.id,
        nodeB: target.id,
        conflictType: 'statistical',
        confidenceGap: Math.round(gap * 10000) / 10000,
        description: `Confidence gap ${gap.toFixed(3)} between connected nodes "${source.title}" and "${target.title}"`,
        resolution: 'pending',
      })
    }
  }

  // Strategy 2: policy nodes sharing tags but differing in content
  const policyNodes = graph.nodes.filter((n) => n.type === 'policy')
  for (let i = 0; i < policyNodes.length; i++) {
    for (let j = i + 1; j < policyNodes.length; j++) {
      const a = policyNodes[i]
      const b = policyNodes[j]
      const sharedTags = a.tags.filter((t) => b.tags.includes(t))
      if (sharedTags.length > 0 && a.content !== b.content) {
        const confA = computeNodeConfidence(a)
        const confB = computeNodeConfidence(b)
        contradictions.push({
          nodeA: a.id,
          nodeB: b.id,
          conflictType: 'factual',
          confidenceGap: Math.round(Math.abs(confA - confB) * 10000) / 10000,
          description: `Policy nodes "${a.title}" and "${b.title}" share tag(s) [${sharedTags.join(', ')}] but have different content`,
          resolution: 'pending',
        })
      }
    }
  }

  return contradictions
}

// =====================================================================
// Pure: update proposal generation
// =====================================================================

/**
 * When new evidence comes in, find all existing nodes sharing tags
 * and create update proposals.
 */
export function generateUpdateProposals(
  graph: KnowledgeGraph,
  newEvidence: KGNode,
): KGUpdateProposal[] {
  const proposals: KGUpdateProposal[] = []

  for (const node of graph.nodes) {
    if (node.id === newEvidence.id) continue
    const sharedTags = node.tags.filter((t) => newEvidence.tags.includes(t))
    if (sharedTags.length === 0) continue

    const currentConf = computeNodeConfidence(node)
    const evidenceConf = computeNodeConfidence(newEvidence)

    proposals.push({
      id: generateId('kg_proposal_'),
      targetNodeId: node.id,
      reason: `New evidence "${newEvidence.title}" (conf=${evidenceConf.toFixed(3)}) shares tag(s) [${sharedTags.join(', ')}] with "${node.title}" (conf=${currentConf.toFixed(3)})`,
      proposedChanges: {
        metadata: {
          ...node.metadata,
          _proposedUpdate: {
            fromEvidence: newEvidence.id,
            sharedTags,
            evidenceContent: newEvidence.content,
          },
        },
      },
      triggeredBy: newEvidence.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  }

  return proposals
}

// =====================================================================
// Pure: graph statistics
// =====================================================================

export function graphStats(graph: KnowledgeGraph): {
  nodeCount: number
  edgeCount: number
  byType: Record<KGNodeType, number>
  byEdgeType: Record<KGEdgeType, number>
  staleCount: number
  avgConfidence: number
} {
  const byType: Record<KGNodeType, number> = {
    policy: 0, scene: 0, pattern: 0, template: 0, evidence: 0, landlord: 0,
  }
  const byEdgeType: Record<KGEdgeType, number> = {
    causes: 0, prevents: 0, triggers: 0, validates: 0, supersedes: 0, observed_in: 0,
  }

  for (const node of graph.nodes) {
    byType[node.type] = (byType[node.type] ?? 0) + 1
  }
  for (const edge of graph.edges) {
    byEdgeType[edge.type] = (byEdgeType[edge.type] ?? 0) + 1
  }

  const staleNodes = findStaleNodes(graph)
  const confidences = graph.nodes.map((n) => computeNodeConfidence(n))
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    byType,
    byEdgeType,
    staleCount: staleNodes.length,
    avgConfidence: Math.round(avgConfidence * 10000) / 10000,
  }
}

// =====================================================================
// I/O: JSONL persistence
// =====================================================================

import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch (err) {
    console.error('[knowledge/graph] ensureDir failed', err)
  }
}

function appendRow(table: string, row: unknown): void {
  ensureDir()
  try {
    const fp = path.join(DATA_DIR, `${table}.jsonl`)
    fs.appendFileSync(fp, JSON.stringify(row) + '\n', 'utf-8')
  } catch (err) {
    console.error(`[knowledge/graph] appendRow(${table}) failed`, err)
  }
}

function readAll<T>(table: string): T[] {
  ensureDir()
  const fp = path.join(DATA_DIR, `${table}.jsonl`)
  try {
    if (!fs.existsSync(fp)) return []
    const raw = fs.readFileSync(fp, 'utf-8')
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T)
  } catch (err) {
    console.error(`[knowledge/graph] readAll(${table}) failed`, err)
    return []
  }
}

// =====================================================================
// I/O: public wrappers
// =====================================================================

export function loadGraph(): KnowledgeGraph {
  return {
    nodes: readAll<KGNode>('kg_nodes'),
    edges: readAll<KGEdge>('kg_edges'),
  }
}

export function saveNode(node: KGNode): void {
  appendRow('kg_nodes', node)
}

export function saveEdge(edge: KGEdge): void {
  appendRow('kg_edges', edge)
}
