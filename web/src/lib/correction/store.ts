/**
 * Correction Store (TASK 15 + 16)
 *
 * Persistence layer for human corrections.
 * Uses the same JSONL file-backed approach as tables.ts.
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { CorrectionRecord, CorrectionInput, CorrectionType } from './types'

const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), '.data')

const TABLE = 'corrections'

function filePath(): string {
  return path.join(DATA_DIR, `${TABLE}.jsonl`)
}

function ensureDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch (err) {
    console.error('[corrections] ensureDir failed', err)
  }
}

/**
 * Insert a new correction record.
 */
export function insertCorrection(input: CorrectionInput): CorrectionRecord {
  ensureDir()
  const record: CorrectionRecord = {
    ...input,
    id: `corr_${randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    appliedToKnowledgeBase: false,
  }

  try {
    fs.appendFileSync(filePath(), JSON.stringify(record) + '\n', 'utf8')
  } catch (err) {
    console.error('[corrections] insert failed', err)
  }

  return record
}

/**
 * List all corrections, optionally filtered.
 */
export function listCorrections(filter?: {
  correctionType?: CorrectionType
  appliedToKnowledgeBase?: boolean
  limit?: number
}): CorrectionRecord[] {
  try {
    if (!fs.existsSync(filePath())) return []
    const raw = fs.readFileSync(filePath(), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    let rows: CorrectionRecord[] = []
    for (const line of lines) {
      try { rows.push(JSON.parse(line)) } catch { /* skip malformed */ }
    }

    if (filter?.correctionType) {
      rows = rows.filter((r) => r.correctionType === filter.correctionType)
    }
    if (filter?.appliedToKnowledgeBase !== undefined) {
      rows = rows.filter((r) => r.appliedToKnowledgeBase === filter.appliedToKnowledgeBase)
    }

    rows.reverse()
    return filter?.limit ? rows.slice(0, filter.limit) : rows
  } catch {
    return []
  }
}

/**
 * Mark a correction as applied to the knowledge base.
 */
export function markCorrectionApplied(id: string): boolean {
  try {
    if (!fs.existsSync(filePath())) return false
    const raw = fs.readFileSync(filePath(), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    let found = false

    const updated = lines.map((line) => {
      try {
        const row = JSON.parse(line) as CorrectionRecord
        if (row.id === id) {
          found = true
          return JSON.stringify({ ...row, appliedToKnowledgeBase: true })
        }
        return line
      } catch {
        return line
      }
    })

    if (found) {
      fs.writeFileSync(filePath(), updated.join('\n') + '\n', 'utf8')
    }
    return found
  } catch {
    return false
  }
}
