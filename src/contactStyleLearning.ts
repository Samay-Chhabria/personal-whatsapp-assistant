import { ContactProfile, getConversationHistory, getContactProfile, updateContactProfile } from './memory'
import { getChatModel, parseLLMResponse } from './llm'

export const STYLE_LEARNING_HISTORY_LIMIT = 40
export const MIN_MESSAGES_FOR_STYLE_LEARNING = 10
export const STYLE_LEARNING_INTERVAL = 10

export interface ContactStyleObservation {
  preferredLanguage?: string
  tone?: string
  formality?: string
  humorLevel?: string
  typicalResponseLength?: string
  styleNotes?: string
}

export async function getUserMessageCount(userId: string): Promise<number> {
  const history = await getConversationHistory(userId)
  return history.filter(m => m.role === 'user').length
}

export async function analyzeContactStyle(
  userId: string,
  existingProfile: ContactProfile | null,
  history: Array<{ role: string; content: string }>
): Promise<ContactStyleObservation | null> {
  try {
    if (history.length === 0) return null

    const model = getChatModel()

    const systemContent = `You are analyzing communication patterns from WhatsApp messages.

Your task: Identify how the owner (Samay Kumar) tends to communicate with this specific person based on their recent conversation.

Rules:
- Analyze the OWNER's messages to determine communication patterns
- Do NOT copy complete messages
- Do NOT invent facts about the contact
- Do NOT infer sensitive personal attributes
- Do NOT change Samay's identity
- Do NOT treat a single unusual message as a permanent personality trait
- Only extract stable patterns observed across multiple messages
- Focus on: language preference, language mixing, tone, formality, humor level, typical response length, and general conversational behavior
- If the owner mixes languages, note which ones and when
- If the conversation is mostly the contact talking and the owner sends very short replies, reflect that in typicalResponseLength
- Be specific and grounded in the actual messages observed

Return ONLY a JSON object with these fields (omit fields you cannot determine with confidence):
{
  "preferredLanguage": "string - which language does the owner primarily use with this person",
  "tone": "string - the general tone of the owner's messages to this person",
  "formality": "string - formality level of the owner's messages",
  "humorLevel": "string - humor level observed in the owner's messages",
  "typicalResponseLength": "string - typical response length pattern",
  "styleNotes": "string - concise notes about communication patterns, max 2-3 sentences"
}`

    const userMessages = existingProfile
      ? `Existing contact profile:\n${formatExistingProfile(existingProfile)}\n\n`
      : 'No existing profile for this contact.\n\n'

    const userContent = userMessages + `Recent conversation messages:\n${formatMessagesForAnalysis(history)}`

    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ]

    const response = await model.invoke(messages)
    const text = parseLLMResponse(response)

    return parseStyleObservation(text)
  } catch (error) {
    console.error('[Style Learning] Analysis failed:', (error as Error).message)
    return null
  }
}

function formatExistingProfile(profile: ContactProfile): string {
  const lines: string[] = []
  if (profile.preferredLanguage) lines.push(`Preferred language: ${profile.preferredLanguage}`)
  if (profile.tone) lines.push(`Tone: ${profile.tone}`)
  if (profile.formality) lines.push(`Formality: ${profile.formality}`)
  if (profile.humorLevel) lines.push(`Humor level: ${profile.humorLevel}`)
  if (profile.typicalResponseLength) lines.push(`Typical response length: ${profile.typicalResponseLength}`)
  if (profile.styleNotes) lines.push(`Style notes: ${profile.styleNotes}`)
  return lines.join('\n')
}

function formatMessagesForAnalysis(messages: Array<{ role: string; content: string }>): string {
  return messages.map(m => {
    const label = m.role === 'user' ? 'Samay' : 'Contact'
    return `[${label}]: ${m.content}`
  }).join('\n')
}

