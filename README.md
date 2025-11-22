# Mycelia Mesh — Sovereign Memory Network
_Built on Submarino, the backchannel for p2p AI agent coordination._

Mycelia Mesh upgrades Submarino from a local-first agent messenger into a federated memory fabric. This README doubles as the hackathon application: it captures the problem we are solving, the Fluence-powered architecture, concrete deliverables, and the implementation details that already exist in this repo.

## Hackathon Snapshot
| Field | Details |
| --- | --- |
| Event | Protocol Labs Hackathon (Sovereign Systems / AI Infrastructure / Fluence) |
| Stage | Working Submarino prototype + Mesh extensions in progress |
| Team | Mycelia Tech |
| Focus | Node-to-node intent coordination + sovereign, decentralized backups |

## One-liner
A federated network of self-sovereign AI memory nodes that securely talk to each other, coordinate intents, and back up encrypted personal knowledge over decentralized infrastructure.

## Problem
Digital memory today is broken. Your thoughts, voice notes, chats, and ideas live inside centralized silos (Google, Notion, OpenAI, Telegram). You rent access to your own history, and the moment a server shuts down, a policy changes, or an account is blocked—your memory disappears.

**Mycelia Mesh fixes this by introducing:**
- Self-sovereign ownership of personal AI memory
- Peer-to-peer intelligence coordination
- Decentralized, censorship-resistant backups
- Infrastructure built for autonomy, not surveillance

If Web3 gave us self-custody for money, Mycelia Mesh gives us self-custody for cognition.

## Solution Overview
Mycelia Mesh is an upgrade layer on top of Mycelia.tech that transforms isolated local memory vaults into a collaborative, peer-to-peer network of AI agents. Submarino supplies the libp2p-powered MCP backchannel; the hackathon work layers on cross-node intent flows and resilient memory replication.

Every participant runs a personal node that:
- Stores and indexes private knowledge locally
- Extracts intents and tasks from personal data
- Broadcasts requests to the network
- Negotiates help from other agents
- Replicates encrypted backups across trusted peers

All of this happens without central servers.

## Hackathon Deliverables
1. **My node talks to your node**
   - libp2p intent broadcast layer on top of Submarino’s messaging stack
   - Capability matching and negotiation between autonomous agents
   - Demo: two sovereign nodes barter context and coordinate execution
2. **Sovereign backups**
   - Encrypted shard replication to trusted peers with heal/restore flows
   - Trust scoring + geo-aware placement heuristics
   - Demo: node loss simulation with deterministic recovery from peers

## Core System Pillars

### 🔗 Node-to-Node Communication (libp2p)
- Secure peer discovery and identity via libp2p
- Intent broadcasting system for task delegation
- Agent-to-agent negotiation and coordination
- Zero central coordinator

### 🧠 Agent Network
- Personal AI agents that understand context and intent
- Multi-agent collaboration across nodes
- Distributed task execution
- Capability matching and reputation layer

### 💾 Sovereign Backups
- Encrypted replication of memory shards
- Trust-scored peer selection
- Geo-distributed redundancy
- Self-healing data recovery

### 🧬 Privacy by Design
- End-to-end encryption
- No plaintext exposure across peers
- Optional zero-knowledge verification layer (future)

## Architecture Overview
```
┌──────────────┐      libp2p       ┌──────────────┐
│ Your Node    │◄────────────────►│ Peer Node    │
│              │                  │              │
│ - Local DB   │                  │ - Local DB   │
│ - AI Agent   │                  │ - AI Agent   │
│ - Intent AI  │                  │ - Intent AI  │
│ - Backup Daemon │               │ - Backup Daemon │
└──────┬───────┘                  └──────┬───────┘
       │                                  │
       ▼                                  ▼
Fluence CPU/GPU                   Fluence CPU/GPU
(Compute & Inference)             (Compute & Inference)
```

## Protocol Labs Track Fit

### 🌎 Secure, Sovereign Systems
- No single point of trust
- P2P coordination via libp2p
- Distributed encrypted backups
- Makes personal data hard to kill or censor

### 🤖 AI & Autonomous Infrastructure
- Multi-agent cooperation layer
- Decentralized intelligence network
- Non-black-box local inference plus provenance
- Agents powered by sovereign personal data

### 🪼 Fluence GPU / CPU Integration
- AI workloads deployed on decentralized compute
- LLM inference outsourced to Fluence GPU containers
- Node orchestration and background services on Fluence CPU cloud
- Fully cloudless architecture

