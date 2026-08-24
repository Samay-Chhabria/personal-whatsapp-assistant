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

const OWNER_PROFILE: OwnerProfile = {
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
