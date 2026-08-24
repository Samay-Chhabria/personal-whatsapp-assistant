import type { ContactProfile } from './memory'

export interface ConfiguredContactProfile {
  stableId: string
  displayName?: string
  relationship?: string
  preferredLanguage?: string
  tone?: string
  formality?: string
  humorLevel?: string
  typicalResponseLength?: string
  styleNotes?: string
}

// Add your configured contact profiles below.
// Use the WhatsApp stableId (JID) for each contact.
//
// Example:
// {
//   stableId: '1234567890@s.whatsapp.net',
//   displayName: 'Ali',
//   relationship: 'close friend',
//   preferredLanguage: 'Roman Urdu + English',
//   tone: 'casual and playful',
//   formality: 'very informal',
//   humorLevel: 'high',
//   typicalResponseLength: 'short',
//   styleNotes: 'Uses teasing and casual expressions.',
// }

const CONFIGURED_CONTACTS: ConfiguredContactProfile[] = []

export function getConfiguredContactProfiles(): ConfiguredContactProfile[] {
  return [...CONFIGURED_CONTACTS]
}

export function getConfiguredContactProfile(stableId: string): ConfiguredContactProfile | undefined {
  return CONFIGURED_CONTACTS.find(c => c.stableId === stableId)
}

export function toContactProfile(configured: ConfiguredContactProfile): Omit<ContactProfile, 'stableId'> {
  return {
    displayName: configured.displayName,
    relationship: configured.relationship,
    preferredLanguage: configured.preferredLanguage,
    tone: configured.tone,
    formality: configured.formality,
    humorLevel: configured.humorLevel,
    typicalResponseLength: configured.typicalResponseLength,
    styleNotes: configured.styleNotes,
  }
}
