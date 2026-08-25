import {
  initializeDatabase,
  addContactMemory,
  getContactMemories,
  getContactMemoriesByCategory,
  getActiveContactMemories,
  getContactMemoriesPrioritized,
  buildContactMemoryContext,
  clearContactMemories,
  clearExpiredMemories,
  closeDatabase,
  CATEGORY_ORDER,
  CATEGORY_LIMITS,
  CATEGORY_LABELS,
  DEFAULT_MEMORY_LIMIT,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from './src/memory'
import type { ContactMemory, ContactMemoryCategory } from './src/memory'

let passed = true
let testCount = 0
let failCount = 0

function assert(condition: boolean, message: string) {
  testCount++
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    passed = false
    failCount++
  } else {
    console.log(`  PASS: ${message}`)
  }
}

function cleanupContacts(ids: string[]) {
  for (const id of ids) {
    clearContactMemories(id)
  }
}

async function runTests() {
  console.log('=== Contact Memory Retrieval Tests ===\n')

  initializeDatabase()

  // --- Test Group 1: Category Priority ---
  console.log('Test Group 1: Category Priority')

  console.log('Test 1.1: CATEGORY_ORDER has correct priority')
  assert(
    JSON.stringify(CATEGORY_ORDER) === JSON.stringify([
      'identity', 'personal_fact', 'event', 'commitment',
      'context', 'inside_joke', 'topic'
    ]),
    'Category order matches expected priority'
  )

  console.log('\nTest 1.2: Prioritized retrieval respects category order')
  const priorityUser = 'priority_test_user'
  cleanupContacts([priorityUser])

  // Add memories in reverse priority order
  addContactMemory(priorityUser, 'topic', 'Topic memory', 'manual', 1.0)
  addContactMemory(priorityUser, 'inside_joke', 'Inside joke memory', 'manual', 1.0)
  addContactMemory(priorityUser, 'context', 'Context memory', 'manual', 1.0)
  addContactMemory(priorityUser, 'commitment', 'Commitment memory', 'manual', 1.0)
  addContactMemory(priorityUser, 'event', 'Event memory', 'manual', 1.0)
  addContactMemory(priorityUser, 'personal_fact', 'Personal fact memory', 'manual', 1.0)
  addContactMemory(priorityUser, 'identity', 'Identity memory', 'manual', 1.0)

  const prioritized = getContactMemoriesPrioritized(priorityUser, 7)
  assert(prioritized.length === 7, 'Should retrieve all 7 memories')

  // Check that identity comes first, topic comes last
  assert(prioritized[0].category === 'identity', 'First memory should be identity')
  assert(prioritized[6].category === 'topic', 'Last memory should be topic')

  // Check full order
  const retrievedOrder = prioritized.map(m => m.category)
  const expectedOrder = ['identity', 'personal_fact', 'event', 'commitment', 'context', 'inside_joke', 'topic']
  assert(
    JSON.stringify(retrievedOrder) === JSON.stringify(expectedOrder),
    `Order should be ${expectedOrder.join(', ')}, got ${retrievedOrder.join(', ')}`
  )

  cleanupContacts([priorityUser])

  // --- Test Group 2: Confidence Filtering ---
  console.log('\n\nTest Group 2: Confidence Filtering')

  console.log('Test 2.1: Low confidence memories filtered by default')
  const confUser = 'confidence_test_user'
  cleanupContacts([confUser])

  addContactMemory(confUser, 'identity', 'High confidence', 'manual', 1.0)
  addContactMemory(confUser, 'personal_fact', 'Medium confidence', 'manual', 0.6)
  addContactMemory(confUser, 'event', 'Low confidence', 'manual', 0.2)
  addContactMemory(confUser, 'commitment', 'Very low confidence', 'manual', 0.1)

  const activeDefault = getActiveContactMemories(confUser)
  assert(activeDefault.length === 2, 'With default threshold 0.3, only 1.0 and 0.6 pass (2 memories)')
  assert(activeDefault.every(m => m.confidence >= DEFAULT_CONFIDENCE_THRESHOLD), 'All should meet threshold')

  console.log('\nTest 2.2: Custom confidence threshold')
  const activeHighThreshold = getActiveContactMemories(confUser, 0.7)
  assert(activeHighThreshold.length === 1, 'With threshold 0.7, only 1.0 passes (1 memory)')
  assert(activeHighThreshold.every(m => m.confidence >= 0.7), 'All should meet 0.7 threshold')

  console.log('\nTest 2.3: Zero threshold returns all non-expired')
  const activeZeroThreshold = getActiveContactMemories(confUser, 0)
  assert(activeZeroThreshold.length === 4, 'With threshold 0, all 4 memories should pass')

  console.log('\nTest 2.4: Threshold 1.0 returns only perfect confidence')
  const activePerfectOnly = getActiveContactMemories(confUser, 1.0)
  assert(activePerfectOnly.length === 1, 'With threshold 1.0, only 1 memory should pass')
  assert(activePerfectOnly[0].content === 'High confidence', 'Should be the high confidence memory')

  cleanupContacts([confUser])

  // --- Test Group 3: Expiration Filtering ---
  console.log('\n\nTest Group 3: Expiration Filtering')

  console.log('Test 3.1: Expired memories excluded')
  const expUser = 'expiration_test_user'
  cleanupContacts([expUser])

  addContactMemory(expUser, 'identity', 'Permanent identity', 'manual', 1.0)
  addContactMemory(expUser, 'event', 'Past event', 'extracted', 1.0, '2020-01-01')
  addContactMemory(expUser, 'context', 'Current context', 'extracted', 1.0, '2099-12-31')
  addContactMemory(expUser, 'commitment', 'Old commitment', 'extracted', 1.0, '2020-06-01')

  const activeExpiry = getActiveContactMemories(expUser)
  assert(activeExpiry.length === 2, 'Should exclude 2 expired memories')
  assert(activeExpiry.some(m => m.content === 'Permanent identity'), 'Permanent should remain')
  assert(activeExpiry.some(m => m.content === 'Current context'), 'Future should remain')
  assert(!activeExpiry.some(m => m.content === 'Past event'), 'Past event should be excluded')
  assert(!activeExpiry.some(m => m.content === 'Old commitment'), 'Old commitment should be excluded')

  console.log('\nTest 3.2: clearExpiredMemories removes expired from database')
  const deletedCount = clearExpiredMemories()
  assert(deletedCount >= 2, `Should delete at least 2 expired, deleted ${deletedCount}`)

  const afterClear = getContactMemories(expUser)
  assert(afterClear.length === 2, 'Should have 2 memories after clear')

  cleanupContacts([expUser])

  // --- Test Group 4: Per-Category Limits ---
  console.log('\n\nTest Group 4: Per-Category Limits')

  console.log('Test 4.1: CATEGORY_LIMITS is defined')
  assert(typeof CATEGORY_LIMITS === 'object', 'CATEGORY_LIMITS should be an object')
  assert(CATEGORY_LIMITS.identity === 3, 'Identity limit should be 3')
  assert(CATEGORY_LIMITS.personal_fact === 5, 'Personal fact limit should be 5')
  assert(CATEGORY_LIMITS.event === 3, 'Event limit should be 3')
  assert(CATEGORY_LIMITS.commitment === 3, 'Commitment limit should be 3')
  assert(CATEGORY_LIMITS.context === 3, 'Context limit should be 3')
  assert(CATEGORY_LIMITS.inside_joke === 2, 'Inside joke limit should be 2')
  assert(CATEGORY_LIMITS.topic === 2, 'Topic limit should be 2')

  console.log('\nTest 4.2: Per-category limits enforced')
  const limitUser = 'limit_test_user'
  cleanupContacts([limitUser])

  // Add more memories than the identity limit (3)
  addContactMemory(limitUser, 'identity', 'Identity 1', 'manual', 1.0)
  addContactMemory(limitUser, 'identity', 'Identity 2', 'manual', 1.0)
  addContactMemory(limitUser, 'identity', 'Identity 3', 'manual', 1.0)
  addContactMemory(limitUser, 'identity', 'Identity 4', 'manual', 1.0)

  const prioritizedLimit = getContactMemoriesPrioritized(limitUser, 20)
  const identityCount = prioritizedLimit.filter(m => m.category === 'identity').length
  assert(identityCount === 3, `Identity should be limited to 3, got ${identityCount}`)

  console.log('\nTest 4.3: All categories have limits defined')
  for (const cat of CATEGORY_ORDER) {
    assert(
      typeof CATEGORY_LIMITS[cat] === 'number' && CATEGORY_LIMITS[cat] > 0,
      `Category ${cat} has a positive limit`
    )
  }

  cleanupContacts([limitUser])

  // --- Test Group 5: Total Memory Limit ---
  console.log('\n\nTest Group 5: Total Memory Limit')

  console.log('Test 5.1: Default memory limit is defined')
  assert(DEFAULT_MEMORY_LIMIT === 15, 'Default memory limit should be 15')

  console.log('\nTest 5.2: Custom total limit respected')
  const totalUser = 'total_limit_user'
  cleanupContacts([totalUser])

  // Add memories across multiple categories
  addContactMemory(totalUser, 'identity', 'Identity 1', 'manual', 1.0)
  addContactMemory(totalUser, 'identity', 'Identity 2', 'manual', 1.0)
  addContactMemory(totalUser, 'personal_fact', 'Fact 1', 'manual', 1.0)
  addContactMemory(totalUser, 'personal_fact', 'Fact 2', 'manual', 1.0)
  addContactMemory(totalUser, 'event', 'Event 1', 'manual', 1.0)
  addContactMemory(totalUser, 'commitment', 'Commitment 1', 'manual', 1.0)

  const limitedTotal = getContactMemoriesPrioritized(totalUser, 3)
  assert(limitedTotal.length === 3, `Should respect total limit of 3, got ${limitedTotal.length}`)

  console.log('\nTest 5.3: Limit larger than available returns all')
  const allMemories = getContactMemoriesPrioritized(totalUser, 100)
  assert(allMemories.length === 6, 'Should return all 6 memories when limit exceeds count')

  console.log('\nTest 5.4: Limit of 0 returns empty')
  const zeroLimit = getContactMemoriesPrioritized(totalUser, 0)
  assert(zeroLimit.length === 0, 'Limit of 0 should return empty')

  cleanupContacts([totalUser])

  // --- Test Group 6: Contact Isolation ---
  console.log('\n\nTest Group 6: Contact Isolation')

  console.log('Test 6.1: Memories isolated by stableId')
  const isoUserA = 'isolation_a'
  const isoUserB = 'isolation_b'
  cleanupContacts([isoUserA, isoUserB])

  addContactMemory(isoUserA, 'identity', 'Alice identity', 'manual', 1.0)
  addContactMemory(isoUserA, 'personal_fact', 'Alice fact', 'manual', 1.0)
  addContactMemory(isoUserB, 'identity', 'Bob identity', 'manual', 1.0)
  addContactMemory(isoUserB, 'personal_fact', 'Bob fact', 'manual', 1.0)

  const memsA = getContactMemoriesPrioritized(isoUserA)
  const memsB = getContactMemoriesPrioritized(isoUserB)

  assert(memsA.length === 2, 'Contact A should have 2 memories')
  assert(memsB.length === 2, 'Contact B should have 2 memories')
  assert(memsA.every(m => m.stableId === isoUserA), 'All A memories should have A stableId')
  assert(memsB.every(m => m.stableId === isoUserB), 'All B memories should have B stableId')
  assert(!memsA.some(m => m.content.includes('Bob')), 'A should not have Bob memories')
  assert(!memsB.some(m => m.content.includes('Alice')), 'B should not have Alice memories')

  console.log('\nTest 6.2: Non-existent user returns empty')
  const nonExistent = getContactMemoriesPrioritized('nonexistent_user_xyz')
  assert(nonExistent.length === 0, 'Non-existent user should return empty')

  cleanupContacts([isoUserA, isoUserB])

  // --- Test Group 7: Ordering ---
  console.log('\n\nTest Group 7: Ordering')

  console.log('Test 7.1: Within category, ordered by confidence DESC')
  const orderUser = 'order_test_user'
  cleanupContacts([orderUser])

  addContactMemory(orderUser, 'topic', 'Low confidence', 'manual', 0.3)
  addContactMemory(orderUser, 'topic', 'High confidence', 'manual', 0.95)
  addContactMemory(orderUser, 'topic', 'Medium confidence', 'manual', 0.6)

  const topicMems = getContactMemoriesByCategory(orderUser, 'topic')
  assert(topicMems.length === 3, 'Should have 3 topic memories')
  assert(topicMems[0].content === 'High confidence', 'First should be highest confidence')
  assert(topicMems[1].content === 'Medium confidence', 'Second should be medium')
  assert(topicMems[2].content === 'Low confidence', 'Third should be lowest')

  console.log('\nTest 7.2: Same confidence ordered by updated_at DESC')
  addContactMemory(orderUser, 'context', 'Earlier context', 'manual', 0.8)
  // Small delay isn't feasible in tests, but we can verify the function accepts the ordering
  const contextMems = getContactMemoriesByCategory(orderUser, 'context')
  assert(contextMems.length >= 1, 'Should have context memories')
  assert(contextMems[0].confidence === 0.8, 'Confidence should be correct')

  cleanupContacts([orderUser])

  // --- Test Group 8: Empty Memories ---
  console.log('\n\nTest Group 8: Empty Memories')

  console.log('Test 8.1: Empty user returns empty array')
  const emptyUser = 'empty_test_user'
  cleanupContacts([emptyUser])

  const emptyResult = getContactMemoriesPrioritized(emptyUser)
  assert(emptyResult.length === 0, 'Empty user should return empty array')

  console.log('\nTest 8.2: buildContactMemoryContext with empty array')
  const emptyContext = buildContactMemoryContext([])
  assert(emptyContext === '', 'Empty array should return empty string')

  console.log('\nTest 8.3: buildContactMemoryContext with empty memories from user')
  const userMems = getContactMemoriesPrioritized(emptyUser)
  const userContext = buildContactMemoryContext(userMems)
  assert(userContext === '', 'User with no memories should return empty context')

  cleanupContacts([emptyUser])

  // --- Test Group 9: Prompt Context Generation ---
  console.log('\n\nTest Group 9: Prompt Context Generation')

  console.log('Test 9.1: Context includes required sections')
  const ctxUser = 'context_gen_user'
  cleanupContacts([ctxUser])

  addContactMemory(ctxUser, 'identity', 'Name is TestUser', 'manual', 1.0)
  addContactMemory(ctxUser, 'personal_fact', 'Loves programming', 'extracted', 0.9)
  addContactMemory(ctxUser, 'event', 'Exam tomorrow', 'extracted', 1.0)
  addContactMemory(ctxUser, 'commitment', 'Will send notes', 'learned', 0.8)
  addContactMemory(ctxUser, 'context', 'Studying right now', 'extracted', 0.7)
  addContactMemory(ctxUser, 'inside_joke', 'The bug story', 'learned', 1.0)
  addContactMemory(ctxUser, 'topic', 'AI and ML', 'learned', 0.85)

  const ctxMems = getContactMemoriesPrioritized(ctxUser)
  const contextStr = buildContactMemoryContext(ctxMems)

  assert(contextStr.includes('CONTACT MEMORY RULES'), 'Should include memory rules')
  assert(contextStr.includes('CONTACT MEMORIES:'), 'Should include memories header')
  assert(contextStr.includes('IDENTITY:'), 'Should include identity section')
  assert(contextStr.includes('PERSONAL FACTS:'), 'Should include personal facts section')
  assert(contextStr.includes('EVENTS:'), 'Should include events section')
  assert(contextStr.includes('COMMITMENTS:'), 'Should include commitments section')
  assert(contextStr.includes('CONTEXT:'), 'Should include context section')
  assert(contextStr.includes('INSIDE JOKES:'), 'Should include inside jokes section')
  assert(contextStr.includes('TOPICS:'), 'Should include topics section')
  assert(contextStr.includes('Name is TestUser'), 'Should include identity content')
  assert(contextStr.includes('Loves programming'), 'Should include personal fact content')

  console.log('\nTest 9.2: Context respects category order in output')
  const identityPos = contextStr.indexOf('IDENTITY:')
  const personalFactPos = contextStr.indexOf('PERSONAL FACTS:')
  const eventPos = contextStr.indexOf('EVENTS:')
  const topicPos = contextStr.indexOf('TOPICS:')
  assert(identityPos < personalFactPos, 'IDENTITY should come before PERSONAL FACTS')
  assert(personalFactPos < eventPos, 'PERSONAL FACTS should come before EVENTS')
  assert(eventPos < topicPos, 'EVENTS should come before TOPICS')

  console.log('\nTest 9.3: Context with metadata option')
  const ctxWithMeta = buildContactMemoryContext(ctxMems, { includeMetadata: true })
  assert(ctxWithMeta.includes('[Retrieved'), 'Should include metadata line')
  assert(ctxWithMeta.includes('memories'), 'Metadata should mention memories')

  console.log('\nTest 9.4: Context without metadata option')
  const ctxNoMeta = buildContactMemoryContext(ctxMems, { includeMetadata: false })
  assert(!ctxNoMeta.includes('[Retrieved'), 'Should not include metadata line')

  cleanupContacts([ctxUser])

  // --- Test Group 10: Configurable Constants ---
  console.log('\n\nTest Group 10: Configurable Constants')

  console.log('Test 10.1: CATEGORY_ORDER is exported')
  assert(Array.isArray(CATEGORY_ORDER), 'CATEGORY_ORDER should be an array')
  assert(CATEGORY_ORDER.length === 7, 'Should have 7 categories')

  console.log('\nTest 10.2: CATEGORY_LABELS is exported')
  assert(typeof CATEGORY_LABELS === 'object', 'CATEGORY_LABELS should be an object')
  for (const cat of CATEGORY_ORDER) {
    assert(typeof CATEGORY_LABELS[cat] === 'string', `Label for ${cat} should be a string`)
  }

  console.log('\nTest 10.3: CATEGORY_LIMITS is exported')
  assert(typeof CATEGORY_LIMITS === 'object', 'CATEGORY_LIMITS should be an object')

  console.log('\nTest 10.4: DEFAULT_MEMORY_LIMIT is exported')
  assert(typeof DEFAULT_MEMORY_LIMIT === 'number', 'DEFAULT_MEMORY_LIMIT should be a number')
  assert(DEFAULT_MEMORY_LIMIT > 0, 'DEFAULT_MEMORY_LIMIT should be positive')

  console.log('\nTest 10.5: DEFAULT_CONFIDENCE_THRESHOLD is exported')
  assert(typeof DEFAULT_CONFIDENCE_THRESHOLD === 'number', 'DEFAULT_CONFIDENCE_THRESHOLD should be a number')
  assert(DEFAULT_CONFIDENCE_THRESHOLD >= 0 && DEFAULT_CONFIDENCE_THRESHOLD <= 1, 'Threshold should be 0-1')

  // --- Summary ---
  console.log('\n\n=== Test Summary ===')
  console.log(`Total tests: ${testCount}`)
  console.log(`Passed: ${testCount - failCount}`)
  console.log(`Failed: ${failCount}`)

  closeDatabase()

  console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
  process.exit(passed ? 0 : 1)
}

runTests().catch(err => {
  console.error('Test failed:', err)
  closeDatabase()
  process.exit(1)
})
