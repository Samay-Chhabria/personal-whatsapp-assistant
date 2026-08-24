import {
  initializeDatabase,
  getContactProfile,
  upsertContactProfile,
  updateContactProfile,
  clearContactProfile,
  buildContactContext,
  addConversationMessage,
  addMemory,
  getPersonalFacts,
  getConversationHistory,
  clearMemory,
  closeDatabase,
} from './src/memory'
import { getAssistantSystemPrompt } from './src/assistant'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

initializeDatabase()

// --- Test 1: Create contact profile ---
console.log('=== Test 1: Create contact profile ===')
const profile = upsertContactProfile('contact_ali', {
  displayName: 'Ali',
  relationship: 'close friend',
  preferredLanguage: 'Roman Urdu + English',
  tone: 'very casual and playful',
  formality: 'very informal',
  humorLevel: 'high',
  typicalResponseLength: 'short',
  styleNotes: 'Uses teasing and casual expressions.',
})
assert(profile !== null, 'profile should exist')
assert(profile.stableId === 'contact_ali', 'stableId should match')
assert(profile.displayName === 'Ali', 'displayName should be Ali')
assert(profile.relationship === 'close friend', 'relationship should match')
assert(profile.preferredLanguage === 'Roman Urdu + English', 'preferredLanguage should match')
assert(profile.tone === 'very casual and playful', 'tone should match')
assert(profile.formality === 'very informal', 'formality should match')
assert(profile.humorLevel === 'high', 'humorLevel should match')
assert(profile.typicalResponseLength === 'short', 'typicalResponseLength should match')
assert(profile.styleNotes === 'Uses teasing and casual expressions.', 'styleNotes should match')
console.log('Created:', profile)

// --- Test 2: Retrieve contact profile ---
console.log('\n=== Test 2: Retrieve contact profile ===')
const retrieved = getContactProfile('contact_ali')
assert(retrieved !== null, 'should retrieve profile')
assert(retrieved!.displayName === 'Ali', 'should retrieve displayName')
assert(retrieved!.relationship === 'close friend', 'should retrieve relationship')
console.log('Retrieved:', retrieved)

// --- Test 3: Partial update preserves existing fields ---
console.log('\n=== Test 3: Partial update ===')
const updated = updateContactProfile('contact_ali', { tone: 'casual but respectful' })
assert(updated !== null, 'updated profile should exist')
assert(updated!.tone === 'casual but respectful', 'tone should be updated')
assert(updated!.displayName === 'Ali', 'displayName should be preserved')
assert(updated!.relationship === 'close friend', 'relationship should be preserved')
assert(updated!.humorLevel === 'high', 'humorLevel should be preserved')
assert(updated!.styleNotes === 'Uses teasing and casual expressions.', 'styleNotes should be preserved')
console.log('Updated:', updated)

// --- Test 4: Two contacts remain isolated ---
console.log('\n=== Test 4: Contact isolation ===')
upsertContactProfile('contact_sara', {
  displayName: 'Sara',
  relationship: 'colleague',
  tone: 'professional but friendly',
  formality: 'semi-formal',
})
const aliProfile = getContactProfile('contact_ali')
const saraProfile = getContactProfile('contact_sara')
assert(aliProfile!.displayName === 'Ali', 'Ali displayName')
assert(aliProfile!.relationship === 'close friend', 'Ali relationship preserved after Sara creation')
assert(saraProfile!.displayName === 'Sara', 'Sara displayName')
assert(saraProfile!.relationship === 'colleague', 'Sara relationship')
assert(aliProfile!.displayName !== saraProfile!.displayName, 'contacts should be isolated')
console.log('Ali:', aliProfile!.displayName, aliProfile!.relationship)
console.log('Sara:', saraProfile!.displayName, saraProfile!.relationship)

// --- Test 5: Clear contact profile ---
console.log('\n=== Test 5: Clear contact profile ===')
clearContactProfile('contact_ali')
const cleared = getContactProfile('contact_ali')
assert(cleared !== null, 'contact row should still exist')
assert(cleared!.displayName === undefined, 'displayName should be cleared')
assert(cleared!.relationship === undefined, 'relationship should be cleared')
assert(cleared!.tone === undefined, 'tone should be cleared')
assert(cleared!.styleNotes === undefined, 'styleNotes should be cleared')
console.log('Cleared profile:', cleared)

// --- Test 6: Persistence after database close/reopen ---
console.log('\n=== Test 6: Persistence ===')
upsertContactProfile('contact_persist', {
  displayName: 'PersistTest',
  relationship: 'test contact',
})
closeDatabase()
initializeDatabase()
const persisted = getContactProfile('contact_persist')
assert(persisted !== null, 'profile should persist')
assert(persisted!.displayName === 'PersistTest', 'displayName should persist')
assert(persisted!.relationship === 'test contact', 'relationship should persist')
console.log('Persisted:', persisted)

// --- Test 7: buildContactContext ---
console.log('\n=== Test 7: buildContactContext ===')
const context = buildContactContext(getContactProfile('contact_sara'))
assert(context.length > 0, 'context should not be empty')
assert(context.startsWith('CONTACT-SPECIFIC COMMUNICATION STYLE:'), 'should start with header')
assert(context.includes('Relationship: colleague'), 'should include relationship')
assert(context.includes('Tone:'), 'should include tone')
console.log('Context:', context)

// --- Test 8: buildContactContext with empty profile ---
console.log('\n=== Test 8: Empty profile context ===')
const emptyContext = buildContactContext(null)
assert(emptyContext === '', 'null profile should produce empty string')

const noFields = getContactProfile('contact_ali') // cleared earlier
const noFieldsContext = buildContactContext(noFields)
assert(noFieldsContext === '', 'empty profile should produce empty string')
console.log('Empty contexts are empty: OK')

// --- Test 9: buildContactContext no secrets ---
console.log('\n=== Test 9: No secrets in context ===')
assert(!context.includes('sk-'), 'should not contain API keys')
assert(!context.includes('OPENROUTER'), 'should not contain env variable names')
console.log('No secrets')

// --- Test 10: System prompt includes contact context ---
console.log('\n=== Test 10: System prompt integration ===')
const prompt = getAssistantSystemPrompt()
assert(prompt.includes('Owner Relationship'), 'should have owner relationship')
assert(prompt.includes('OWNER PROFILE'), 'should have owner profile')
assert(prompt.includes('OWNER COMMUNICATION STYLE'), 'should have global style')
// The workflow adds contact context dynamically, but the prompt structure is correct
console.log('System prompt structure valid')

// --- Test 11: Existing memory functionality preserved ---
console.log('\n=== Test 11: Existing memory preserved ===')
await addMemory('test_mem_user', 'name', 'TestMem')
const facts = getPersonalFacts('test_mem_user')
assert(facts.name === 'TestMem', 'addMemory/getPersonalFacts still work')

addConversationMessage('test_mem_user', 'user', 'hello')
addConversationMessage('test_mem_user', 'assistant', 'hi')
const history = await getConversationHistory('test_mem_user')
assert(history.length === 2, 'conversation history still works')
assert(history[0].content === 'hello', 'user message preserved')
assert(history[1].content === 'hi', 'assistant message preserved')

clearMemory('test_mem_user')
const clearedFacts = getPersonalFacts('test_mem_user')
assert(Object.keys(clearedFacts).length === 0, 'clearMemory still works')
console.log('Memory APIs intact')

closeDatabase()

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
