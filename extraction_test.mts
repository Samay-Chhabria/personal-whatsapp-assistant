import { extractPersonalFacts } from './src/memory'
import { addMemory, getPersonalFacts } from './src/memory'

// Test 1: Name and age
const result1 = await extractPersonalFacts('My name is Ali and I am 21 years old.')
console.log('Test 1 - name and age:', JSON.stringify(result1))
console.assert(result1.facts.some((f: any) => f.key === 'name' && f.value === 'Ali'), 'name should be Ali')
console.assert(result1.facts.some((f: any) => f.key === 'age' && f.value === 21), 'age should be 21')

// Test 2: City and hobby
const result2 = await extractPersonalFacts('I live in Lahore and I love cricket.')
console.log('Test 2 - city and hobby:', JSON.stringify(result2))
console.assert(result2.facts.some((f: any) => f.key === 'city' && f.value === 'Lahore'), 'city should be Lahore')
console.assert(result2.facts.some((f: any) => f.key === 'hobbies' && f.value === 'cricket'), 'hobby should be cricket')

// Test 3: Unrelated message - should return empty facts
const result3 = await extractPersonalFacts('What is LangChain?')
console.log('Test 3 - unrelated:', JSON.stringify(result3))
console.assert(result3.facts.length === 0, 'should have no facts')

// Test 4: Multiple facts in one message
const result4 = await extractPersonalFacts('My name is Sara, I am 25, I am a developer, and I love pizza.')
console.log('Test 4 - multiple facts:', JSON.stringify(result4))

// Test 5: Update existing fact
addMemory('test_user', 'city', 'Original City')
const result5 = await extractPersonalFacts('I moved to Karachi.')
console.log('Test 5 - update city:', JSON.stringify(result5))
const facts5 = getPersonalFacts('test_user')
console.log('test_user facts after update:', facts5)
console.assert(facts5.city === 'Karachi', 'city should be updated to Karachi')

// Test 6: User isolation
addMemory('user1', 'name', 'Ali')
addMemory('user2', 'name', 'Sara')
const f1 = getPersonalFacts('user1')
const f2 = getPersonalFacts('user2')
console.log('Test 6 - user isolation:', f1, f2)
console.assert(f1.name === 'Ali', 'user1 name should be Ali')
console.assert(f2.name === 'Sara', 'user2 name should be Sara')
console.assert(f1.name !== f2.name, 'users should have different names')

console.log('\nAll tests completed!')