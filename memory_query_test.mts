import { initializeDatabase, addMemory, getPersonalFacts, closeDatabase } from './src/memory'
import { generateAnswer } from './src/workflow'

// Initialize SQLite database
initializeDatabase();

async function runTests() {
  // Test: User provides personal info
  console.log('=== Test 1: User provides personal info ===')
  await addMemory('user1', 'name', 'Ali')
  await addMemory('user1', 'age', 21)
  await addMemory('user1', 'city', 'Lahore')
  await addMemory('user1', 'hobby', 'cricket')
  console.log('Stored facts for user1:', getPersonalFacts('user1'))

  // Test: Memory query
  console.log('\n=== Test 2: Memory query "What do you know about me?" ===')
  const response1 = await generateAnswer('What do you know about me?', 'user1')
  console.log('Response:', response1)

  // Test: Memory query "Who am I?"
  console.log('\n=== Test 3: Memory query "Who am I?" ===')
  const response2 = await generateAnswer('Who am I?', 'user1')
  console.log('Response:', response2)

  // Test: Memory query "List everything you remember about me"
  console.log('\n=== Test 4: Memory query "List everything you remember about me" ===')
  const response3 = await generateAnswer('List everything you remember about me', 'user1')
  console.log('Response:', response3)

  // Test: Memory query "Tell me what you know about me"
  console.log('\n=== Test 5: Memory query "Tell me what you know about me" ===')
  const response4 = await generateAnswer('Tell me what you know about me', 'user1')
  console.log('Response:', response4)

  // Test: New user with no memory
  console.log('\n=== Test 6: New user with no memory ===')
  // user2 is new, no memories added
  const response5 = await generateAnswer('What do you know about me?', 'user2')
  console.log('Response:', response5)

  // Test: Normal RAG question (should not be affected)
  console.log('\n=== Test 7: Normal RAG question "What is RAG?" ===')
  // This will likely return the error since no API key, but the flow should attempt RAG
  const response6 = await generateAnswer('What is RAG?', 'user1')
  console.log('Response:', response6)

  // Cleanup
  closeDatabase();

  console.log('\nAll tests completed!')
}

runTests().catch(console.error)
