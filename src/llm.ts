import { ChatOpenRouter } from '@langchain/openrouter'
import dotenv from 'dotenv'

dotenv.config()

let chatModel: ChatOpenRouter | null = null

export function initializeChatModel(): ChatOpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY
  const modelName = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free'

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  chatModel = new ChatOpenRouter({
    apiKey: apiKey,
    model: modelName,
    temperature: 0.7,
  })

  console.log(`[LLM] Initialized with model: ${modelName}`)
  return chatModel
}

export function getChatModel(): ChatOpenRouter {
  if (!chatModel) {
    initializeChatModel()
  }
  if (!chatModel) {
    throw new Error('Chat model could not be initialized')
  }
  return chatModel
}

export function resetChatModel() {
  chatModel = null
}

export function parseLLMResponse(response: unknown): string {
  if (typeof response === 'object' && response !== null && 'content' in response) {
    const res = response as { content: unknown }
    if (Array.isArray(res.content)) {
      return res.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text || '')
        .join(' ')
    } else {
      return String(res.content)
    }
  }
  return String(response)
}

export async function generateResponse(message: string): Promise<string> {
  const model = getChatModel()

  try {
    console.log('[LLM] Generating response')
    const response = await model.invoke([{ role: 'user', content: message }])
    const text = parseLLMResponse(response)
    console.log('[LLM] Response generated')
    return text.trim()
  } catch (error: any) {
    console.error('[LLM] Error:', error?.message || error)
    if (error?.message?.includes('unavailable') || error?.message?.includes('not a valid model')) {
      console.error('[LLM] Model may be unavailable, consider updating OPENROUTER_MODEL in .env')
    }
    throw new Error('Failed to generate AI response: ' + (error?.message || 'Unknown error'))
  }
}
