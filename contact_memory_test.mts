import {
  initializeDatabase,
  addContactMemory,
  getContactMemories,
  getContactMemoriesByCategory,
  getActiveContactMemories,
  clearExpiredMemories,
  clearContactMemories,
  addMemory,
  getPersonalFacts,
  addConversationMessage,
  getConversationHistory,
  clearMemory,
  closeDatabase,
} from './src/memory'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

// --- Test 1: Database initialization creates contact_memories ---
console.log('=== Test 1: Database initialization ===')
initializeDatabase()

// Clean up any stale data from previous test runs
for (const cid of ['test_contact_a', 'test_contact_b', 'test_contact_persist',
  'test_contact_conf', 'test_contact_exp', 'test_contact_expire',
  'test_contact_active', 'test_contact_perm', 'test_contact_clear_a',
  'test_contact_clear_b', 'test_dup', 'test_multi', 'test_order', 'test_types']) {
  clearContactMemories(cid)
}

console.log('Database initialized with contact_memories table')

// --- Test 2: Add an identity memory ---
console.log('\n=== Test 2: Add identity memory ===')
const mem1 = addContactMemory('test_contact_a', 'identity', 'Name is Ali', 'manual')
assert(mem1.id > 0, 'memory should have an id')
assert(mem1.stableId === 'test_contact_a', 'stableId should match')
assert(mem1.category === 'identity', 'category should be identity')
assert(mem1.content === 'Name is Ali', 'content should match')
assert(mem1.source === 'manual', 'source should be manual')
assert(mem1.confidence === 1.0, 'default confidence should be 1.0')
assert(mem1.createdAt.length > 0, 'createdAt should be set')
assert(mem1.updatedAt.length > 0, 'updatedAt should be set')
assert(mem1.expiresAt === undefined, 'expiresAt should be undefined by default')
console.log('Memory added:', mem1)

// --- Test 3: Retrieve the memory ---
console.log('\n=== Test 3: Retrieve memory ===')
const memories = getContactMemories('test_contact_a')
assert(memories.length === 1, 'should have 1 memory')
assert(memories[0].content === 'Name is Ali', 'content should match')
assert(memories[0].category === 'identity', 'category should match')
console.log('Retrieved:', memories)

// --- Test 4: Add multiple categories ---
console.log('\n=== Test 4: Add multiple categories ===')
addContactMemory('test_contact_a', 'personal_fact', 'Studying computer science', 'extracted', 0.9)
addContactMemory('test_contact_a', 'event', 'Final exam on March 15', 'extracted', 1.0, '2026-03-16')
addContactMemory('test_contact_a', 'commitment', 'Will send the notes tomorrow', 'learned', 0.8)
addContactMemory('test_contact_a', 'context', 'Currently stressed about exams', 'extracted', 0.7, '2026-01-01')
addContactMemory('test_contact_a', 'inside_joke', 'The infamous pizza incident', 'learned', 1.0)
addContactMemory('test_contact_a', 'topic', 'Frequently talks about AI and coding', 'learned', 0.85)

const allMemories = getContactMemories('test_contact_a')
assert(allMemories.length === 7, `should have 7 memories, got ${allMemories.length}`)
console.log(`Total memories: ${allMemories.length}`)

// --- Test 5: Retrieve memories by category ---
console.log('\n=== Test 5: Retrieve by category ===')
const identityMems = getContactMemoriesByCategory('test_contact_a', 'identity')
assert(identityMems.length === 1, 'should have 1 identity memory')
assert(identityMems[0].content === 'Name is Ali', 'identity content should match')

const eventMems = getContactMemoriesByCategory('test_contact_a', 'event')
assert(eventMems.length === 1, 'should have 1 event memory')
assert(eventMems[0].expiresAt === '2026-03-16', 'event expiresAt should match')

const contextMems = getContactMemoriesByCategory('test_contact_a', 'context')
assert(contextMems.length === 1, 'should have 1 context memory')

const topicMems = getContactMemoriesByCategory('test_contact_a', 'topic')
assert(topicMems.length === 1, 'should have 1 topic memory')
console.log('Category retrieval works')

// --- Test 6: Contact isolation ---
console.log('\n=== Test 6: Contact isolation ===')
addContactMemory('test_contact_b', 'identity', 'Name is Sara', 'manual')
addContactMemory('test_contact_b', 'personal_fact', 'Works as a designer', 'extracted')

const aMemories = getContactMemories('test_contact_a')
const bMemories = getContactMemories('test_contact_b')

assert(aMemories.length === 7, 'contact A should have 7 memories')
assert(bMemories.length === 2, 'contact B should have 2 memories')

const aHasSara = aMemories.some(m => m.content === 'Name is Sara')
const bHasAli = bMemories.some(m => m.content === 'Name is Ali')
assert(!aHasSara, 'contact A should NOT have Sara memory')
assert(!bHasAli, 'contact B should NOT have Ali memory')

