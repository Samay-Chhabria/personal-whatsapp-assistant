import { getOwnerProfile, buildOwnerContext } from './src/owner'
import { getAssistantSystemPrompt, getAssistantIntroduction } from './src/assistant'

let passed = true

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    passed = false
  }
}

// Test 1: Owner profile exists and is an object
console.log('=== Test 1: Owner profile exists ===')
const profile = getOwnerProfile()
assert(typeof profile === 'object', 'should be an object')
assert(profile !== null, 'should not be null')
console.log('Profile:', profile)

// Test 2: Owner profile has valid optional field types
console.log('\n=== Test 2: Field types ===')
if (profile.name !== undefined) assert(typeof profile.name === 'string', 'name should be string')
if (profile.preferredName !== undefined) assert(typeof profile.preferredName === 'string', 'preferredName should be string')
if (profile.occupation !== undefined) assert(typeof profile.occupation === 'string', 'occupation should be string')
if (profile.university !== undefined) assert(typeof profile.university === 'string', 'university should be string')
if (profile.location !== undefined) assert(typeof profile.location === 'string', 'location should be string')
if (profile.languages !== undefined) assert(Array.isArray(profile.languages), 'languages should be array')
if (profile.communicationStyle !== undefined) assert(typeof profile.communicationStyle === 'string', 'communicationStyle should be string')
if (profile.personality !== undefined) assert(Array.isArray(profile.personality), 'personality should be array')
if (profile.interests !== undefined) assert(Array.isArray(profile.interests), 'interests should be array')
if (profile.commonExpressions !== undefined) assert(Array.isArray(profile.commonExpressions), 'commonExpressions should be array')
if (profile.additionalContext !== undefined) assert(typeof profile.additionalContext === 'string', 'additionalContext should be string')
console.log('Field types valid')

// Test 3: getOwnerProfile returns consistent result
console.log('\n=== Test 3: Consistency ===')
const profile2 = getOwnerProfile()
assert(JSON.stringify(profile) === JSON.stringify(profile2), 'should return consistent results')
console.log('Consistent')

// Test 4: buildOwnerContext returns a string
console.log('\n=== Test 4: buildOwnerContext ===')
const context = buildOwnerContext()
assert(typeof context === 'string', 'should return a string')
console.log(`Context length: ${context.length} characters`)
console.log('Context:', context || '(empty - all fields undefined)')

// Test 5: Owner context does not contain secrets
console.log('\n=== Test 5: No secrets ===')
assert(!context.includes('sk-'), 'should not contain API keys')
assert(!context.includes('OPENROUTER'), 'should not contain env variable names')
console.log('No secrets found')

// Test 6: Assistant system prompt contains owner context
console.log('\n=== Test 6: System prompt includes owner context ===')
const prompt = getAssistantSystemPrompt()
assert(prompt.includes('Owner Relationship'), 'should include Owner Relationship section')
assert(prompt.includes('OWNER PROFILE'), 'should include OWNER PROFILE section')
assert(prompt.includes('you represent a specific person'), 'should establish representation')
console.log('Owner context integrated')

// Test 7: Assistant introduction exists
console.log('\n=== Test 7: Assistant introduction ===')
const intro = getAssistantIntroduction()
assert(typeof intro === 'string', 'should return a string')
assert(intro.length > 0, 'should not be empty')
assert(intro.includes('assistant'), 'should describe the assistant role')
console.log('Introduction:', intro)

// Test 8: System prompt does not fabricate owner info when profile is empty
console.log('\n=== Test 8: No fabricated owner info ===')
if (profile.name === undefined) {
  assert(!prompt.includes('Name:'), 'should not include Name when undefined')
}
if (profile.occupation === undefined) {
  assert(!prompt.includes('Occupation:'), 'should not include Occupation when undefined')
}
console.log('No fabricated info')

console.log('\n' + (passed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='))
process.exit(passed ? 0 : 1)
