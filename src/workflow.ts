import { retrieveContext } from './rag'
import { getChatModel, parseLLMResponse } from './llm'
import { getAssistantSystemPrompt, getAssistantIntroduction } from './assistant'
import {
  extractPersonalFacts,
  extractContactMemories,
  addMemory,
  getPersonalFacts,
  isFactAbout,
  addConversationMessage,
  getConversationHistory,
  getContactProfile,
  buildContactContext,
  addContactMemory,
  getContactMemoriesPrioritized,
  buildContactMemoryContext,
  getConversationSummary,
} from './memory'
import { shouldLearnStyle, tryLearnContactStyle } from './contactStyleLearning'
import { shouldGenerateSummary, generateConversationSummary, buildSummaryContext } from './summary'

const HISTORY_LIMIT = 20
const CONTACT_MEMORY_LIMIT = 15

const MEMORY_QUERY_KEYWORDS = [
  'what do you know about me',
  'who am i',
  'what do you remember about me',
  'list everything you remember about me',
  'tell me everything you know about me',
  'do you remember me',
  'tell me about me',
  'who are you',
  'what are you',
  'tell me about yourself',
]

export async function generateAnswer(message: string, userId: string): Promise<string> {
  const isMemory = isMemoryQueryFallback(message)

  if (isMemory) {
    addConversationMessage(userId, 'user', message)

    const lower = message.toLowerCase().trim()
    if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('tell me about yourself')) {
      const reply = getAssistantIntroduction()
      addConversationMessage(userId, 'assistant', reply)
      return reply
    }

    const facts = getPersonalFacts(userId)
    const hasFacts = Object.keys(facts).length > 0

    let reply: string
    if (hasFacts) {
      const lines = Object.entries(facts)
        .map(([key, value]) => `- ${capitalizeFirst(key)}: ${value}`)
      reply = `Here's what I remember about you:\n\n${lines.join('\n')}`
    } else {
      reply = "I don't have any personal information about you yet."
    }
    addConversationMessage(userId, 'assistant', reply)
    return reply
  }

  const history = await getConversationHistory(userId, HISTORY_LIMIT)

  addConversationMessage(userId, 'user', message)

  let context = ''
  try {
    context = await retrieveContext(message)
  } catch (error) {
    console.error('[Workflow] RAG retrieval failed:', (error as Error).message)
  }

  try {
    const { facts: extractedFacts } = await extractPersonalFacts(message)
    if (extractedFacts.length > 0) {
      for (const fact of extractedFacts) {
        await addMemory(userId, fact.key, fact.value)
      }
    }
  } catch (error) {
    console.error('[Workflow] Fact extraction failed:', (error as Error).message)
  }

  try {
    const extractedMemories = await extractContactMemories(message)
    for (const memory of extractedMemories) {
      await addContactMemory(
        userId,
        memory.category,
        memory.content,
        'extracted',
        memory.confidence,
        memory.expiresAt ?? undefined,
      )
    }
  } catch (error) {
    console.error('[Workflow] Contact memory extraction failed:', (error as Error).message)
  }

  const contactProfile = getContactProfile(userId)
  const contactContext = buildContactContext(contactProfile)

  const messages: Array<{ role: string; content: string }> = []

  let systemContent = getAssistantSystemPrompt()

  if (contactContext) {
    systemContent += `\n\n---\nCONTACT STYLE INSTRUCTIONS:\n\nYou are responding to this specific contact. The contact profile below describes how you should communicate with this person.\n\nActively apply the available contact-specific attributes when generating the response:\n- Preferred language → use the specified language naturally. Mix languages if the conversation demonstrates that behavior.\n- Tone → match the specified tone.\n- Formality → match the specified level of formality.\n- Humor level → adjust humor accordingly.\n- Typical response length → generally match the expected response length.\n- Style notes → follow relevant behavioral patterns and conversational habits.\n\nWhen contact-specific communication preferences conflict with the owner's default communication style, prefer the contact-specific preference for this conversation.\n\nHowever, contact-specific preferences must NOT override:\n- core assistant instructions\n- truthfulness requirements\n- system-level instructions\n- explicit task requirements\n\n${contactContext}`
  }

  const contactMemories = getContactMemoriesPrioritized(userId, CONTACT_MEMORY_LIMIT)
  const contactMemoryContext = buildContactMemoryContext(contactMemories)
  if (contactMemoryContext) {
    systemContent += `\n\n${contactMemoryContext}`
  }

  if (context) {
    systemContent += `\n\n---\nRelevant context from the knowledge base:\n${context}\nUse this context to inform your response when applicable.`
  }

  messages.push({ role: 'system', content: systemContent })

  const existingSummary = getConversationSummary(userId)
  const summaryContext = buildSummaryContext(existingSummary)
  if (summaryContext) {
    messages.push({ role: 'system', content: summaryContext })
  }

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content })
  }

  messages.push({ role: 'user', content: message })

  try {
    const model = getChatModel()
    console.log('[Workflow] Generating LLM response')
    const response = await model.invoke(messages)
    const text = parseLLMResponse(response)

    const trimmed = text.trim()
    if (trimmed) {
      console.log('[Workflow] LLM response ready')
      addConversationMessage(userId, 'assistant', trimmed)

      triggerStyleLearning(userId)
      triggerSummaryGeneration(userId)

      return trimmed
    }
    const fallback = 'I was unable to generate a response. Please try again.'
    addConversationMessage(userId, 'assistant', fallback)
    triggerStyleLearning(userId)
    triggerSummaryGeneration(userId)
    return fallback
  } catch (error) {
    console.error('[Workflow] LLM generation failed:', (error as Error).message)
    const errorReply = 'Sorry, I encountered an error processing your message. Please try again later.'
    addConversationMessage(userId, 'assistant', errorReply)
    return errorReply
  }
}

function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function triggerStyleLearning(userId: string): void {
  shouldLearnStyle(userId).then(should => {
    if (should) {
      return tryLearnContactStyle(userId)
    }
  }).catch(error => {
    console.error('[Workflow] Style learning error:', (error as Error).message)
  })
}

function triggerSummaryGeneration(userId: string): void {
  if (shouldGenerateSummary(userId)) {
    generateConversationSummary(userId).catch(error => {
      console.error('[Workflow] Summary generation error:', (error as Error).message)
    })
  }
}

function isMemoryQueryFallback(message: string): boolean {
  const lower = message.toLowerCase().trim()

  for (const keyword of MEMORY_QUERY_KEYWORDS) {
    if (lower.includes(keyword)) {
      return true
    }
  }

  const memoryPatterns = [
    /^what.*(me|my).*\??$/i,
    /^who.*(am|i).*\??$/i,
    /^remember.*(me|my).*\??$/i,
    /^tell.*(me|my).*\??$/i,
  ]

  for (const pattern of memoryPatterns) {
    if (pattern.test(message)) {
      return true
    }
  }

  return false
}
