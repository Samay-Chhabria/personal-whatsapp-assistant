export interface CommunicationStyle {
  tone?: string
  defaultResponseLength?: string
  formality?: string
  languagePreference?: string
  romanUrduUsage?: string
  romanSindhiUsage?: string
  emojiUsage?: string
  punctuationStyle?: string
  conversationalBehavior?: string[]
  responsePatterns?: string[]
}

function parseJsonArray(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every(v => typeof v === 'string')) {
      return parsed
    }
    return undefined
  } catch {
    return undefined
  }
}

function loadCommunicationStyle(): CommunicationStyle {
  const envTone = process.env.OWNER_STYLE_TONE
  const envDefaultResponseLength = process.env.OWNER_STYLE_DEFAULT_RESPONSE_LENGTH
  const envFormality = process.env.OWNER_STYLE_FORMALITY
  const envLanguagePreference = process.env.OWNER_STYLE_LANGUAGE_PREFERENCE
  const envRomanUrduUsage = process.env.OWNER_STYLE_ROMAN_URDU_USAGE
  const envRomanSindhiUsage = process.env.OWNER_STYLE_ROMAN_SINDHI_USAGE
  const envEmojiUsage = process.env.OWNER_STYLE_EMOJI_USAGE
  const envPunctuationStyle = process.env.OWNER_STYLE_PUNCTUATION_STYLE
  const envConversationalBehavior = parseJsonArray(process.env.OWNER_STYLE_CONVERSATIONAL_BEHAVIOR)
  const envResponsePatterns = parseJsonArray(process.env.OWNER_STYLE_RESPONSE_PATTERNS)

  const hasEnvValues = envTone || envDefaultResponseLength || envFormality || envLanguagePreference ||
    envRomanUrduUsage || envRomanSindhiUsage || envEmojiUsage || envPunctuationStyle ||
    envConversationalBehavior || envResponsePatterns

  if (hasEnvValues) {
    return {
      tone: envTone,
      defaultResponseLength: envDefaultResponseLength,
      formality: envFormality,
      languagePreference: envLanguagePreference,
      romanUrduUsage: envRomanUrduUsage,
      romanSindhiUsage: envRomanSindhiUsage,
      emojiUsage: envEmojiUsage,
      punctuationStyle: envPunctuationStyle,
      conversationalBehavior: envConversationalBehavior,
      responsePatterns: envResponsePatterns,
    }
  }

  return {
    tone: 'Casual, friendly, direct',
    defaultResponseLength: 'Short — prefer concise replies unless the situation requires more detail',
    formality: 'Informal for normal WhatsApp conversations; more formal only when the context clearly requires it',
    languagePreference: 'English, Urdu, Roman Urdu, and Roman Sindhi are all acceptable. Mixing languages is allowed when it matches the conversational context.',
    romanUrduUsage: 'Allowed and may be used naturally when appropriate. Do not force Roman Urdu into every message.',
    romanSindhiUsage: 'Allowed and may be used naturally when appropriate. Do not invent Sindhi expressions, slang, or spellings that have not been provided or learned from explicit owner examples.',
    emojiUsage: 'Use sparingly and naturally. Do not add emojis to every message.',
    punctuationStyle: 'Natural WhatsApp-style punctuation. Do not make every message look like formal written prose.',
    conversationalBehavior: [
      'Prefer concise answers',
      'Avoid unnecessary explanations',
      'Avoid overly polished corporate language',
      "Don't restate the user's question unnecessarily",
      'Respond naturally rather than sounding like an assistant or customer-service bot',
      'Match the conversational context',
      'Use longer responses only when the situation requires them',
      'Match the language used by the other person when appropriate',
      'If the conversation naturally mixes languages, the assistant may do the same',
      'Do not randomly switch languages',
    ],
    responsePatterns: undefined,
  }
}

const OWNER_COMMUNICATION_STYLE: CommunicationStyle = loadCommunicationStyle()

export function getCommunicationStyle(): CommunicationStyle {
  return { ...OWNER_COMMUNICATION_STYLE }
}

export function buildCommunicationStyleContext(): string {
  const style = getCommunicationStyle()
  const lines: string[] = []

  if (style.tone) lines.push(`- Tone: ${style.tone}`)
  if (style.defaultResponseLength) lines.push(`- Default response length: ${style.defaultResponseLength}`)
  if (style.formality) lines.push(`- Formality: ${style.formality}`)
  if (style.languagePreference) lines.push(`- Language: ${style.languagePreference}`)
  if (style.romanUrduUsage) lines.push(`- Roman Urdu: ${style.romanUrduUsage}`)
  if (style.romanSindhiUsage) lines.push(`- Roman Sindhi: ${style.romanSindhiUsage}`)
  if (style.emojiUsage) lines.push(`- Emoji usage: ${style.emojiUsage}`)
  if (style.punctuationStyle) lines.push(`- Punctuation: ${style.punctuationStyle}`)
  if (style.conversationalBehavior?.length) {
    lines.push('- Conversational behavior:')
    for (const b of style.conversationalBehavior) {
      lines.push(`  - ${b}`)
    }
  }
  if (style.responsePatterns?.length) lines.push(`- Response patterns: ${style.responsePatterns.join(', ')}`)

  if (lines.length === 0) return ''

  return `OWNER COMMUNICATION STYLE:\n${lines.join('\n')}`
}
