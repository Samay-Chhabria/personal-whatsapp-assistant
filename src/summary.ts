import { getChatModel, parseLLMResponse } from './llm'
import {
  getConversationHistory,
  getMessageCount,
  getConversationSummary,
  upsertConversationSummary,
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

export async function generateConversationSummary(userId: string): Promise<void> {
  try {
    const existingSummary = getConversationSummary(userId)
    const history = await getConversationHistory(userId, SUMMARY_HISTORY_WINDOW)

    if (history.length === 0) {
      return
    }

    const conversationText = formatConversationForSummary(history)
    const prompt = buildSummaryPrompt(existingSummary, conversationText)

    const model = getChatModel()
    const response = await model.invoke([
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ])

    const newSummary = parseLLMResponse(response).trim()

    if (newSummary && newSummary.length > 0) {
      upsertConversationSummary(userId, newSummary)
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
