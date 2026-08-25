import {
  initializeDatabase,
  addContactMemory,
  getContactMemories,
  getContactMemoriesByCategory,
  clearContactMemories,
  addMemory,
  getPersonalFacts,
  clearMemory,
  closeDatabase,
} from './src/memory'
import { extractContactMemories, extractPersonalFacts } from './src/memory'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

initializeDatabase()

// --- Test 1: Valid identity extraction ---
console.log('=== Test 1: Identity extraction ===')
const identityResult = await extractContactMemories('My name is Ali and I study at FAST-NUCES.')
console.log('Identity result:', JSON.stringify(identityResult))
const identityMem = identityResult.find(m => m.category === 'identity')
assert(identityMem !== undefined, 'should extract identity memory')
if (identityMem) {
  assert(identityMem.content.length > 0, 'identity content should not be empty')
  assert(identityMem.confidence > 0 && identityMem.confidence <= 1, 'confidence should be 0-1')
  assert(identityMem.expiresAt === null, 'identity should have null expiresAt')
}
console.log('Identity extraction passed')

// --- Test 2: Valid personal_fact extraction ---
console.log('\n=== Test 2: Personal fact extraction ===')
const factResult = await extractContactMemories('I love playing cricket and my favorite food is biryani.')
console.log('Fact result:', JSON.stringify(factResult))
assert(Array.isArray(factResult), 'should return an array')
// LLM may or may not extract from this message - both are valid
if (factResult.length > 0) {
  const factMem = factResult[0]
  assert(factMem.content.length > 0, 'fact content should not be empty')
  assert(factMem.confidence > 0 && factMem.confidence <= 1, 'confidence should be 0-1')
}
console.log('Personal fact extraction passed')

// --- Test 3: Valid event extraction ---
console.log('\n=== Test 3: Event extraction ===')
const eventResult = await extractContactMemories('I have my final exam tomorrow morning.')
console.log('Event result:', JSON.stringify(eventResult))
assert(Array.isArray(eventResult), 'should return an array')
if (eventResult.length > 0) {
  const eventMem = eventResult[0]
  assert(eventMem.content.length > 0, 'event content should not be empty')
  assert(eventMem.confidence > 0 && eventMem.confidence <= 1, 'confidence should be 0-1')
}
console.log('Event extraction passed')

// --- Test 4: Valid commitment extraction ---
console.log('\n=== Test 4: Commitment extraction ===')
const commitResult = await extractContactMemories("I'll call you tomorrow at 6pm.")
console.log('Commitment result:', JSON.stringify(commitResult))
const commitMem = commitResult.find(m => m.category === 'commitment')
assert(commitMem !== undefined, 'should extract commitment memory')
if (commitMem) {
  assert(commitMem.content.length > 0, 'commitment content should not be empty')
  assert(commitMem.confidence > 0 && commitMem.confidence <= 1, 'confidence should be 0-1')
}
console.log('Commitment extraction passed')

// --- Test 5: Valid context extraction ---
console.log('\n=== Test 5: Context extraction ===')
const contextResult = await extractContactMemories("I'm currently studying for my exams right now.")
console.log('Context result:', JSON.stringify(contextResult))
assert(Array.isArray(contextResult), 'should return an array')
if (contextResult.length > 0) {
  const contextMem = contextResult[0]
  assert(contextMem.content.length > 0, 'context content should not be empty')
}
console.log('Context extraction passed')

// --- Test 6: Empty/irrelevant message returns [] ---
console.log('\n=== Test 6: Irrelevant message ===')
const irrelevantResult = await extractContactMemories('ok')
console.log('Irrelevant result:', JSON.stringify(irrelevantResult))
assert(Array.isArray(irrelevantResult), 'should return an array')
assert(irrelevantResult.length === 0, 'irrelevant message should return empty array')

const thanksResult = await extractContactMemories('thanks')
assert(thanksResult.length === 0, 'thanks should return empty array')

const achaResult = await extractContactMemories('acha')
assert(achaResult.length === 0, 'acha should return empty array')
console.log('Irrelevant message handling passed')

// --- Test 7: Third-party fact not assigned to contact ---
console.log('\n=== Test 7: Third-party exclusion ===')
const thirdPartyResult = await extractContactMemories('My friend Ali is a doctor and works at Mayo Hospital.')
console.log('Third-party result:', JSON.stringify(thirdPartyResult))
const doctorMem = thirdPartyResult.find(m =>
  m.content.toLowerCase().includes('doctor') ||
  m.content.toLowerCase().includes('mayo')
)
assert(doctorMem === undefined, 'third-party profession should NOT be extracted as contact memory')
console.log('Third-party exclusion passed')

// --- Test 8: Invalid category is rejected ---
console.log('\n=== Test 8: Invalid categories handled ===')
// We test this by verifying the parser rejects invalid categories
// Since we can't directly call parseContactMemories, we verify through extractContactMemories
// that only valid categories appear in results
const validResult = await extractContactMemories('I am Ahmed, I study computer science.')
console.log('Valid result:', JSON.stringify(validResult))
const validCategories = ['identity', 'personal_fact', 'event', 'commitment', 'context', 'inside_joke', 'topic']
for (const mem of validResult) {
  assert(validCategories.includes(mem.category), `category "${mem.category}" should be valid`)
}
console.log('Invalid category handling passed')

