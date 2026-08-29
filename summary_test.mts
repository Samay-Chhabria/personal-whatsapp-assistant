import {
  initializeDatabase,
  addConversationMessage,
  getConversationHistory,
  getMessageCount,
  getConversationSummary,
  getSummaryRecord,
  upsertConversationSummary,
  clearConversationSummary,
  clearMemory,
  closeDatabase,
} from './src/memory'
import {
  shouldGenerateSummary,
  buildSummaryContext,
  generateConversationSummary,
  getMessagesForSummary,
  setSummaryModelFn,
  SUMMARY_TRIGGER_MESSAGES,
  SUMMARY_HISTORY_WINDOW,
} from './src/summary'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

// --- Test 1: Database initialization creates conversation_summaries ---
console.log('=== Test 1: Database initialization ===')
initializeDatabase()
console.log('Database initialized with conversation_summaries table')

// --- Test 2: Create summary ---
console.log('\n=== Test 2: Create summary ===')
const testUser2 = 'summary_test_user_2'
clearMemory(testUser2)
upsertConversationSummary(testUser2, 'Initial summary of the conversation.')
const summary2 = getConversationSummary(testUser2)
assert(summary2 === 'Initial summary of the conversation.', 'summary should match')
console.log('Summary created:', summary2)

// --- Test 3: Retrieve summary ---
console.log('\n=== Test 3: Retrieve summary ===')
const retrieved = getConversationSummary(testUser2)
assert(retrieved === 'Initial summary of the conversation.', 'retrieved summary should match')
console.log('Summary retrieved:', retrieved)

// --- Test 4: Update summary ---
console.log('\n=== Test 4: Update summary ===')
upsertConversationSummary(testUser2, 'Updated summary with new information.')
const updated = getConversationSummary(testUser2)
assert(updated === 'Updated summary with new information.', 'updated summary should match')
console.log('Summary updated:', updated)

// --- Test 5: Persistence after database restart ---
console.log('\n=== Test 5: Persistence ===')
const testUser5 = 'summary_test_user_5'
clearMemory(testUser5)
upsertConversationSummary(testUser5, 'Persistent summary content.')
const before = getConversationSummary(testUser5)
assert(before === 'Persistent summary content.', 'summary should exist before close')

closeDatabase()
initializeDatabase()

const after = getConversationSummary(testUser5)
assert(after === 'Persistent summary content.', 'summary should persist after restart')
console.log('Persistence verified')

// --- Test 6: Contact isolation ---
console.log('\n=== Test 6: Contact isolation ===')
const testUserA = 'summary_test_user_a'
const testUserB = 'summary_test_user_b'
clearMemory(testUserA)
clearMemory(testUserB)

upsertConversationSummary(testUserA, 'Summary for user A')
upsertConversationSummary(testUserB, 'Summary for user B')

const summaryA = getConversationSummary(testUserA)
const summaryB = getConversationSummary(testUserB)

assert(summaryA === 'Summary for user A', 'user A summary should match')
assert(summaryB === 'Summary for user B', 'user B summary should match')

clearConversationSummary(testUserA)
const afterClearA = getConversationSummary(testUserA)
const afterClearB = getConversationSummary(testUserB)

assert(afterClearA === null, 'user A summary should be cleared')
assert(afterClearB === 'Summary for user B', 'user B summary should remain')
console.log('Contact isolation verified')

// --- Test 7: clearMemory removes summary ---
console.log('\n=== Test 7: clearMemory removes summary ===')
const testUser7 = 'summary_test_user_7'
addConversationMessage(testUser7, 'user', 'Hello')
addConversationMessage(testUser7, 'assistant', 'Hi there')
upsertConversationSummary(testUser7, 'Summary that should be cleared')

const beforeClear = getConversationSummary(testUser7)
assert(beforeClear === 'Summary that should be cleared', 'summary should exist before clear')

clearMemory(testUser7)
const afterClear = getConversationSummary(testUser7)
assert(afterClear === null, 'summary should be removed after clearMemory')

const historyAfterClear = await getConversationHistory(testUser7)
assert(historyAfterClear.length === 0, 'messages should also be cleared')
console.log('clearMemory removes summary')

