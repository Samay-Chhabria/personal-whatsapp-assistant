import { getChatModel } from './llm'
import type { ContactMemoryCategory } from './memory'

export interface ExtractedContactMemory {
  category: ContactMemoryCategory
  content: string
  confidence: number
  expiresAt: string | null
}

const VALID_CATEGORIES: ContactMemoryCategory[] = [
  'identity',
  'personal_fact',
  'event',
  'commitment',
  'context',
  'inside_joke',
  'topic',
]

function parseContactMemories(text: string): ExtractedContactMemory[] {
  let jsonStr = text.trim()

  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const results: ExtractedContactMemory[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue

    const obj = item as Record<string, unknown>

    if (typeof obj.category !== 'string') continue
    if (!VALID_CATEGORIES.includes(obj.category as ContactMemoryCategory)) continue

    if (typeof obj.content !== 'string') continue
    const content = obj.content.trim()
    if (!content) continue

    let confidence = typeof obj.confidence === 'number' ? obj.confidence : 0.8
    if (!isFinite(confidence) || confidence < 0) confidence = 0
    if (confidence > 1) confidence = 1

    let expiresAt: string | null = null
    if (obj.expiresAt !== null && obj.expiresAt !== undefined && obj.expiresAt !== '') {
      if (typeof obj.expiresAt === 'string') {
        expiresAt = obj.expiresAt
      }
    }

    results.push({
      category: obj.category as ContactMemoryCategory,
      content,
      confidence,
      expiresAt,
    })
  }

  return results
}

export async function extractContactMemories(message: string): Promise<ExtractedContactMemory[]> {
  try {
    const extractionModel = getChatModel()
    const prompt = `Extract categorized memories from this WhatsApp message.

Analyze the message and identify useful information to remember about the person the owner is communicating with.

Categories:
- identity: Permanent identity information (name, university, workplace, profession). Only if clearly about the contact themselves.
- personal_fact: Stable personal information or preferences (hobbies, favorite food, interests).
- event: Time-sensitive events or plans (exam tomorrow, birthday next week, traveling Friday).
- commitment: Promises or commitments made by the owner or explicitly agreed between both parties ("I'll call you tomorrow", "we'll meet at 6").
- context: Temporary current state or activity (studying right now, feeling tired, at home, eating).
- inside_joke: Explicitly recognizable recurring shared jokes or references. Only if the message clearly references an established inside joke.
- topic: Recurring or meaningful conversation topics. Only extract when the message clearly indicates a topic worth remembering long-term.

Rules:
- Never invent information. Only extract what is explicitly supported by the message.
- Distinguish the contact from third parties. "my friend Ali is a doctor" does NOT mean the contact is a doctor.
- Do not store ordinary acknowledgements (ok, thanks, sure, haan, acha).
- Do not store every conversational statement as a memory.
- Do not extract the owner's personal information as contact information.
- Prefer fewer high-quality memories over many low-quality ones.
- Explicit statements get higher confidence (0.9-1.0). Inferred information gets lower confidence (0.5-0.8).
- If no useful memory can be extracted, return an empty array [].
- Never include passwords, API keys, tokens, or sensitive credentials.

Return ONLY a valid JSON array. Each element must have:
{
  "category": "one of: identity, personal_fact, event, commitment, context, inside_joke, topic",
  "content": "concise description of the memory",
  "confidence": number between 0 and 1,
  "expiresAt": null or "ISO date string" for temporary information
}

For permanent/stable information: expiresAt = null.
For temporary information: provide an approximate expiration when determinable.

Message: "${message}"`

    const response = await extractionModel.invoke([{ role: 'user', content: prompt }])

    let text = ''
    if (typeof response === 'object' && response.content) {
      if (Array.isArray(response.content)) {
        text = response.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text || '')
          .join(' ')
      } else {
        text = String(response.content)
      }
    } else {
      text = String(response)
    }

    const memories = parseContactMemories(text)
    console.log(`[Extraction] Found ${memories.length} contact memories`)
    return memories
  } catch (error) {
    console.error('[Extraction] Contact memory extraction failed:', (error as Error).message)
    return []
  }
}

export async function extractPersonalFacts(message: string): Promise<{ facts: { key: string; value: unknown }[] }> {
  try {
    const extractionModel = getChatModel()
    const prompt = `Extract personal facts from the user's message. 

  Recognize these types of personal information:
  - name
  - age
  - city
  - profession
  - favorite food
  - hobbies
  - preferences
  - arbitrary personal facts explicitly stated by the user

  Return ONLY a valid JSON object with this exact structure:
  {
    "facts": [
      {"key": "name", "value": "..."},
      {"key": "age", "value": ...},
      {"key": "city", "value": "..."},
      {"key": "profession", "value": "..."},
      {"key": "favorite food", "value": "..."},
      {"key": "hobbies", "value": "..."},
      {"key": "preferences", "value": "..."}
    ]
  }

  Rules:
  - Only include facts that are explicitly stated in the message
  - If no personal information is found, return {"facts": []}
  - Do NOT include facts that are not clearly stated
  - The "facts" array must always be present, even if empty

  User message: "${message}"`

    const response = await extractionModel.invoke([{ role: 'user', content: prompt }])

    let text = ''
    if (typeof response === 'object' && response.content) {
      if (Array.isArray(response.content)) {
        text = response.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text || '')
          .join(' ')
      } else {
        text = String(response.content)
      }
    } else {
      text = String(response)
    }

    const trimmed = text.trim()
    if (!trimmed.startsWith('{')) {
      return { facts: [] }
    }

    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed.facts)) {
      return { facts: [] }
    }

    console.log(`[Extraction] Found ${parsed.facts.length} facts`)
    return { facts: parsed.facts }
  } catch (error) {
    console.error('[Extraction] Error:', (error as Error).message)
    return { facts: [] }
  }
}

export function isFactAbout(key: string, allowedKeys: string[]): boolean {
  const lower = key.toLowerCase().trim()
  return allowedKeys.some((k) => k.toLowerCase().trim() === lower)
}
