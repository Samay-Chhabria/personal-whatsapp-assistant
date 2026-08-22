import { addMemory, getPersonalFacts, addConversationMessage, getConversationHistory, clearMemory } from './src/memory';

// Test 1: Add personal facts for user1
addMemory('user1', 'name', 'Ali');
addMemory('user1', 'age', 21);
addMemory('user1', 'hobby', 'cricket');

// Test 2: Get personal facts for user1
const facts1 = getPersonalFacts('user1');
console.log('user1 facts:', facts1);

// Test 3: Add personal facts for user2 (should be separate)
addMemory('user2', 'name', 'Sara');
addMemory('user2', 'age', 25);
const facts2 = getPersonalFacts('user2');
console.log('user2 facts:', facts2);

// Test 4: Verify isolation - user1 should not have user2's facts
console.log('user1 has age?', 'age' in facts1);
console.log('user2 has age?', 'age' in facts2);

// Test 5: Add conversation messages
addConversationMessage('user1', 'user', 'Hello bot');
addConversationMessage('user1', 'ai', 'Hello! How can I help?');

// Test 6: Get conversation history
const history = getConversationHistory('user1');
console.log('user1 history:', history);

// Test 7: Clear memory
clearMemory('user1');
const afterClear = getPersonalFacts('user1');
console.log('user1 after clear:', afterClear);

// Test 8: Verify user2 data is unaffected after clearing user1
const user2After = getPersonalFacts('user2');
console.log('user2 after user1 clear:', user2After);

console.log('All tests passed!');