export function parseStyleObservation(text: string): ContactStyleObservation | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const observation: ContactStyleObservation = {}

    if (typeof parsed.preferredLanguage === 'string') observation.preferredLanguage = parsed.preferredLanguage
    if (typeof parsed.tone === 'string') observation.tone = parsed.tone
    if (typeof parsed.formality === 'string') observation.formality = parsed.formality
    if (typeof parsed.humorLevel === 'string') observation.humorLevel = parsed.humorLevel
    if (typeof parsed.typicalResponseLength === 'string') observation.typicalResponseLength = parsed.typicalResponseLength
    if (typeof parsed.styleNotes === 'string') observation.styleNotes = parsed.styleNotes

    const hasAnyField = Object.values(observation).some(v => v !== undefined)
    return hasAnyField ? observation : null
  } catch {
    return null
  }
}

export function mergeContactProfile(
  existing: ContactProfile | null,
  learned: ContactStyleObservation
): Omit<ContactProfile, 'stableId'> {
  const merged: Omit<ContactProfile, 'stableId'> = {
    displayName: existing?.displayName,
    relationship: existing?.relationship,
    preferredLanguage: existing?.preferredLanguage || learned.preferredLanguage,
    tone: existing?.tone || learned.tone,
    formality: existing?.formality || learned.formality,
    humorLevel: existing?.humorLevel || learned.humorLevel,
    typicalResponseLength: existing?.typicalResponseLength || learned.typicalResponseLength,
    styleNotes: mergeStyleNotes(existing?.styleNotes, learned.styleNotes),
  }

  return merged
}

export function mergeStyleNotes(existingNotes?: string, newNotes?: string): string | undefined {
  if (!existingNotes && !newNotes) return undefined
  if (!existingNotes) return newNotes
  if (!newNotes) return existingNotes

  const existingSet = new Set(
    existingNotes.split(/[.;]\s*/).filter(s => s.trim().length > 0).map(s => s.trim().toLowerCase())
  )

  const newItems = newNotes.split(/[.;]\s*/).filter(s => s.trim().length > 0)
  const uniqueNew = newItems.filter(item => !existingSet.has(item.trim().toLowerCase()))

  if (uniqueNew.length === 0) return existingNotes

  const trimmed = existingNotes.trim()
  const endsWithPunct = /[.;]$/.test(trimmed)
  const separator = endsWithPunct ? ' ' : '. '
  const joined = trimmed + separator + uniqueNew.join('. ')
  if (/[.;]$/.test(joined)) return joined
  return joined + '.'
}

export async function shouldLearnStyle(userId: string): Promise<boolean> {
  const count = await getUserMessageCount(userId)
  return count >= MIN_MESSAGES_FOR_STYLE_LEARNING && count % STYLE_LEARNING_INTERVAL === 0
}

export async function tryLearnContactStyle(userId: string): Promise<boolean> {
  try {
    const history = await getConversationHistory(userId, STYLE_LEARNING_HISTORY_LIMIT)
    if (history.length === 0) return false

    const userMessageCount = history.filter(m => m.role === 'user').length
    if (userMessageCount < MIN_MESSAGES_FOR_STYLE_LEARNING) {
      console.log(`[Style Learning] Skipping — only ${userMessageCount} user messages`)
      return false
    }

    const existingProfile = getContactProfile(userId)

    const observation = await analyzeContactStyle(userId, existingProfile, history)
    if (!observation) {
      console.log('[Style Learning] No meaningful changes detected')
      return false
    }

    const merged = mergeContactProfile(existingProfile, observation)

    const changed = Object.entries(merged).some(([key, value]) => {
      if (key === 'displayName' || key === 'relationship') return false
      const existingKey = key === 'preferredLanguage' ? 'preferredLanguage'
        : key === 'tone' ? 'tone'
        : key === 'formality' ? 'formality'
        : key === 'humorLevel' ? 'humorLevel'
        : key === 'typicalResponseLength' ? 'typicalResponseLength'
        : key === 'styleNotes' ? 'styleNotes'
        : null
      if (!existingKey) return false
      const existingValue = existingProfile ? (existingProfile as unknown as Record<string, unknown>)[existingKey] : undefined
      return value !== undefined && value !== existingValue
    })

    if (!changed) {
      console.log('[Style Learning] No meaningful changes detected')
      return false
    }

    updateContactProfile(userId, merged)
    console.log('[Style Learning] Profile updated')
    return true
  } catch (error) {
    console.error('[Style Learning] Failed — keeping existing profile:', (error as Error).message)
    return false
  }
}
