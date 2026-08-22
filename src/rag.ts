import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../knowledge/knowledge.txt')
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

let vectorStore: any = null

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1)
  }
  const len = tokens.length || 1
  for (const [key, val] of tf) {
    tf.set(key, val / len)
  }
  return tf
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (const [key, val] of a) {
    normA += val * val
    const bVal = b.get(key) || 0
    dot += val * bVal
  }
  for (const [, val] of b) {
    normB += val * val
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function simpleSplitText(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
    chunks.push(text.substring(i, i + chunkSize))
  }
  return chunks
}

export async function initializeRAG(): Promise<{ vectorStore: any }> {
  if (vectorStore) {
    return { vectorStore }
  }

  try {
    const knowledgeContent = fs.readFileSync(KNOWLEDGE_BASE_PATH, 'utf-8')
    const chunks = simpleSplitText(knowledgeContent, CHUNK_SIZE, CHUNK_OVERLAP)

    const docTFs = chunks.map((chunk) => computeTF(tokenize(chunk)))

    vectorStore = {
      docs: chunks,
      docTFs,
      async getRelevantDocuments(query: string) {
        const queryTF = computeTF(tokenize(query))
        const scores = docTFs.map((docTF: Map<string, number>, i: number) => ({
          similarity: cosineSimilarity(queryTF, docTF),
          index: i,
        }))
        scores.sort((a: any, b: any) => b.similarity - a.similarity)
        const topK = scores.slice(0, 4)
        return topK.map((s: any) => ({ pageContent: chunks[s.index], score: s.similarity }))
      },
    }

    console.log(`[RAG] Knowledge base loaded: ${chunks.length} chunks`)
    return { vectorStore }
  } catch (error) {
    console.error('[RAG] Failed to initialize:', (error as Error).message)
    vectorStore = {
      docs: [],
      docTFs: [],
      async getRelevantDocuments() {
        return []
      },
    }
    return { vectorStore }
  }
}

export async function retrieveContext(query: string): Promise<string> {
  try {
    const { vectorStore: vs } = await initializeRAG()

    if (!vs || vs.docs.length === 0) {
      console.log('[RAG] No documents available')
      return ''
    }

    const relevantDocs = await vs.getRelevantDocuments(query)

    if (relevantDocs.length === 0) {
      console.log('[RAG] Retrieved 0 documents')
      return ''
    }

    const filtered = relevantDocs.filter((d: any) => d.score > 0.15)
    console.log(`[RAG] Retrieved ${filtered.length} documents`)

    if (filtered.length === 0) {
      return ''
    }

    return filtered.map((doc: any) => doc.pageContent).join('\n\n')
  } catch (error) {
    console.error('[RAG] Retrieval error:', (error as Error).message)
    return ''
  }
}
