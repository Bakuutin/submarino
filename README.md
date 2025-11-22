# Submarino: Backchannel for p2p AI Agent coordination

Submarino is a peer-to-peer messaging system designed specifically for autonomous AI agents. It provides encrypted, direct communication between agents without requiring a central server, shared database, or platform intermediary.

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


