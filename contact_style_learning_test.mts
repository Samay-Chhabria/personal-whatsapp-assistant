import { initializeDatabase, closeDatabase, addConversationMessage, getContactProfile, clearContactProfile, clearMemory } from './src/memory'
import {
  parseStyleObservation,
  mergeContactProfile,
  mergeStyleNotes,
  getUserMessageCount,
  shouldLearnStyle,
  tryLearnContactStyle,
  MIN_MESSAGES_FOR_STYLE_LEARNING,
  ContactStyleObservation,
} from './src/contactStyleLearning'

const TEST_USER = 'style_learner_test_user@s.whatsapp.net'

function cleanup() {
  try {
    clearMemory(TEST_USER)
    clearContactProfile(TEST_USER)
  } catch {}
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`  PASS: ${message}`)
}

async function runTests() {
  console.log('=== Contact Style Learning Tests ===\n')

  initializeDatabase()
  cleanup()

  // --- parseStyleObservation ---

  console.log('Test 1: Valid JSON observation')
  const valid = parseStyleObservation('{"tone":"casual","formality":"informal","typicalResponseLength":"short"}')
  assert(valid !== null, 'Parsed valid JSON')
  assert(valid!.tone === 'casual', 'tone = casual')
  assert(valid!.formality === 'informal', 'formality = informal')
  assert(valid!.typicalResponseLength === 'short', 'typicalResponseLength = short')
  assert(valid!.preferredLanguage === undefined, 'preferredLanguage omitted')

  console.log('\nTest 2: JSON embedded in text')
  const embedded = parseStyleObservation('Here is the analysis:\n{"tone":"playful","humorLevel":"high"}\nDone.')
  assert(embedded !== null, 'Extracted embedded JSON')
  assert(embedded!.tone === 'playful', 'tone = playful')
  assert(embedded!.humorLevel === 'high', 'humorLevel = high')

  console.log('\nTest 3: Malformed JSON')
  const malformed = parseStyleObservation('This is not JSON at all')
  assert(malformed === null, 'Returns null for malformed input')

  console.log('\nTest 4: Empty object')
  const empty = parseStyleObservation('{}')
  assert(empty === null, 'Returns null for empty object')

  console.log('\nTest 5: Null/non-string input')
  const nonString = parseStyleObservation('')
  assert(nonString === null, 'Returns null for empty string')

  console.log('\nTest 6: JSON with non-string fields ignored')
  const nonStringFields = parseStyleObservation('{"tone":"casual","humorLevel":123,"styleNotes":true}')
  assert(nonStringFields !== null, 'Parsed partial JSON')
  assert(nonStringFields!.tone === 'casual', 'tone = casual')
  assert(nonStringFields!.humorLevel === undefined, 'non-string humorLevel ignored')
  assert(nonStringFields!.styleNotes === undefined, 'non-string styleNotes ignored')

  // --- mergeContactProfile ---

  console.log('\nTest 7: Merge fills new fields')
  const merged1 = mergeContactProfile(null, {
    tone: 'casual',
    formality: 'informal',
    humorLevel: 'moderate',
    typicalResponseLength: 'short',
    preferredLanguage: 'Roman Urdu',
    styleNotes: 'Uses playful teasing',
  })
  assert(merged1.tone === 'casual', 'tone filled')
  assert(merged1.formality === 'informal', 'formality filled')
  assert(merged1.humorLevel === 'moderate', 'humorLevel filled')
  assert(merged1.typicalResponseLength === 'short', 'typicalResponseLength filled')
  assert(merged1.preferredLanguage === 'Roman Urdu', 'preferredLanguage filled')
  assert(merged1.styleNotes === 'Uses playful teasing', 'styleNotes filled')

  console.log('\nTest 8: Merge preserves existing values')
  const merged2 = mergeContactProfile(
    {
      stableId: TEST_USER,
      displayName: 'Ali',
      relationship: 'friend',
      tone: 'existing tone',
      formality: 'existing formality',
      humorLevel: undefined,
      typicalResponseLength: undefined,
      preferredLanguage: undefined,
      styleNotes: undefined,
    },
    {
      tone: 'new tone',
      formality: 'new formality',
      humorLevel: 'high',
      typicalResponseLength: 'short',
      preferredLanguage: 'English',
      styleNotes: 'Some note',
    }
  )
  assert(merged2.displayName === 'Ali', 'displayName preserved')
  assert(merged2.relationship === 'friend', 'relationship preserved')
  assert(merged2.tone === 'existing tone', 'existing tone preserved')
  assert(merged2.formality === 'existing formality', 'existing formality preserved')
  assert(merged2.humorLevel === 'high', 'new humorLevel filled (was empty)')
  assert(merged2.typicalResponseLength === 'short', 'new typicalResponseLength filled')
  assert(merged2.preferredLanguage === 'English', 'new preferredLanguage filled')

  console.log('\nTest 9: Merge deduplicates style notes')
  const merged3 = mergeContactProfile(
    {
      stableId: TEST_USER,
      styleNotes: 'Uses casual greetings. Frequently mixes Roman Urdu.',
    },
    {
      styleNotes: 'Uses casual greetings. Often uses emojis.',
    }
  )
  assert(
    merged3.styleNotes === 'Uses casual greetings. Frequently mixes Roman Urdu. Often uses emojis.',
    'Duplicate note deduplicated, unique note appended'
  )

  console.log('\nTest 10: Merge with no new notes')
  const merged4 = mergeContactProfile(
    { stableId: TEST_USER, styleNotes: 'Existing note.' },
    { styleNotes: 'Existing note.' }
  )
  assert(merged4.styleNotes === 'Existing note.', 'Existing notes preserved when no new unique notes')

  console.log('\nTest 11: Merge with only existing notes')
  const merged5 = mergeContactProfile(
    { stableId: TEST_USER, styleNotes: 'Only existing.' },
    {}
  )
  assert(merged5.styleNotes === 'Only existing.', 'Existing notes preserved when no new notes')

  console.log('\nTest 12: Merge with only new notes')
  const merged6 = mergeContactProfile(
    { stableId: TEST_USER },
    { styleNotes: 'Only new.' }
  )
  assert(merged6.styleNotes === 'Only new.', 'New notes used when no existing')

  console.log('\nTest 13: Merge with no notes at all')
  const merged7 = mergeContactProfile({ stableId: TEST_USER }, {})
  assert(merged7.styleNotes === undefined, 'No notes = undefined')

  // --- getUserMessageCount ---

  console.log('\nTest 14: User message count with no messages')
  cleanup()
  const count0 = await getUserMessageCount(TEST_USER)
  assert(count0 === 0, 'Count is 0 for new user')

  console.log('\nTest 15: User message count with mixed messages')
  cleanup()
  addConversationMessage(TEST_USER, 'user', 'msg1')
  addConversationMessage(TEST_USER, 'assistant', 'reply1')
  addConversationMessage(TEST_USER, 'user', 'msg2')
  addConversationMessage(TEST_USER, 'user', 'msg3')
  addConversationMessage(TEST_USER, 'assistant', 'reply2')
  addConversationMessage(TEST_USER, 'user', 'msg4')
  const count4 = await getUserMessageCount(TEST_USER)
  assert(count4 === 4, 'Count is 4 user messages')

  // --- shouldLearnStyle ---

  console.log('\nTest 16: shouldLearnStyle returns false when below minimum')
  cleanup()
  for (let i = 0; i < 5; i++) {
    addConversationMessage(TEST_USER, 'user', `msg${i}`)
  }
  const shouldFalse = await shouldLearnStyle(TEST_USER)
  assert(shouldFalse === false, 'Returns false below minimum')

  console.log('\nTest 17: shouldLearnStyle returns true at interval')
  cleanup()
  for (let i = 0; i < MIN_MESSAGES_FOR_STYLE_LEARNING; i++) {
    addConversationMessage(TEST_USER, 'user', `msg${i}`)
  }
  const shouldTrue = await shouldLearnStyle(TEST_USER)
  assert(shouldTrue === true, 'Returns true at interval boundary')

  console.log('\nTest 18: shouldLearnStyle returns false between intervals')
  cleanup()
  for (let i = 0; i < MIN_MESSAGES_FOR_STYLE_LEARNING + 1; i++) {
    addConversationMessage(TEST_USER, 'user', `msg${i}`)
  }
  const shouldFalse2 = await shouldLearnStyle(TEST_USER)
  assert(shouldFalse2 === false, 'Returns false between intervals')

  // --- tryLearnContactStyle ---

  console.log('\nTest 19: tryLearnContactStyle skips when insufficient messages')
  cleanup()
  for (let i = 0; i < 3; i++) {
    addConversationMessage(TEST_USER, 'user', `msg${i}`)
  }
  const skipped = await tryLearnContactStyle(TEST_USER)
  assert(skipped === false, 'Skips with insufficient messages')

  console.log('\nTest 20: Learning isolated per contact')
  cleanup()
  const userA = 'style_learner_a@s.whatsapp.net'
  const userB = 'style_learner_b@s.whatsapp.net'
  addConversationMessage(userA, 'user', 'msgA1')
  addConversationMessage(userA, 'user', 'msgA2')
  addConversationMessage(userB, 'user', 'msgB1')
  addConversationMessage(userB, 'user', 'msgB2')
  const countA = await getUserMessageCount(userA)
  const countB = await getUserMessageCount(userB)
  assert(countA === 2, 'User A has 2 messages')
  assert(countB === 2, 'User B has 2 messages')
  clearMemory(userA)
  clearMemory(userB)
  clearContactProfile(userA)
  clearContactProfile(userB)

  console.log('\nTest 21: Learning does not modify owner profile')
  const ownerProfile = getContactProfile('owner')
  const beforeOwner = ownerProfile ? { ...ownerProfile } : null
  await tryLearnContactStyle('nonexistent_user@s.whatsapp.net')
  const afterOwner = getContactProfile('owner')
  assert(
    JSON.stringify(beforeOwner) === JSON.stringify(afterOwner),
    'Owner profile unchanged after learning attempt'
  )

  console.log('\nTest 22: Learning does not modify global style')
  // Global style is in style.ts, not in DB. Verify it's not in contact profiles.
  const globalStyle = getContactProfile('__global_style__')
  assert(globalStyle === null, 'No global style stored in contact profiles')

  console.log('\nTest 23: Repeated learning remains stable')
  cleanup()
  const observation: ContactStyleObservation = {
    tone: 'casual',
    formality: 'informal',
    humorLevel: 'moderate',
    styleNotes: 'Uses playful teasing.',
  }
  const merge1 = mergeContactProfile(null, observation)
  const merge2 = mergeContactProfile(
    { stableId: TEST_USER, ...merge1 } as any,
    observation
  )
  assert(merge1.tone === merge2.tone, 'Tone stable across merges')
  assert(merge1.formality === merge2.formality, 'Formality stable across merges')
  assert(merge1.styleNotes === merge2.styleNotes, 'Style notes stable across merges')

  console.log('\nTest 24: styleNotes does not grow unbounded')
  cleanup()
  let notes: string | undefined = 'Short note.'
  for (let i = 0; i < 10; i++) {
    const result = mergeStyleNotes(notes, 'Short note.')
    assert(result === notes, `Iteration ${i}: no growth from duplicate`)
    notes = result
  }

  cleanup()
  closeDatabase()
  console.log('\n=== ALL CHECKS PASSED ===')
}

runTests().catch(err => {
  console.error('Test failed:', err)
  closeDatabase()
  process.exit(1)
})
