import {
  initializeDatabase,
  addConversationMessage,
  getConversationHistory,
  getMessageCount,
  getConversationSummary,
  upsertConversationSummary,
  clearConversationSummary,
  clearMemory,
  closeDatabase,
} from './src/memory'
import {
  shouldGenerateSummary,
  buildSummaryContext,
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

// Cleanup
closeDatabase()

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
