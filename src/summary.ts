import { getChatModel, parseLLMResponse } from './llm'
import {
  getMessageCount,
  getConversationSummary,
  upsertConversationSummary,
  getSummaryRecord,
  getAllConversationMessages,
  getConversationMessagesAfter,
  ConversationSummaryRecord,
} from './memory'

// --- Configuration ---

export const SUMMARY_TRIGGER_MESSAGES = 50
export const SUMMARY_HISTORY_WINDOW = 40

// --- Summary Prompt ---

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer. Your task is to create a concise, factual summary of the conversation history between an AI assistant and a user.

RULES:
- Write from the assistant's perspective using first person ("I" for assistant, "user" for the person talking to the assistant)
- Focus on durable context: important discussions, ongoing projects, plans, decisions, unresolved issues, and relevant relationship/context information
- Do NOT summarize trivial messages or greetings unless they contain meaningful context
- Do NOT duplicate information that would be in structured contact memories (name, age, basic facts)
- Keep the summary concise (10-20 sentences maximum)
- Be factual - do not invent or infer information not present in the conversation
- Do not include timestamps or message counts
- Do not mention that you are summarizing or reference this summary process
- Write in natural, flowing prose

OUTPUT FORMAT:
Return ONLY the summary text. Do not include any headers, labels, or formatting markers.`

function buildSummaryPrompt(existingSummary: string | null, conversationText: string): string {
  if (existingSummary) {
    return `EXISTING SUMMARY:
${existingSummary}

RECENT CONVERSATION:
${conversationText}

Update the summary to incorporate any new information from the recent conversation. Maintain important context from the existing summary while adding new relevant details. Remove any information that is no longer relevant.`
  }

  return `CONVERSATION:
${conversationText}

Create a summary of this conversation focusing on important context that would be useful for future interactions.`
}

// --- Helper ---

function formatConversationForSummary(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map(m => {
      const speaker = m.role === 'assistant' ? 'Assistant' : 'User'
      return `${speaker}: ${m.content}`
    })
    .join('\n')
}

// --- Public API ---

export function shouldGenerateSummary(userId: string): boolean {
  const messageCount = getMessageCount(userId)
  return messageCount > 0 && messageCount % SUMMARY_TRIGGER_MESSAGES === 0
}

// Selects the messages that should be summarized next.
// - No existing summary/watermark => the complete available history (first run).
// - Existing summary/watermark    => only messages after the watermark (delta).
export function getMessagesForSummary(
  userId: string,
  existing: ConversationSummaryRecord | null,
): Array<{ id: number; role: string; content: string }> {
  if (!existing) {
    return getAllConversationMessages(userId)
  }
  return getConversationMessagesAfter(userId, existing.lastSummarizedMessageId ?? 0)
}

// Test seam: allows deterministic injection of the model response without an
// API key. Defaults to the real OpenRouter chat model.
let summaryModelFn: (messages: Array<{ role: string; content: string }>) => Promise<string> = async (
  messages,
) => {
  const model = getChatModel()
  const response = await model.invoke(messages)
  return parseLLMResponse(response)
}

export function setSummaryModelFn(
  fn: (messages: Array<{ role: string; content: string }>) => Promise<string>,
): void {
  summaryModelFn = fn
}

export async function generateConversationSummary(userId: string): Promise<void> {
  try {
    const existing = getSummaryRecord(userId)
    const messages = getMessagesForSummary(userId, existing)

    if (messages.length === 0) {
      return
    }

    // Watermark advances only to the newest message actually included.
    const newWatermark = messages[messages.length - 1].id
    const existingSummary = existing ? existing.summary : null
    const conversationText = formatConversationForSummary(messages)
    const prompt = buildSummaryPrompt(existingSummary, conversationText)

    const newSummary = (
      await summaryModelFn([
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ])
    ).trim()

    // Only persist + advance the watermark on a successful (non-empty) summary.
    // On failure or empty output, the watermark is left unchanged.
    if (newSummary && newSummary.length > 0) {
      upsertConversationSummary(userId, newSummary, newWatermark)
      console.log(`[Summary] Updated summary for user ${userId}`)
    }
  } catch (error) {
    console.error('[Summary] Failed to generate summary:', (error as Error).message)
  }
}

export function buildSummaryContext(summary: string | null): string {
  if (!summary) return ''

  return `---\nCONVERSATION SUMMARY:\n\nThe following is a summary of prior conversation history with this contact. Use this to maintain continuity and reference important context from past discussions.\n\n${summary}\n\nUse this summary naturally when relevant to the current conversation. Do not explicitly reference that you have a summary unless asked.\n---`
}
