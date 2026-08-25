export interface OwnerProfile {
  name?: string
  preferredName?: string
  occupation?: string
  university?: string
  location?: string
  languages?: string[]
  communicationStyle?: string
  personality?: string[]
  interests?: string[]
  commonExpressions?: string[]
  additionalContext?: string
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

function loadOwnerProfile(): OwnerProfile {
  const envName = process.env.OWNER_NAME
  const envPreferredName = process.env.OWNER_PREFERRED_NAME
  const envOccupation = process.env.OWNER_OCCUPATION
  const envUniversity = process.env.OWNER_UNIVERSITY
  const envLocation = process.env.OWNER_LOCATION
  const envLanguages = parseJsonArray(process.env.OWNER_LANGUAGES)
  const envCommunicationStyle = process.env.OWNER_COMMUNICATION_STYLE
  const envPersonality = parseJsonArray(process.env.OWNER_PERSONALITY)
  const envInterests = parseJsonArray(process.env.OWNER_INTERESTS)
  const envCommonExpressions = parseJsonArray(process.env.OWNER_COMMON_EXPRESSIONS)
  const envAdditionalContext = process.env.OWNER_ADDITIONAL_CONTEXT

  const hasEnvValues = envName || envPreferredName || envOccupation || envUniversity ||
    envLocation || envLanguages || envCommunicationStyle || envPersonality || envInterests ||
    envCommonExpressions || envAdditionalContext

  if (hasEnvValues) {
    return {
      name: envName,
      preferredName: envPreferredName,
      occupation: envOccupation,
      university: envUniversity,
      location: envLocation,
      languages: envLanguages,
      communicationStyle: envCommunicationStyle,
      personality: envPersonality,
      interests: envInterests,
      commonExpressions: envCommonExpressions,
      additionalContext: envAdditionalContext,
    }
  }

  return {
    name: 'Samay Kumar',
    preferredName: 'Samay',
    occupation: 'Computer Science student',
    university: 'FAST-NUCES',
    location: 'Pakistan',
    languages: ['English', 'Urdu', 'Roman Urdu', 'Roman Sindhi'],
    communicationStyle: 'Casual, concise, conversational, natural. Prefer short WhatsApp-style responses instead of long paragraphs unless the situation requires detail.',
    personality: [
      'Friendly',
      'Direct',
      'Curious about technology',
      'Practical',
      'Likes understanding how things work',
      'Prefers straightforward explanations',
      'Does not normally write overly formal messages',
    ],
    interests: [
      'Software development',
      'Artificial intelligence',
      'Machine learning',
      'Data science',
      'Programming',
      'Technology',
    ],
    additionalContext: 'The assistant is being developed as a personal WhatsApp assistant that will eventually help the owner respond to WhatsApp conversations.',
  }
}

const OWNER_PROFILE: OwnerProfile = loadOwnerProfile()

export function getOwnerProfile(): OwnerProfile {
  return { ...OWNER_PROFILE }
}

export function buildOwnerContext(): string {
  const profile = getOwnerProfile()
  const lines: string[] = []

  if (profile.name) lines.push(`- Name: ${profile.name}`)
  if (profile.preferredName) lines.push(`- Preferred name: ${profile.preferredName}`)
  if (profile.occupation) lines.push(`- Occupation: ${profile.occupation}`)
  if (profile.university) lines.push(`- University: ${profile.university}`)
  if (profile.location) lines.push(`- Location: ${profile.location}`)
  if (profile.languages?.length) lines.push(`- Languages: ${profile.languages.join(', ')}`)
  if (profile.communicationStyle) lines.push(`- Communication style: ${profile.communicationStyle}`)
  if (profile.personality?.length) lines.push(`- Personality: ${profile.personality.join(', ')}`)
  if (profile.interests?.length) lines.push(`- Interests: ${profile.interests.join(', ')}`)
  if (profile.commonExpressions?.length) lines.push(`- Common expressions: ${profile.commonExpressions.join(', ')}`)
  if (profile.additionalContext) lines.push(`- Additional context: ${profile.additionalContext}`)

  if (lines.length === 0) return ''

  return `OWNER PROFILE:\n${lines.join('\n')}`
}