assert(bMemories[0].stableId === 'test_contact_b', 'contact B memories should have correct stableId')
assert(aMemories[0].stableId === 'test_contact_a', 'contact A memories should have correct stableId')
console.log('Contact isolation verified')

// --- Test 7: Persistence after database close/reopen ---
console.log('\n=== Test 7: Persistence ===')
addContactMemory('test_contact_persist', 'identity', 'Persisted memory', 'manual')
const before = getContactMemories('test_contact_persist')
assert(before.length === 1, 'should have 1 memory before close')

closeDatabase()
initializeDatabase()

const after = getContactMemories('test_contact_persist')
assert(after.length === 1, 'should have 1 memory after reopen')
assert(after[0].content === 'Persisted memory', 'content should persist')
assert(after[0].category === 'identity', 'category should persist')
assert(after[0].source === 'manual', 'source should persist')
console.log('Persistence verified')

// --- Test 8: Confidence is preserved ---
console.log('\n=== Test 8: Confidence preserved ===')
addContactMemory('test_contact_conf', 'personal_fact', 'Loves photography', 'extracted', 0.65)
const confMems = getContactMemories('test_contact_conf')
assert(confMems.length === 1, 'should have 1 memory')
assert(confMems[0].confidence === 0.65, 'confidence should be 0.65')
console.log('Confidence preserved:', confMems[0].confidence)

// --- Test 9: expiresAt is preserved ---
console.log('\n=== Test 9: expiresAt preserved ===')
addContactMemory('test_contact_exp', 'event', 'Meeting on Friday', 'extracted', 1.0, '2026-02-01')
addContactMemory('test_contact_exp', 'identity', 'Permanent memory', 'manual')
const expMems = getContactMemories('test_contact_exp')
const meeting = expMems.find(m => m.content === 'Meeting on Friday')
const permanent = expMems.find(m => m.content === 'Permanent memory')
assert(meeting !== undefined, 'meeting memory should exist')
assert(meeting!.expiresAt === '2026-02-01', 'expiresAt should be preserved')
assert(permanent !== undefined, 'permanent memory should exist')
assert(permanent!.expiresAt === undefined, 'permanent memory should have no expiresAt')
console.log('expiresAt preserved')

// --- Test 10: Expired memories removed by clearExpiredMemories ---
console.log('\n=== Test 10: Clear expired memories ===')
addContactMemory('test_contact_expire', 'context', 'Eating lunch right now', 'extracted', 1.0, '2020-01-01')
addContactMemory('test_contact_expire', 'context', 'Will come later', 'extracted', 1.0, '2020-06-01')
addContactMemory('test_contact_expire', 'identity', 'Name is Omar', 'manual', 1.0)
addContactMemory('test_contact_expire', 'event', 'Birthday next week', 'extracted', 1.0, '2099-12-31')

const beforeClear = getContactMemories('test_contact_expire')
assert(beforeClear.length === 4, 'should have 4 memories before clear')

const deleted = clearExpiredMemories()
assert(deleted >= 2, `should delete at least 2 expired memories, deleted ${deleted}`)

const afterClear = getContactMemories('test_contact_expire')
const permanentRemains = afterClear.find(m => m.content === 'Name is Omar')
const futureRemains = afterClear.find(m => m.content === 'Birthday next week')
assert(permanentRemains !== undefined, 'permanent memory should remain')
assert(futureRemains !== undefined, 'future event should remain')
assert(afterClear.every(m => m.content !== 'Eating lunch right now'), 'expired lunch memory should be deleted')
assert(afterClear.every(m => m.content !== 'Will come later'), 'expired "later" memory should be deleted')
console.log(`Deleted ${deleted} expired memories, ${afterClear.length} remain`)

// --- Test 11: Non-expired memories remain ---
console.log('\n=== Test 11: Non-expired remain ===')
addContactMemory('test_contact_active', 'context', 'Currently working', 'extracted', 1.0, '2099-12-31')
addContactMemory('test_contact_active', 'identity', 'Name is Zain', 'manual')
const activeMems = getActiveContactMemories('test_contact_active')
assert(activeMems.length === 2, 'both non-expired and permanent should be active')
console.log('Active memories:', activeMems.length)

// --- Test 12: Permanent memories remain ---
console.log('\n=== Test 12: Permanent memories remain ===')
addContactMemory('test_contact_perm', 'inside_joke', 'The legendary bug story', 'learned')
addContactMemory('test_contact_perm', 'topic', 'Always discusses machine learning', 'learned', 0.9)
clearExpiredMemories()
const permMems = getContactMemories('test_contact_perm')
assert(permMems.length === 2, 'permanent memories should remain after clear')
console.log('Permanent memories intact')

