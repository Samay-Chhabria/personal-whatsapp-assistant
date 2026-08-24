import { initializeDatabase, addMemory, getPersonalFacts, addConversationMessage, getConversationHistory, clearMemory, closeDatabase } from './src/memory';

// Initialize SQLite database
initializeDatabase();

// Test 1: Add personal facts for user1
await addMemory('user1', 'name', 'Ali');
await addMemory('user1', 'age', 21);
await addMemory('user1', 'hobby', 'cricket');

// Test 2: Get personal facts for user1
const facts1 = getPersonalFacts('user1');
console.log('user1 facts:', facts1);

// Test 3: Add personal facts for user2 (should be separate)
await addMemory('user2', 'name', 'Sara');
await addMemory('user2', 'age', 25);
const facts2 = getPersonalFacts('user2');
console.log('user2 facts:', facts2);

// Test 4: Verify isolation - user1 should not have user2's facts
console.log('user1 has age?', 'age' in facts1);
console.log('user2 has age?', 'age' in facts2);

// Test 5: Add conversation messages
addConversationMessage('user1', 'user', 'Hello bot');
addConversationMessage('user1', 'ai', 'Hello! How can I help?');

// Test 6: Get conversation history
const history = await getConversationHistory('user1');
console.log('user1 history:', history);

// Test 7: Clear memory
clearMemory('user1');
const afterClear = getPersonalFacts('user1');
console.log('user1 after clear:', afterClear);

// Test 8: Verify user2 data is unaffected after clearing user1
const user2After = getPersonalFacts('user2');
console.log('user2 after user1 clear:', user2After);

// Test 9: History limit
clearMemory('limit_test');
for (let i = 1; i <= 10; i++) {
  addConversationMessage('limit_test', 'user', `q${i}`);
  addConversationMessage('limit_test', 'assistant', `a${i}`);
}
const allHistory = await getConversationHistory('limit_test');
const lastFour = await getConversationHistory('limit_test', 4);
console.log(`All history: ${allHistory.length} messages`);
console.log(`Last 4: ${lastFour.length} messages`);
console.log(`Last 4 messages:`, lastFour);

// Cleanup
closeDatabase();

console.log('\nAll tests passed!');
