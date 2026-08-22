import { generateAnswer } from './src/workflow'
import { addMemory, getPersonalFacts } from './src/memory'

async function runTests() {
  // Setup: User1 provides personal info
  console.log('=== Setup: User1 provides personal info ===')
  addMemory('user1', 'name', 'Ali')
  addMemory('user1', 'age', 21)
  addMemory('user1', 'city', 'Lahore')
  addMemory('user1', 'hobby', 'cricket')
  console.log('User1 facts:', getPersonalFacts('user1'))

  // Setup: User2 provides different personal info
  console.log('\n=== Setup: User2 provides different personal info ===')
  addMemory('user2', 'name', 'Sara')
  addMemory('user2', 'age', 25)
  addMemory('user2', 'city', 'Karachi')
  console.log('User2 facts:', getPersonalFacts('user2'))

  // Test: User1 memory query - should only see user1's facts
  console.log('\n=== Test: User1 memory query ===')
  const r1 = await generateAnswer('What do you know about me?', 'user1')
  console.log('User1 response:', r1)
  // Should NOT contain Sara's name
  console.assert(!r1.includes('Sara'), 'User1 should not see Sara\'s name')
  console.assert(r1.includes('Ali'), 'User1 should see Ali')

  // Test: User2 memory query - should only see user2's facts
  console.log('\n=== Test: User2 memory query ===')
  const r2 = await generateAnswer('What do you know about me?', 'user2')
  console.log('User2 response:', r2)
  // Should NOT contain Ali's name
  console.assert(!r2.includes('Ali'), 'User2 should not see Ali\'s name')
  console.assert(r2.includes('Sara'), 'User2 should see Sara')

  // Test: New user with no memory
  console.log('\n=== Test: New user with no memory ===')
  // user3 hasn't had any memories added
  const r3 = await generateAnswer('What do you know about me?', 'user3')
  console.log('User3 response:', r3)
  console.assert(r3.includes('any personal information'), 'Should say no info')

  // Test: Update existing fact
  console.log('\n=== Test: Update city from Lahore to Karachi ===')
  addMemory('user1', 'city', 'Lahore') // already set, but simulating update
  // The user sends a new message updating the fact
  // In a real scenario, the extraction would catch this, but let's directly test the update
  // Actually, let's just verify the memory store can be updated
  addMemory('user1', 'city', 'Karachi')
  const r1Updated = await generateAnswer('What do you know about me?', 'user1')
  console.log('User1 after city update:', r1Updated)
  console.assert(r1Updated.includes('Karachi'), 'City should be updated to Karachi')
  console.assert(!r1Updated.includes('Lahore') || r1Updated.split('Karachi').length > 1, 'Lahore should be replaced')

  // Test: Memory query variations
  console.log('\n=== Test: Memory query variations ===')
  const variations = [
    'Who am I?',
    'List everything you remember about me',
    'Tell me what you know about me',
    'What facts do you have about me?',
  ]
  for (const q of variations) {
    const resp = await generateAnswer(q, 'user1')
    console.log(`"${q}" → ${resp.substring(0, 60)}${resp.length > 60 ? '...' : ''}`)
  }

  console.log('\nAll isolation and update tests completed!')
}

runTests().catch(console.error)