// --- Test 13: clearContactMemories removes only that contact ---
console.log('\n=== Test 13: clearContactMemories ===')
addContactMemory('test_contact_clear_a', 'identity', 'A memory', 'manual')
addContactMemory('test_contact_clear_a', 'topic', 'A topic', 'learned')
addContactMemory('test_contact_clear_b', 'identity', 'B memory', 'manual')

clearContactMemories('test_contact_clear_a')
const aAfter = getContactMemories('test_contact_clear_a')
const bAfter = getContactMemories('test_contact_clear_b')
assert(aAfter.length === 0, 'contact A memories should be cleared')
assert(bAfter.length === 1, 'contact B memories should remain')
assert(bAfter[0].content === 'B memory', 'contact B content should be intact')
console.log('clearContactMemories isolation verified')

// --- Test 14: Existing facts functionality still works ---
console.log('\n=== Test 14: Existing facts work ===')
await addMemory('test_facts_user', 'name', 'FactTest')
await addMemory('test_facts_user', 'age', 25)
const facts = getPersonalFacts('test_facts_user')
assert(facts.name === 'FactTest', 'fact name should work')
assert(facts.age === 25, 'fact age should work')
console.log('Facts intact:', facts)

// --- Test 15: Existing conversation-memory functionality still works ---
console.log('\n=== Test 15: Existing conversation history works ===')
addConversationMessage('test_conv_user', 'user', 'hello')
addConversationMessage('test_conv_user', 'assistant', 'hi there')
const history = await getConversationHistory('test_conv_user')
assert(history.length === 2, 'history should have 2 messages')
assert(history[0].content === 'hello', 'user message preserved')
assert(history[1].content === 'hi there', 'assistant message preserved')

clearMemory('test_conv_user')
const clearedFacts = getPersonalFacts('test_conv_user')
const clearedHistory = await getConversationHistory('test_conv_user')
assert(Object.keys(clearedFacts).length === 0, 'facts should be cleared')
assert(clearedHistory.length === 0, 'history should be cleared')
console.log('Conversation history intact')

// --- Test 16: Duplicate avoidance ---
console.log('\n=== Test 16: Duplicate avoidance ===')
const dup1 = addContactMemory('test_dup', 'identity', 'Same content', 'manual')
const dup2 = addContactMemory('test_dup', 'identity', 'Same content', 'manual')
assert(dup1.id === dup2.id, 'duplicate should return same memory id (update)')
const dupMems = getContactMemories('test_dup')
assert(dupMems.length === 1, 'should only have 1 memory (not duplicated)')
assert(dupMems[0].content === 'Same content', 'content should be correct')
console.log('Duplicate avoidance works')

// --- Test 17: Different content in same category is allowed ---
console.log('\n=== Test 17: Different content in same category ===')
addContactMemory('test_multi', 'personal_fact', 'Loves coding', 'extracted')
addContactMemory('test_multi', 'personal_fact', 'Plays football', 'extracted')
const multiMems = getContactMemoriesByCategory('test_multi', 'personal_fact')
assert(multiMems.length === 2, 'different content in same category should be allowed')
console.log('Multiple memories in same category work')

// --- Test 18: Retrieval order (confidence DESC, updated_at DESC) ---
console.log('\n=== Test 18: Retrieval order ===')
addContactMemory('test_order', 'topic', 'Low confidence topic', 'extracted', 0.3)
addContactMemory('test_order', 'topic', 'High confidence topic', 'extracted', 0.95)
addContactMemory('test_order', 'topic', 'Medium confidence topic', 'extracted', 0.6)
const ordered = getContactMemoriesByCategory('test_order', 'topic')
assert(ordered[0].content === 'High confidence topic', 'first should be highest confidence')
assert(ordered[1].content === 'Medium confidence topic', 'second should be medium')
assert(ordered[2].content === 'Low confidence topic', 'third should be lowest')
console.log('Retrieval order verified')

// --- Test 19: TypeScript types are correct ---
console.log('\n=== Test 19: TypeScript types ===')
const typedMemory: import('./src/memory').ContactMemory = addContactMemory(
  'test_types', 'identity', 'Type test', 'manual', 1.0,
)
assert(typeof typedMemory.id === 'number', 'id should be number')
assert(typeof typedMemory.stableId === 'string', 'stableId should be string')
assert(typeof typedMemory.category === 'string', 'category should be string')
assert(typeof typedMemory.content === 'string', 'content should be string')
assert(typeof typedMemory.source === 'string', 'source should be string')
assert(typeof typedMemory.confidence === 'number', 'confidence should be number')
assert(typeof typedMemory.createdAt === 'string', 'createdAt should be string')
console.log('TypeScript types correct')

closeDatabase()

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