## Fluence Integration

| Component                 | Fluence Integration               |
|---------------------------|-----------------------------------|
| AI inference engine       | Fluence GPU Containers API        |
| Node backend services     | Fluence CPU Cloud                 |
| Agent orchestrator        | Aqua + Marine runtime             |
| Secure task execution     | Isolated Fluence workers          |
| P2P network coordination  | libp2p-managed identity & transport |

## Tech Stack
- libp2p for networking and discovery
- Mycelia Core for the local AI memory engine
- Fluence Cloudless Compute for decentralized hosting
- Vector DB (Qdrant or FAISS)
- Ollama for local LLM inference
- LangGraph for agent workflow orchestration
- AES-256 with a zk-friendly encryption layer roadmap

## Implementation Status
- ✅ **Submarino MCP backchannel**: encrypted libp2p messaging, inbox, contact tools
- ✅ **LlamaIndex knowledge ingestion**: local embeddings and querying (`uv run` scripts)
- 🛠 **Node-to-node intent mesh**: libp2p broadcast + capability negotiation (hackathon build)
- 🛠 **Sovereign backup daemon**: encrypted shards + trust scoring prototype
- 🛤 **ZK request verification + reputation**: design + interfaces for post-hackathon sprint

## Roadmap
- ✅ libp2p communication layer
- ✅ Decentralized backup prototype
- ✅ Fluence compute integration
- ⏳ Zero-knowledge request verification
- ⏳ Reputation scoring system
- ⏳ Post-quantum encryption compatibility

## Getting Started
1. Clone the repository
   ```bash
   git clone https://github.com/mycelia-tech/submarino
   cd submarino
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Configure environment
   ```bash
   cp .env.example .env
   ```
   Set:
   ```
   FLUENCE_PRIVATE_KEY=
   LIBP2P_PEER_ID=
   NODE_NAME=
   ```
4. Start a local node
   ```bash
   npm run node:start
   ```

## Running the Network
Start a second node in another terminal or device:
```bash
npm run node:join -- --peer /ip4/xxx/tcp/xxx
```

Broadcast an intent:
```bash
npm run intent:broadcast "Find best solution for task X"
```

## Example Use Case
You say: “Help me plan a crypto community meetup in Buenos Aires.”

Your node:
1. Extracts the intent
2. Broadcasts it to the network
3. Discovers peers skilled in event planning
4. Agents collaborate and respond
5. Answers return with provenance and context

## Demo Surfaces
- 🌐 Public Endpoint: `https://mycelia-mesh.demo`
- 📡 Peer Discovery Dashboard: `/mesh`
- 🤖 Agent Activity Panel: `/agents`

## Screenshots / Visuals
Coming soon.

## License
MIT License – open-source, forkable, and sovereign by design.

## TL;DR
Mycelia Mesh turns personal AI memory into a sovereign, collaborative intelligence network.

Not your server, not your memory.
Not your node, not your mind.

---

## Implementation Details: Submarino MCP Server

## How the MCP Server Works

Submarino implements a Model Context Protocol (MCP) server that enables AI agents to communicate directly via libp2p, a modular peer-to-peer networking stack. Here's how it works:

### Architecture

1. **MCP Server** (`server.js`):
   - Implements the MCP protocol using `@modelcontextprotocol/sdk`
   - Exposes tools that AI agents can call to send messages, check inbox, and manage contacts
   - Runs on an Express HTTP server that accepts POST requests at `/mcp`

2. **Network Node** (`NetworkNode` class):
   - Uses libp2p to create a peer-to-peer network node
   - Handles peer discovery via mDNS (multicast DNS) for local network discovery
   - Manages peer connections, message routing, and protocol handling
   - Stores peer identity in `.keys/peer-id.json` (persistent across restarts)

3. **Inbox System**:
   - In-memory message storage (Map-based)
   - Tracks messages with read/unread status
   - Filters messages by recipient and read status

4. **Available MCP Tools**:
   - `send_message`: Send messages to one or more peer IDs
   - `check_inbox`: Retrieve messages for a recipient (with optional unread-only filter)
   - `create_contact`: Add a peer ID as a contact
   - `get_contact`: Retrieve contact information by peer ID
   - `list_contacts`: List all saved contacts
   - `update_contact`: Update contact name or metadata
   - `delete_contact`: Remove a contact
   - `get_my_id`: Get the local peer ID and connection status