// --- Test 8: Empty summary handling ---
console.log('\n=== Test 8: Empty summary handling ===')
const testUser8 = 'summary_test_user_8'
clearMemory(testUser8)

const emptySummary = getConversationSummary(testUser8)
assert(emptySummary === null, 'non-existent summary should return null')

const emptyContext = buildSummaryContext(null)
assert(emptyContext === '', 'null summary should return empty context')

upsertConversationSummary(testUser8, '')
const emptyStringSummary = getConversationSummary(testUser8)
assert(emptyStringSummary === '', 'empty string summary should be stored')
const emptyStringContext = buildSummaryContext(emptyStringSummary)
assert(emptyStringContext === '', 'empty string summary should return empty context')
console.log('Empty summary handling works')

// --- Test 9: Summary replacement ---
console.log('\n=== Test 9: Summary replacement ===')
const testUser9 = 'summary_test_user_9'
clearMemory(testUser9)

upsertConversationSummary(testUser9, 'First version of summary.')
const first = getConversationSummary(testUser9)
assert(first === 'First version of summary.', 'first version should be stored')

upsertConversationSummary(testUser9, 'Second version of summary.')
const second = getConversationSummary(testUser9)
assert(second === 'Second version of summary.', 'second version should replace first')
assert(second !== first, 'summaries should be different')
console.log('Summary replacement works')

// --- Test 10: Trigger threshold ---
console.log('\n=== Test 10: Trigger threshold ===')
const testUser10 = 'summary_test_user_10'
clearMemory(testUser10)

// No messages - should not trigger
assert(shouldGenerateSummary(testUser10) === false, 'should not trigger with 0 messages')

// Add messages up to threshold - 1
for (let i = 0; i < SUMMARY_TRIGGER_MESSAGES - 1; i++) {
  addConversationMessage(testUser10, 'user', `message ${i}`)
}
assert(shouldGenerateSummary(testUser10) === false, `should not trigger at ${SUMMARY_TRIGGER_MESSAGES - 1} messages`)

// Add one more to hit threshold
addConversationMessage(testUser10, 'assistant', 'response')
assert(shouldGenerateSummary(testUser10) === true, `should trigger at ${SUMMARY_TRIGGER_MESSAGES} messages`)

// Add more messages - should not trigger until next multiple
for (let i = 0; i < SUMMARY_TRIGGER_MESSAGES - 1; i++) {
  addConversationMessage(testUser10, 'user', `extra message ${i}`)
}
assert(shouldGenerateSummary(testUser10) === false, 'should not trigger between thresholds')

// Hit next threshold
addConversationMessage(testUser10, 'assistant', 'next response')
assert(shouldGenerateSummary(testUser10) === true, 'should trigger at next threshold')
console.log('Trigger threshold works')

// --- Test 11: Configurable limits ---
console.log('\n=== Test 11: Configurable limits ===')
assert(typeof SUMMARY_TRIGGER_MESSAGES === 'number', 'SUMMARY_TRIGGER_MESSAGES should be a number')
assert(SUMMARY_TRIGGER_MESSAGES > 0, 'SUMMARY_TRIGGER_MESSAGES should be positive')
assert(typeof SUMMARY_HISTORY_WINDOW === 'number', 'SUMMARY_HISTORY_WINDOW should be a number')
assert(SUMMARY_HISTORY_WINDOW > 0, 'SUMMARY_HISTORY_WINDOW should be positive')
console.log('Configurable limits are valid')

// --- Test 12: Existing functionality remains intact ---
console.log('\n=== Test 12: Existing functionality intact ===')
const testUser12 = 'summary_test_user_12'
clearMemory(testUser12)

// Add conversation messages
addConversationMessage(testUser12, 'user', 'Hello')
addConversationMessage(testUser12, 'assistant', 'Hi!')
addConversationMessage(testUser12, 'user', 'How are you?')
addConversationMessage(testUser12, 'assistant', 'I am good!')

// Verify messages are stored
const history12 = await getConversationHistory(testUser12)
assert(history12.length === 4, 'should have 4 messages')
assert(history12[0].content === 'Hello', 'first message should match')
assert(history12[1].content === 'Hi!', 'second message should match')

// Verify message count
const count12 = getMessageCount(testUser12)
assert(count12 === 4, 'message count should be 4')

