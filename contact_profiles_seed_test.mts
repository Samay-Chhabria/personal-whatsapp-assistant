import {
  initializeDatabase,
  seedContactProfiles,
  getContactProfile,
  upsertContactProfile,
  clearContactProfile,
  buildContactContext,
  addMemory,
  getPersonalFacts,
  addConversationMessage,
  getConversationHistory,
  clearMemory,
  closeDatabase,
} from './src/memory'
import {
  getConfiguredContactProfiles,
  getConfiguredContactProfile,
  toContactProfile,
} from './src/contactProfiles'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

initializeDatabase()

// --- Test 1: Empty configuration ---
console.log('=== Test 1: Empty configuration ===')
const configured = getConfiguredContactProfiles()
assert(Array.isArray(configured), 'should return array')
assert(configured.length === 0, 'should be empty by default')
console.log('Configured profiles:', configured.length)

// --- Test 2: getConfiguredContactProfile with no match ---
console.log('\n=== Test 2: No match for unknown stableId ===')
const unknown = getConfiguredContactProfile('nonexistent@s.whatsapp.net')
assert(unknown === undefined, 'should return undefined for unknown')
console.log('Unknown profile:', unknown)

// --- Test 3: toContactProfile converts correctly ---
console.log('\n=== Test 3: toContactProfile conversion ===')
const sample = {
  stableId: 'test@s.whatsapp.net',
  displayName: 'Test',
  relationship: 'friend',
  tone: 'casual',
}
const converted = toContactProfile(sample)
assert(converted.displayName === 'Test', 'displayName should match')
assert(converted.relationship === 'friend', 'relationship should match')
assert(converted.tone === 'casual', 'tone should match')
assert(!('stableId' in converted), 'stableId should not be in converted profile')
console.log('Converted:', converted)

// --- Test 4: Seed contact profiles into SQLite ---
console.log('\n=== Test 4: Seed into SQLite ===')
const seedProfiles = [
  { stableId: 'seed_friend_1', displayName: 'Friend1', relationship: 'close friend', tone: 'very casual', humorLevel: 'high' },
  { stableId: 'seed_colleague_1', displayName: 'Colleague1', relationship: 'colleague', tone: 'professional', formality: 'semi-formal' },
]
const seeded = seedContactProfiles(seedProfiles)
assert(seeded === 2, `should seed 2 profiles, got ${seeded}`)

const p1 = getContactProfile('seed_friend_1')
assert(p1 !== null, 'friend profile should exist')
assert(p1!.displayName === 'Friend1', 'friend displayName')
assert(p1!.tone === 'very casual', 'friend tone')
assert(p1!.humorLevel === 'high', 'friend humorLevel')

const p2 = getContactProfile('seed_colleague_1')
assert(p2 !== null, 'colleague profile should exist')
assert(p2!.displayName === 'Colleague1', 'colleague displayName')
assert(p2!.formality === 'semi-formal', 'colleague formality')
console.log('Seeded:', seeded)

// --- Test 5: Repeated seeding does not overwrite ---
console.log('\n=== Test 5: Repeated seeding ===')
upsertContactProfile('seed_friend_1', { tone: 'updated tone via manual edit' })
const beforeReseed = getContactProfile('seed_friend_1')
assert(beforeReseed!.tone === 'updated tone via manual edit', 'manual edit applied')

const reseeded = seedContactProfiles(seedProfiles)
assert(reseeded === 0, `should not re-seed, got ${reseeded}`)

const afterReseed = getContactProfile('seed_friend_1')
assert(afterReseed!.tone === 'updated tone via manual edit', 'manual edit preserved after reseed')
console.log('Repeated seeding safe')

// --- Test 6: Seed fills empty contact ---
console.log('\n=== Test 6: Seed fills empty contact ===')
upsertContactProfile('seed_empty', {})
const emptyBefore = getContactProfile('seed_empty')
assert(emptyBefore!.displayName === undefined, 'should be empty')

seedContactProfiles([{ stableId: 'seed_empty', displayName: 'Filled', relationship: 'new' }])
const emptyAfter = getContactProfile('seed_empty')
assert(emptyAfter!.displayName === 'Filled', 'should be filled')
assert(emptyAfter!.relationship === 'new', 'relationship should be filled')
console.log('Empty contact filled by seed')

// --- Test 7: Contact isolation ---
console.log('\n=== Test 7: Contact isolation ===')
assert(p1!.displayName !== p2!.displayName, 'different contacts should be isolated')
assert(p1!.tone !== p2!.tone, 'tones should differ')
console.log('Isolation preserved')

// --- Test 8: buildContactContext with seeded profile ---
console.log('\n=== Test 8: Context from seeded profile ===')
const ctx = buildContactContext(getContactProfile('seed_friend_1'))
assert(ctx.includes('CONTACT-SPECIFIC COMMUNICATION STYLE:'), 'should have header')
assert(ctx.includes('Relationship: close friend'), 'should include relationship')
assert(ctx.includes('Tone:'), 'should include tone')
console.log('Context:', ctx)

// --- Test 9: Existing memory functionality preserved ---
console.log('\n=== Test 9: Existing memory preserved ===')
await addMemory('seed_friend_1', 'name', 'TestName')
const facts = getPersonalFacts('seed_friend_1')
assert(facts.name === 'TestName', 'addMemory works')

addConversationMessage('seed_friend_1', 'user', 'hello')
const history = await getConversationHistory('seed_friend_1')
assert(history.length >= 1, 'conversation history works')

clearMemory('seed_friend_1')
const clearedFacts = getPersonalFacts('seed_friend_1')
assert(Object.keys(clearedFacts).length === 0, 'clearMemory works')
console.log('Memory APIs intact')

// --- Test 10: Persistence across restart ---
console.log('\n=== Test 10: Persistence ===')
closeDatabase()
initializeDatabase()
const persisted = getContactProfile('seed_friend_1')
assert(persisted !== null, 'profile should persist')
assert(persisted!.displayName === 'Friend1', 'displayName should persist')
console.log('Persistence confirmed')

closeDatabase()

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
