import { getAssistantSystemPrompt, getAssistantIntroduction } from './src/assistant'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

// Test 1: getAssistantSystemPrompt returns a non-empty string
console.log('=== Test 1: System prompt is non-empty ===')
const prompt = getAssistantSystemPrompt()
assert(typeof prompt === 'string', 'should return a string')
assert(prompt.length > 0, 'should not be empty')
console.log(`Prompt length: ${prompt.length} characters`)

// Test 2: System prompt defines role
console.log('\n=== Test 2: Role definition ===')
assert(prompt.includes('personal WhatsApp assistant'), 'should define role as personal WhatsApp assistant')
assert(prompt.includes('owner'), 'should reference the owner')

// Test 3: System prompt defines owner relationship
console.log('\n=== Test 3: Owner relationship ===')
assert(prompt.includes('Owner Relationship'), 'should include Owner Relationship section')
assert(prompt.includes('OWNER PROFILE'), 'should include OWNER PROFILE section')
assert(prompt.includes('you represent a specific person'), 'should establish representation')

// Test 4: System prompt defines assistant behavior and communication style
console.log('\n=== Test 4: Assistant behavior and communication style ===')
assert(prompt.includes('Assistant Behavior'), 'should include Assistant Behavior section')
assert(prompt.includes('OWNER COMMUNICATION STYLE'), 'should include OWNER COMMUNICATION STYLE section')
assert(prompt.includes('WhatsApp'), 'should mention WhatsApp')

// Test 5: System prompt defines truthfulness rules
console.log('\n=== Test 5: Truthfulness rules ===')
assert(prompt.includes('Truthfulness'), 'should include Truthfulness section')
assert(prompt.includes('Never fabricate'), 'should prohibit fabrication')

// Test 6: System prompt defines context rules
console.log('\n=== Test 6: Context rules ===')
assert(prompt.includes('Context Rules'), 'should include Context Rules section')
assert(prompt.includes('System instructions'), 'should reference system instructions priority')

// Test 7: System prompt defines WhatsApp rules
console.log('\n=== Test 7: WhatsApp rules ===')
assert(prompt.includes('WhatsApp Rules'), 'should include WhatsApp Rules section')

// Test 8: System prompt does not contain secrets or API keys
console.log('\n=== Test 8: No secrets ===')
assert(!prompt.includes('sk-'), 'should not contain API keys')
assert(!prompt.includes('OPENROUTER'), 'should not contain env variable names')

// Test 9: getAssistantSystemPrompt returns consistent result (cached)
console.log('\n=== Test 9: Consistency ===')
const prompt2 = getAssistantSystemPrompt()
assert(prompt === prompt2, 'should return the same prompt on repeated calls')

// Test 10: System prompt structure is extensible
console.log('\n=== Test 10: Extensibility markers ===')
assert(prompt.includes('##'), 'should use markdown headers for sections')

// Test 11: getAssistantIntroduction exists and is valid
console.log('\n=== Test 11: Assistant introduction ===')
const intro = getAssistantIntroduction()
assert(typeof intro === 'string', 'should return a string')
assert(intro.length > 0, 'should not be empty')
assert(intro.includes('assistant'), 'should describe the assistant role')
console.log('Introduction:', intro)

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
