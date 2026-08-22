import { retrieveContext } from './rag'
import { getChatModel } from './llm'
import { extractPersonalFacts, addMemory, getPersonalFacts, isFactAbout } from './memory'

const ALLOWED_FACT_KEYS = [
  'name',
  'age',
  'city',
  'profession',
  'favorite food',
  'hobbies',
  'preferences',
]

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
    const lower = message.toLowerCase().trim()
    if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('tell me about yourself')) {
      return "I'm a helpful WhatsApp chatbot assistant powered by AI. I can answer questions from my knowledge base and remember things you tell me. How can I help you?"
    }

    const facts = getPersonalFacts(userId)
    const hasFacts = Object.keys(facts).length > 0

    if (hasFacts) {
      const lines = Object.entries(facts)
        .map(([key, value]) => `- ${capitalizeFirst(key)}: ${value}`)
      return `Here's what I remember about you:\n\n${lines.join('\n')}`
    } else {
      return "I don't have any personal information about you yet."
    }
  }

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
        addMemory(userId, fact.key, fact.value)
      }
    }
  } catch (error) {
    console.error('[Workflow] Fact extraction failed:', (error as Error).message)
  }

  let prompt: string
  if (context) {
    prompt = `Relevant context from the knowledge base:
${context}

Question: ${message}

Instructions:
- Use the context above to answer the question
- If the context does not contain the answer, say "The information is not available in the knowledge base."
- Do not invent facts not supported by the retrieved context.`
  } else {
    prompt = `You are a helpful WhatsApp chatbot assistant. Answer the following question directly and concisely.

Question: ${message}

Instructions:
- Be helpful and conversational
- Keep responses concise and suitable for WhatsApp
- Do not invent facts`
  }

  try {
    const model = getChatModel()
    console.log('[Workflow] Generating LLM response')
    const response = await model.invoke([{ role: 'user', content: prompt }])

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
    if (trimmed) {
      console.log('[Workflow] LLM response ready')
      return trimmed
    }
    return 'I was unable to generate a response. Please try again.'
  } catch (error) {
    console.error('[Workflow] LLM generation failed:', (error as Error).message)
    return 'Sorry, I encountered an error processing your message. Please try again later.'
  }
}

function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
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