### Communication Flow

1. **Initialization**: When the server starts, it creates or loads a peer ID and starts the libp2p node
2. **Peer Discovery**: Uses mDNS to discover other Submarino nodes on the local network
3. **Message Sending**: When `send_message` is called:
   - The tool attempts to connect to the target peer(s)
   - Opens a stream using the `/submarino/1.0.0` protocol
   - Sends the message as JSON over the encrypted stream
   - Stores a copy in the local inbox
4. **Message Receiving**: When a message arrives:
   - The protocol handler receives it on the `/submarino/1.0.0` stream
   - Parses the JSON message
   - Stores it in the inbox for the recipient
   - Triggers any registered message handlers

### Security Features

- **Encryption**: All connections use Noise protocol for encryption
- **Authentication**: Peer IDs are cryptographically generated (Ed25519)
- **Direct Communication**: No central server - messages go directly between peers

## Installation & Setup

```bash
npm install
```

### Step 2: Start the MCP Server

The server will start on port 4242 by default (configurable via `PORT` environment variable):

```bash

#  directly with node
node index.js
```

The server will:
- Create a peer ID and save it to `.keys/peer-id.json` (if it doesn't exist)
- Start listening on `http://localhost:4242/mcp`
- Begin peer discovery via mDNS
- Log the server URL and your peer ID

## n8n Setup

### Step 1: Configure MCP Server in n8n

1. Open your n8n instance
2. Navigate to **Settings** → **Model Context Protocol** (or MCP settings)
3. Add a new MCP server with:
   - **URL**: `http://host.docker.internal:4242/mcp` (or `http://localhost:4242/mcp` if not using Docker)

### Step 2: Configure OpenRouter with Llama 3b

1. In n8n, go to **Credentials** → **Add Credential**
2. Select **OpenRouter API**
3. Enter your OpenRouter API key
4. In workflow, use **OpenAI** node with:
   - **Model**: `meta-llama/llama-3.2-3b-instruct:free`
   - **Base URL**: `https://openrouter.ai/api/v1`

### Step 3: Example Chat Workflow

Create a chat workflow that:
1. Uses **Chat Trigger** node to start conversation
2. **OpenAI** node (with Llama 3b) with system prompt: "Ask the user for their peer ID"
3. **MCP Tool** node → `get_my_id` to get your ID
4. **MCP Tool** node → `create_contact` with user's peer ID from chat
5. **MCP Tool** node → `send_message` to send welcome message

**System Prompt Example:**
```
You are a helpful assistant. First, ask the user for their Submarino peer ID.
Once you receive it, add them as a contact and send a welcome message.
```

## Environment Variables

- `PORT`: Server port (default: `4242`)
- `KEY_PATH`: Path to store peer keys (default: `./.keys`)

Example:

```bash
PORT=8080 KEY_PATH=/path/to/keys node index.js
```


## Examples

### Simple agent collaboration demo

Spin up the actor + multiplier + adder example with a single command:

```bash
npm run demo:agents
```

The script launches three peers, shares their multiaddrs, and has the actor agent
dispatch a multiply task followed by a sum task. Check the console log for the
request IDs and final result (`6 * 7 + 5 = 47`). The agents reuse the key
material in `.keys/`, so you can run the demo repeatedly without re-pairing.

### LlamaIndex knowledge base

The repo now ships with a lightweight ingestion/query helper that persists a
vector store under `.llamaindex/agents`. The default dataset is
`examples/llamaindex/sample_agents.json`, which describes the actor, multiplier,
and adder roles used in the demo above.

1. **Ingest data** (use `--reset` the first time to start clean):

   ```bash
   uv run scripts/llamaindex_ingest.py ingest --reset
   ```

   - Add `-i path/to/extra.json` to layer in your own docs (JSON or plain text).
   - The script uses the local `BAAI/bge-small-en-v1.5` embedding model from
     Hugging Face, so the first run may download weights.

2. **Query the store** with natural-language prompts:

   ```bash
   uv run scripts/llamaindex_ingest.py query "Which agent handles multiplication?"
   ```

   The command prints a concise answer plus the top matching source nodes. Feel
   free to tweak `--top-k` or edit `scripts/llamaindex_ingest.py` to plug in
   your preferred LLM for richer responses. The persisted index lives in
   `.llamaindex/agents`, so you can delete or version that directory as needed.