// Summary can coexist with messages
upsertConversationSummary(testUser12, 'Test summary')
const summary12 = getConversationSummary(testUser12)
assert(summary12 === 'Test summary', 'summary should coexist with messages')

const historyAfterSummary = await getConversationHistory(testUser12)
assert(historyAfterSummary.length === 4, 'messages should still exist after adding summary')
console.log('Existing functionality intact')

// --- Test 13: buildSummaryContext formatting ---
console.log('\n=== Test 13: buildSummaryContext formatting ===')
const context = buildSummaryContext('User is a software developer interested in AI.')
assert(context.includes('CONVERSATION SUMMARY:'), 'context should include header')
assert(context.includes('User is a software developer'), 'context should include summary text')
assert(context.includes('---'), 'context should include delimiters')
assert(context.includes('Do not explicitly reference'), 'context should include usage instructions')
console.log('buildSummaryContext formatting correct')

// --- Test 14: Summary record carries watermark ---
console.log('\n=== Test 14: Summary record carries watermark ===')
const testUser14 = 'summary_test_user_14'
clearMemory(testUser14)
upsertConversationSummary(testUser14, 'S14', 25)
const rec14 = getSummaryRecord(testUser14)
assert(rec14 !== null, 'record should exist')
assert(rec14!.summary === 'S14', 'summary should match')
assert(rec14!.lastSummarizedMessageId === 25, 'watermark should match')
console.log('Watermark stored and retrieved')

// --- Test 15: First summary uses full history (not limited to 40) ---
console.log('\n=== Test 15: First summary uses full history ===')
const testUser15 = 'summary_test_user_15'
clearMemory(testUser15)
for (let i = 1; i <= 60; i++) {
  addConversationMessage(testUser15, i % 2 ? 'user' : 'assistant', `msg ${i}`)
}
const msgs15 = getMessagesForSummary(testUser15, null)
assert(msgs15.length === 60, `first summary should include all 60 messages, got ${msgs15.length}`)
assert(msgs15[0].id < msgs15[msgs15.length - 1].id, 'first summary should start at oldest message')
console.log('First summary covers complete history')

// --- Test 16: Subsequent summary uses only messages after watermark ---
console.log('\n=== Test 16: Subsequent summary uses delta after watermark ===')
const testUser16 = 'summary_test_user_16'
clearMemory(testUser16)
for (let i = 1; i <= 60; i++) {
  addConversationMessage(testUser16, i % 2 ? 'user' : 'assistant', `m ${i}`)
}
const all16 = getMessagesForSummary(testUser16, null)
const watermarkId16 = all16[39].id // id of the 40th message for this contact
const existingRec16 = { summary: 'prev', lastSummarizedMessageId: watermarkId16 }
const msgs16 = getMessagesForSummary(testUser16, existingRec16)
assert(msgs16.length === 20, `subsequent summary should include 20 messages, got ${msgs16.length}`)
assert(msgs16[0].id === all16[40].id, 'subsequent summary should start after the watermark')
console.log('Subsequent summary covers only delta')

// --- Test 17: Full pipeline - first + subsequent via stubbed model, no loss ---
console.log('\n=== Test 17: Full pipeline preserves old messages ===')
const testUser17 = 'summary_test_user_17'
clearMemory(testUser17)
for (let i = 1; i <= 60; i++) {
  addConversationMessage(testUser17, i % 2 ? 'user' : 'assistant', `p ${i}`)
}

let captured17 = ''
setSummaryModelFn(async (messages) => {
  captured17 = (messages.find((m) => m.role === 'user')?.content) ?? ''
  return 'SUMMARY_17'
})
await generateConversationSummary(testUser17)
let rec17 = getSummaryRecord(testUser17)
const all17 = getMessagesForSummary(testUser17, null)
const expectedWatermark17 = all17[all17.length - 1].id
assert(rec17 !== null, 'summary record created')
assert(rec17!.lastSummarizedMessageId === expectedWatermark17, `watermark should be max id ${expectedWatermark17} after first run, got ${rec17!.lastSummarizedMessageId}`)

