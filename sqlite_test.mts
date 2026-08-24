import { initializeDatabase, addMemory, getPersonalFacts, addConversationMessage, getConversationHistory, clearMemory, closeDatabase } from './src/memory'

async function verifyPersistence() {
  console.log('=== SQLite Persistence Verification ===\n')

  initializeDatabase()
  let passed = true

  // Phase 1: Write data
  console.log('Phase 1: Writing data...')
  await addMemory('persist_user', 'name', 'TestUser')
  await addMemory('persist_user', 'age', 30)
  await addMemory('persist_user', 'city', 'TestCity')
  addConversationMessage('persist_user', 'user', 'Hello from test')
  addConversationMessage('persist_user', 'assistant', 'Hello! I am a test response.')

  const factsBefore = getPersonalFacts('persist_user')
  const historyBefore = await getConversationHistory('persist_user')
  console.log('Facts before close:', factsBefore)
  console.log('History before close:', historyBefore)

  // Close database
  closeDatabase()
  console.log('\nDatabase closed.\n')

  // Phase 2: Re-open and verify persistence
  console.log('Phase 2: Re-opening database...')
  initializeDatabase()

  const factsAfter = getPersonalFacts('persist_user')
  const historyAfter = await getConversationHistory('persist_user')
  console.log('Facts after re-open:', factsAfter)
  console.log('History after re-open:', historyAfter)

  if (factsAfter.name !== 'TestUser') { console.error('FAIL: name not persisted'); passed = false }
  if (factsAfter.age !== 30) { console.error('FAIL: age not persisted'); passed = false }
  if (factsAfter.city !== 'TestCity') { console.error('FAIL: city not persisted'); passed = false }
  if (historyAfter.length !== 2) { console.error('FAIL: history not persisted'); passed = false }
  if (historyAfter[0]?.content !== 'Hello from test') { console.error('FAIL: user message not persisted'); passed = false }
  if (historyAfter[1]?.content !== 'Hello! I am a test response.') { console.error('FAIL: assistant message not persisted'); passed = false }

  // Test fact update (UPSERT)
  console.log('\nPhase 3: Testing fact update...')
  await addMemory('persist_user', 'city', 'NewCity')
  const updatedFacts = getPersonalFacts('persist_user')
  if (updatedFacts.city !== 'NewCity') { console.error('FAIL: fact update not working'); passed = false }
  console.log('Updated facts:', updatedFacts)

  // Test clearMemory
  console.log('\nPhase 4: Testing clearMemory...')
  clearMemory('persist_user')
  const clearedFacts = getPersonalFacts('persist_user')
  const clearedHistory = await getConversationHistory('persist_user')
  if (Object.keys(clearedFacts).length !== 0) { console.error('FAIL: facts not cleared'); passed = false }
  if (clearedHistory.length !== 0) { console.error('FAIL: history not cleared'); passed = false }
  console.log('Facts after clear:', clearedFacts)
  console.log('History after clear:', clearedHistory)

  // Test user isolation
  console.log('\nPhase 5: Testing user isolation...')
  await addMemory('userA', 'name', 'Alice')
  await addMemory('userB', 'name', 'Bob')
  const factsA = getPersonalFacts('userA')
  const factsB = getPersonalFacts('userB')
  if (factsA.name !== 'Alice' || factsB.name !== 'Bob') { console.error('FAIL: user isolation broken'); passed = false }
  if (factsA.name === factsB.name) { console.error('FAIL: users share data'); passed = false }
  console.log('User A:', factsA)
  console.log('User B:', factsB)

  // Test history limit
  console.log('\nPhase 6: Testing history limit...')
  clearMemory('limit_user')
  for (let i = 1; i <= 15; i++) {
    addConversationMessage('limit_user', 'user', `msg ${i}`)
    addConversationMessage('limit_user', 'assistant', `reply ${i}`)
  }
  const fullHistory = await getConversationHistory('limit_user')
  const limitedHistory = await getConversationHistory('limit_user', 5)
  console.log(`Full history: ${fullHistory.length} messages`)
  console.log(`Limited history: ${limitedHistory.length} messages`)
  if (fullHistory.length !== 30) { console.error('FAIL: full history count wrong'); passed = false }
  if (limitedHistory.length !== 5) { console.error('FAIL: limited history count wrong'); passed = false }

  // Limited should return last 5 in chronological order
  // 30 messages total (15 user + 15 assistant). Last 5 by id: reply13, msg14, reply14, msg15, reply15
  console.log('Limited history contents:', limitedHistory.map(m => `${m.role}:${m.content}`))
  if (limitedHistory[0]?.content !== 'reply 13') {
    console.error(`FAIL: limited history first message wrong: got "${limitedHistory[0]?.content}", expected "reply 13"`)
    passed = false
  }

  // Test chronological order using message id (implicit by insertion order)
  console.log('\nPhase 7: Testing chronological order...')
  clearMemory('chrono_test')
  for (let i = 1; i <= 10; i++) {
    addConversationMessage('chrono_test', 'user', `msg_${i}`)
    addConversationMessage('chrono_test', 'assistant', `reply_${i}`)
  }
  const chronoHistory = await getConversationHistory('chrono_test')
  console.log('Full chrono:', chronoHistory.map(m => m.content))
  // Verify user-assistant alternating pattern
  for (let i = 0; i < chronoHistory.length; i++) {
    const expectedRole = i % 2 === 0 ? 'user' : 'assistant'
    if (chronoHistory[i].role !== expectedRole) {
      console.error(`FAIL: message ${i} has role "${chronoHistory[i].role}", expected "${expectedRole}"`)
      passed = false
      break
    }
  }
  // Verify chronological ordering by checking msg_N pattern
  for (let i = 0; i < chronoHistory.length; i += 2) {
    const msgNum = (i / 2) + 1
    if (chronoHistory[i].content !== `msg_${msgNum}`) {
      console.error(`FAIL: user message at index ${i} is "${chronoHistory[i].content}", expected "msg_${msgNum}"`)
      passed = false
      break
    }
  }

  closeDatabase()

  console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
  process.exit(passed ? 0 : 1)
}

verifyPersistence().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