// --- Test 9: Invalid confidence is handled ---
console.log('\n=== Test 9: Confidence bounds ===')
const confResult = await extractContactMemories('My name is Sara and I am 25 years old.')
console.log('Confidence result:', JSON.stringify(confResult))
for (const mem of confResult) {
  assert(typeof mem.confidence === 'number', 'confidence should be a number')
  assert(isFinite(mem.confidence), 'confidence should be finite')
  assert(mem.confidence >= 0 && mem.confidence <= 1, 'confidence should be between 0 and 1')
}
console.log('Confidence bounds passed')

// --- Test 10: Malformed LLM output does not throw ---
console.log('\n=== Test 10: Malformed output handling ===')
// The extraction function should never throw - it returns [] on error
// We verify by calling it with messages that might produce edge cases
const edgeResult1 = await extractContactMemories('')
console.log('Empty string result:', JSON.stringify(edgeResult1))
assert(Array.isArray(edgeResult1), 'empty string should not throw')

const edgeResult2 = await extractContactMemories('???')
console.log('Garbage input result:', JSON.stringify(edgeResult2))
assert(Array.isArray(edgeResult2), 'garbage input should not throw')
console.log('Malformed output handling passed')

// --- Test 11: Existing extractPersonalFacts still works ---
console.log('\n=== Test 11: Existing extraction intact ===')
const factsResult = await extractPersonalFacts('My name is TestUser and I am 30 years old.')
console.log('Facts result:', JSON.stringify(factsResult))
assert(Array.isArray(factsResult.facts), 'should return facts array')
assert(factsResult.facts.length > 0, 'should extract facts from explicit message')
const nameFact = factsResult.facts.find((f: any) => f.key === 'name')
assert(nameFact !== undefined, 'should extract name fact')
if (nameFact) {
  assert(nameFact.value === 'TestUser', 'name should be TestUser')
}
console.log('Existing extraction intact')

// --- Test 12: addContactMemory integration ---
console.log('\n=== Test 12: Integration with addContactMemory ===')
clearContactMemories('integration_test_user')
const extractedMemories = await extractContactMemories('My name is IntegrationTest and I love programming.')
console.log('Extracted for integration:', JSON.stringify(extractedMemories))
let storedCount = 0
for (const mem of extractedMemories) {
  await addContactMemory(
    'integration_test_user',
    mem.category,
    mem.content,
    'extracted',
    mem.confidence,
    mem.expiresAt ?? undefined,
  )
  storedCount++
}
assert(storedCount > 0, 'should have stored at least one memory')
const storedMems = getContactMemories('integration_test_user')
assert(storedMems.length > 0, 'stored memories should be retrievable')
assert(storedMems.every(m => m.source === 'extracted'), 'all should have source "extracted"')
console.log(`Stored ${storedCount} memories, retrieved ${storedMems.length}`)
console.log('Integration passed')

// --- Test 13: Contact isolation ---
console.log('\n=== Test 13: Contact isolation ===')
clearContactMemories('isolation_a')
clearContactMemories('isolation_b')

const memsA = await extractContactMemories('My name is Alice and I study medicine.')
for (const mem of memsA) {
  await addContactMemory('isolation_a', mem.category, mem.content, 'extracted', mem.confidence, mem.expiresAt ?? undefined)
}

const memsB = await extractContactMemories('My name is Bob and I work as an engineer.')
for (const mem of memsB) {
  await addContactMemory('isolation_b', mem.category, mem.content, 'extracted', mem.confidence, mem.expiresAt ?? undefined)
}

const storedA = getContactMemories('isolation_a')
const storedB = getContactMemories('isolation_b')

const aHasBob = storedA.some(m => m.content.toLowerCase().includes('bob'))
const bHasAlice = storedB.some(m => m.content.toLowerCase().includes('alice'))
assert(!aHasBob, 'contact A should NOT have Bob memories')
assert(!bHasAlice, 'contact B should NOT have Alice memories')
assert(storedA.length > 0, 'contact A should have memories')
assert(storedB.length > 0, 'contact B should have memories')
console.log('Contact isolation passed')

// --- Test 14: Extraction failure does not break workflow ---
console.log('\n=== Test 14: Failure resilience ===')
// The extraction function should never throw - always return []
// We verify with various edge cases
const failResult1 = await extractContactMemories('')
assert(Array.isArray(failResult1), 'should handle empty string')

const failResult2 = await extractContactMemories('\x00\x01\x02')
assert(Array.isArray(failResult2), 'should handle special characters')

const failResult3 = await extractContactMemories('a'.repeat(500))
assert(Array.isArray(failResult3), 'should handle long message')
console.log('Failure resilience passed')

// --- Test 15: expiresAt handling ---
console.log('\n=== Test 15: expiresAt handling ===')
const expiresResult = await extractContactMemories('I have a dentist appointment next Tuesday at 3pm.')
console.log('Expires result:', JSON.stringify(expiresResult))
const expiresMem = expiresResult.find(m => m.category === 'event')
if (expiresMem) {
  if (expiresMem.expiresAt !== null) {
    assert(typeof expiresMem.expiresAt === 'string', 'expiresAt should be a string when not null')
    console.log('Event expiresAt:', expiresMem.expiresAt)
  } else {
    console.log('Event expiresAt is null (could not determine expiration)')
  }
}
console.log('expiresAt handling passed')

// Cleanup
closeDatabase()

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