// Add more messages and run again
for (let i = 61; i <= 90; i++) {
  addConversationMessage(testUser17, i % 2 ? 'user' : 'assistant', `p ${i}`)
}
captured17 = ''
await generateConversationSummary(testUser17)
rec17 = getSummaryRecord(testUser17)
const all17b = getMessagesForSummary(testUser17, null)
const expectedWatermark17b = all17b[all17b.length - 1].id
assert(rec17!.lastSummarizedMessageId === expectedWatermark17b, `watermark should advance to ${expectedWatermark17b}, got ${rec17!.lastSummarizedMessageId}`)
assert(captured17.includes(all17b[60].content), 'second run should include delta start (61st message)')
assert(!captured17.includes(all17b[0].content), 'second run should NOT re-summarize oldest message')
console.log('Old messages preserved; delta used for subsequent runs')

// --- Test 18: Watermark does NOT advance after empty/failed generation ---
console.log('\n=== Test 18: Watermark stable on failure ===')
const testUser18 = 'summary_test_user_18'
clearMemory(testUser18)
for (let i = 1; i <= 60; i++) {
  addConversationMessage(testUser18, i % 2 ? 'user' : 'assistant', `q ${i}`)
}
setSummaryModelFn(async () => 'FIRST_OK')
await generateConversationSummary(testUser18)
const before18 = getSummaryRecord(testUser18)!.lastSummarizedMessageId
const expected18 = getMessagesForSummary(testUser18, null)
assert(before18 === expected18[expected18.length - 1].id, 'baseline watermark matches max id')

// empty output (treated as failure)
setSummaryModelFn(async () => '')
for (let i = 61; i <= 80; i++) {
  addConversationMessage(testUser18, i % 2 ? 'user' : 'assistant', `q ${i}`)
}
await generateConversationSummary(testUser18)
const afterEmpty18 = getSummaryRecord(testUser18)!.lastSummarizedMessageId
assert(afterEmpty18 === before18, 'watermark unchanged after empty summary')

// thrown error (treated as failure)
setSummaryModelFn(async () => { throw new Error('boom') })
for (let i = 81; i <= 95; i++) {
  addConversationMessage(testUser18, i % 2 ? 'user' : 'assistant', `q ${i}`)
}
await generateConversationSummary(testUser18)
const afterThrow18 = getSummaryRecord(testUser18)!.lastSummarizedMessageId
assert(afterThrow18 === before18, 'watermark unchanged after thrown error')
console.log('Watermark stable on generation failure')

// --- Test 19: Watermark persists after close/reopen (migration present) ---
console.log('\n=== Test 19: Watermark persists across restart ===')
const testUser19 = 'summary_test_user_19'
clearMemory(testUser19)
upsertConversationSummary(testUser19, 'S19', 77)
closeDatabase()
initializeDatabase()
const rec19 = getSummaryRecord(testUser19)
assert(rec19 !== null && rec19.lastSummarizedMessageId === 77, 'watermark persists after reopen')
console.log('Watermark persisted across restart')

// --- Test 20: Multiple contacts have independent summaries + watermarks ---
console.log('\n=== Test 20: Per-contact independence ===')
const testUserA20 = 'summary_test_user_a20'
const testUserB20 = 'summary_test_user_b20'
clearMemory(testUserA20)
clearMemory(testUserB20)
upsertConversationSummary(testUserA20, 'SA', 10)
upsertConversationSummary(testUserB20, 'SB', 20)
assert(getSummaryRecord(testUserA20)!.lastSummarizedMessageId === 10, 'user A watermark 10')
assert(getSummaryRecord(testUserB20)!.lastSummarizedMessageId === 20, 'user B watermark 20')
console.log('Independent per-contact watermarks verified')

// --- Test 21: clearMemory removes summary + watermark ---
console.log('\n=== Test 21: clearMemory removes summary + watermark ===')
const testUser21 = 'summary_test_user_21'
clearMemory(testUser21)
for (let i = 1; i <= 5; i++) {
  addConversationMessage(testUser21, 'user', `r ${i}`)
}
upsertConversationSummary(testUser21, 'SW', 5)
assert(getSummaryRecord(testUser21) !== null, 'summary+watermark present before clear')
clearMemory(testUser21)
assert(getSummaryRecord(testUser21) === null, 'summary+watermark removed by clearMemory')
console.log('clearMemory removes summary + watermark')

// Cleanup
closeDatabase()

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
