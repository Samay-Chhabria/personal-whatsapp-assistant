import { InMemoryChatMessageHistory } from '@langchain/core/chat_history'

const memoryStore = new Map<string, {
  history: InMemoryChatMessageHistory
  facts: Map<string, unknown>
}>()

function getUserMemory(userId: string): {
  history: InMemoryChatMessageHistory
  facts: Map<string, unknown>
} {
  if (!memoryStore.has(userId)) {
    memoryStore.set(userId, {
      history: new InMemoryChatMessageHistory(),
      facts: new Map(),
    })
  }
  return memoryStore.get(userId)!
}

export function getMemory(userId: string) {
  return getUserMemory(userId)
}

export function addMemory(userId: string, key: string, value: unknown) {
  const { facts } = getUserMemory(userId)
  facts.set(key, value)
}

export function getPersonalFacts(userId: string): Record<string, unknown> {
  const { facts } = getUserMemory(userId)
  const result: Record<string, unknown> = {}
  facts.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export function addConversationMessage(userId: string, role: string, content: string) {
  const { history } = getUserMemory(userId)

  if (role === 'user' || role === 'human') {
    history.addUserMessage(content)
  } else if (role === 'assistant' || role === 'ai') {
    history.addAIMessage(content)
  } else {
    history.addMessage({ role, content } as any)
  }
}

export async function getConversationHistory(userId: string): Promise<Array<{ role: string; content: string }>> {
  const { history } = getUserMemory(userId)
  const messages = await history.getMessages()
  return messages.map((msg: any) => ({
    role: msg.role || 'unknown',
    content: msg.content || '',
  }))
}

export function clearMemory(userId: string) {
  memoryStore.delete(userId)
}

export { extractPersonalFacts, isFactAbout } from './extraction'