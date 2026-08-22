import { getChatModel } from './llm'

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
