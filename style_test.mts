import { getCommunicationStyle, buildCommunicationStyleContext } from './src/style'
import { getAssistantSystemPrompt } from './src/assistant'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

// Test 1: Communication style exists and is an object
console.log('=== Test 1: Communication style exists ===')
const style = getCommunicationStyle()
assert(typeof style === 'object', 'should be an object')
assert(style !== null, 'should not be null')
console.log('Style:', style)

// Test 2: Expected fields have correct types
console.log('\n=== Test 2: Field types ===')
if (style.tone !== undefined) assert(typeof style.tone === 'string', 'tone should be string')
if (style.defaultResponseLength !== undefined) assert(typeof style.defaultResponseLength === 'string', 'defaultResponseLength should be string')
if (style.formality !== undefined) assert(typeof style.formality === 'string', 'formality should be string')
if (style.languagePreference !== undefined) assert(typeof style.languagePreference === 'string', 'languagePreference should be string')
if (style.romanUrduUsage !== undefined) assert(typeof style.romanUrduUsage === 'string', 'romanUrduUsage should be string')
if (style.emojiUsage !== undefined) assert(typeof style.emojiUsage === 'string', 'emojiUsage should be string')
if (style.punctuationStyle !== undefined) assert(typeof style.punctuationStyle === 'string', 'punctuationStyle should be string')
if (style.conversationalBehavior !== undefined) assert(Array.isArray(style.conversationalBehavior), 'conversationalBehavior should be array')
if (style.responsePatterns !== undefined) assert(Array.isArray(style.responsePatterns), 'responsePatterns should be array')
console.log('Field types valid')

// Test 3: getCommunicationStyle returns consistent result
console.log('\n=== Test 3: Consistency ===')
const style2 = getCommunicationStyle()
assert(JSON.stringify(style) === JSON.stringify(style2), 'should return consistent results')
console.log('Consistent')

// Test 4: buildCommunicationStyleContext returns a non-empty string
console.log('\n=== Test 4: buildCommunicationStyleContext ===')
const context = buildCommunicationStyleContext()
assert(typeof context === 'string', 'should return a string')
assert(context.length > 0, 'should not be empty')
console.log(`Context length: ${context.length} characters`)
console.log('Context:', context)

// Test 5: No API keys or secrets
console.log('\n=== Test 5: No secrets ===')
assert(!context.includes('sk-'), 'should not contain API keys')
assert(!context.includes('OPENROUTER'), 'should not contain env variable names')
console.log('No secrets found')

// Test 6: Assistant system prompt includes communication style context
console.log('\n=== Test 6: System prompt integration ===')
const prompt = getAssistantSystemPrompt()
assert(prompt.includes('OWNER COMMUNICATION STYLE'), 'should include OWNER COMMUNICATION STYLE section')
assert(prompt.includes('Tone:'), 'should include Tone')
assert(prompt.includes('Conversational behavior:'), 'should include Conversational behavior')
console.log('Integrated correctly')

// Test 7: Context is structured with header
console.log('\n=== Test 7: Context structure ===')
assert(context.startsWith('OWNER COMMUNICATION STYLE:'), 'should start with header')
assert(context.includes('- Tone:'), 'should include tone line')
assert(context.includes('- Default response length:'), 'should include response length line')
assert(context.includes('- Formality:'), 'should include formality line')
assert(context.includes('- Language:'), 'should include language line')
console.log('Structure valid')

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
