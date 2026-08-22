# WhatsApp Chatbot - RUN GUIDE

## 1. Prerequisites

- **Node.js**: Version 18+ recommended (the project uses TypeScript and modern features)
- **npm**: Comes with Node.js
- **WhatsApp account**: Required for Baileys authentication (WhatsApp Web or Desktop)
- **OpenRouter API key**: Required for LLM calls. Sign up at [openrouter.ai](https://openrouter.ai)

> **Note**: This chatbot uses the `@whiskeysockets/baileys` library for WhatsApp connectivity. It does **not** work with the official WhatsApp Business API. A standard WhatsApp account is sufficient.

## 2. Installation

```bash
npm install
```

This installs all dependencies listed in `package.json`, including:
- `@whiskeysockets/baileys` - WhatsApp Web socket client
- `@langchain/openrouter` - OpenRouter LLM integration
- `@langchain/openai` - OpenAI embeddings (for RAG)
- `@langchain/core` - LangChain core utilities
- `@types/node` - TypeScript node types
- `dotenv` - Environment variable loading

## 3. Environment Configuration

Copy the `.env` file (or create one if missing) and set the required variables:

```bash
cp .env.example .env
```

### Required `.env` variables:

| Variable | Required? | Description |
|----------|-----------|-------------|
| `OPENROUTER_API_KEY` | **Yes** | OpenRouter API key for the LangChain LLM. **Never commit this to version control.** |
| `OPENROUTER_MODEL` | Optional | Model name, defaults to `anthropic/claude-3.5-sonnet` if omitted |

### Safe `.env.example` (do not include real keys):

```env
# OpenRouter API key (REQUIRED)
OPENROUTER_API_KEY=sk-your_openrouter_api_key_here

# OpenRouter model (OPTIONAL, defaults to anthropic/claude-3.5-sonnet)
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Where NOT to put credentials:

- **Never** commit `.env` to the repository
- **Never** hardcode API keys in source files
- **Never** commit Baileys authentication/session files (see "Security" section)

The `.gitignore` file excludes `node_modules/`, `dist/`, `auth/`, `*.log`, and `.env`.

## 4. Running the Bot

### Start command:

```bash
npm run dev
```

This runs `tsx src/index.ts`, which:

1. Starts the WhatsApp Baileys client
2. Prompts for QR code authentication on first run (see below)
3. Listens for incoming messages
4. Generates AI responses and sends them back

### First-startup behavior:

1. On **first run**, the bot will output: `Waiting for QR code scan...`
2. A QR code will appear in the console (or you can scan it using the Baileys flow)
3. Scan the QR code with your WhatsApp app (Settings → Linked Devices → Link a device)
4. Once scanned, the session is saved in `auth/creds.json`
5. On **subsequent runs**, the bot will restore the saved session automatically and skip the QR step

### WhatsApp Authentication

- Baileys uses **QR code authentication** for initial setup
- Session data is stored in `auth/creds.json` (already git-ignored)
- After the first successful scan, the bot remembers the session and reconnects automatically
- If the session expires or `auth/creds.json` is deleted, the QR code prompt appears again

### Reconnection

The bot handles connection events:
- `open` → Logs "WhatsApp connected successfully"
- `connecting` → Logs "Connecting to WhatsApp..."
- `close` → If previously authenticated, attempts to reconnect
- `reconnecting` → Logs "Reconnecting to WhatsApp..."
- `unauthenticated` → Logs "Session unauthenticated, please scan QR code"

## 5. Testing the Chatbot

Here are example WhatsApp conversations to verify the bot is working:

### Normal Conversation

```text
User: Hello
Bot: [LLM responds with a greeting through OpenRouter]
```

### RAG Question (knowledge base)

```text
User: What is LangChain?
Bot: [Answer grounded in knowledge.txt - explains LangChain is a framework for building LLM applications]
```

### Storing Personal Information

```text
User: My name is Ali and I am 21 years old.
→ Facts stored: name → Ali, age → 21
```

### Multiple Personal Facts

```text
User: I live in Lahore, work as a developer, and enjoy cricket and gaming.
→ Facts stored: city → Lahore, profession → developer, hobbies → cricket and gaming
```

### Updating a Personal Fact

```text
User: I moved to Karachi.
→ City updated: Karachi (overwrites previous value)
```

### Memory Retrieval

```text
User: What do you know about me?
Bot: Here's what I remember about you:
• Name: Ali
• Age: 21
• City: Lahore
• Hobby: cricket

User: Who am I?
→ Same response as above

User: What do you remember about me?
→ Same response as above

User: List everything you remember about me.
→ Same response as above
```

### Empty Memory (New User)

```text
User: What do you know about me?
Bot: I don't have any personal information about you yet.
```

### User Isolation (Second User)

```text
# User A:
User A: My name is Ali.
→ User A's facts stored: name → Ali

# User B (different WhatsApp account/JID):
User B: What do you know about me?
→ Bot: I don't have any personal information about you yet.  (NOT Ali's info)
```

### Combined Behavior (Memory + RAG)

```text
User: My name is Ali. What is RAG?
→ 1. Fact stored: name → Ali
→ 2. RAG answers: [RAG-grounded response about RAG from knowledge.txt]
```

### Conversational Memory (Session-Persistent)

Within the same running session, the bot remembers the conversation history:

```text
User: Hello
Bot: Hello! How can I help you?
User: What is RAG?
Bot: [RAG answer]
User: Tell me more
Bot: [Continues conversation, references previous context]
```

## 6. RAG (Retrieval-Augmented Generation)

### Knowledge Base Location

- `knowledge/knowledge.txt` - Custom text file containing the knowledge base
- Currently contains 21 lines about LangChain concepts (chat models, prompt templates, document loaders, text splitting, embeddings, vector stores, retrievers, RAG, chains, agents)

### How It Works

1. **Documents → Chunks**: The text is split into 1000-character chunks with 200-character overlap
2. **Chunks → Embeddings**: `OpenAIEmbeddings` converts each chunk into a vector
3. **Vector Store**: In-memory store with cosine similarity search
4. **Retrieval**: User query → embedding → cosine similarity against all chunk embeddings → top 4 most similar chunks returned
5. **LLM Generation**: The retrieved chunks are included in the prompt context, and the LLM answers using that context (grounded in the knowledge base)

### Adding/Updating Knowledge Base

- Edit `knowledge/knowledge.txt` directly
- The next message processed will re-initialize RAG (if not already initialized) and use the updated content
- Vector store is lazily initialized and cached

## 7. Memory (Personal Information)

### How Personal Facts Are Detected and Stored

1. When a user sends a message, `extractPersonalFacts()` (LangChain-based) analyzes the message
2. The LLM extracts explicit facts: name, age, city, profession, favorite food, hobbies, preferences, arbitrary stated facts
3. Facts that match `ALLOWED_FACT_KEYS` are stored via `addMemory(userId, key, value)`
4. Stored in the per-user `Map<string, unknown>` facts map

### How Conversation Memory Works

- Uses LangChain's `InMemoryChatMessageHistory` per user
- `addConversationMessage(userId, role, content)` stores messages
- `getConversationHistory(userId)` retrieves them
- History is maintained across messages within the same running session

### Session-Based Memory

- Memory is **session-based**: it persists for the lifetime of the running chatbot process
- If the bot is restarted, memory is cleared (unless persistence is added later)
- Each WhatsApp JID has completely separate memory

### Per-User Isolation

- Memory store: `Map<string, { history, facts }>` where the key is the WhatsApp JID
- User A's facts never appear when User B asks "What do you know about me?"
- The `sender` (WhatsApp JID) is passed with every message and used to scope all memory operations

## 8. Troubleshooting

| Problem | Solution |
|---------|----------|
| **QR code not scanning / authentication issues** | Delete `auth/creds.json` and restart (`npm run dev`). Ensure your WhatsApp app supports linked devices. |
| **Missing `OPENROUTER_API_KEY` environment variable** | Set `OPENROUTER_API_KEY=sk-...` in your `.env` file. The bot will throw a clear error if missing. |
| **LLM/API errors** | The workflow catches LLM errors and sends "Sorry, I encountered an error processing your message." to WhatsApp. The process does **not** crash. |
| **RAG/embedding errors** | Similar graceful handling - errors are logged and returned as "Error retrieving knowledge context." |
| **WhatsApp connection/reconnection issues** | Delete `auth/creds.json` and restart. Ensure internet connection. The bot handles reconnection internally. |
| **Bot not responding to messages** | Check console for errors. Ensure `npm run dev` is running. Verify WhatsApp is still connected. |

## 9. Security

- **Never commit `.env`** to version control
- **Never commit API keys** (OpenRouter key, etc.)
- **Never commit Baileys authentication/session files** - `auth/creds.json` is git-ignored
- The `.env` file is listed in `.gitignore`
- Keep your OpenRouter API key confidential - it enables LLM calls

## 10. License

This project is licensed for personal/learning use.

---

**Running the bot summary:**

```bash
npm install        # first time only
npm run dev        # start the bot
# Then scan QR code with WhatsApp
```

**Key files:**
- `src/workflow.ts` - AI routing/orchestration
- `src/rag.ts` - Knowledge retrieval
- `src/memory.ts` - Per-user personal facts + history
- `src/extraction.ts` - LLM-based fact extraction
- `src/llm.ts` - Model configuration (OpenRouter)
- `src/whatsapp.ts` - Baileys WhatsApp transport
- `knowledge/knowledge.txt` - Custom knowledge base
- `.env` - API key configuration (never commit!)