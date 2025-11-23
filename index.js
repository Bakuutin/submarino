import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import express from 'express';
import { SubmarinoNode } from './submarino.js';
import { FilecoinNodeManager } from './filecoin.js';
import { createServer } from './mcp.js';

// Parse command line arguments for --hook flag
let hookUrl = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--hook' && i + 1 < args.length) {
    hookUrl = args[i + 1];
    break;
  }
}

// Create callback function if hook URL is provided
let messageCallback = null;
if (hookUrl) {
  messageCallback = async (message) => {
    try {
      const response = await fetch(hookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        console.error(`Hook request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending message to hook:', error);
    }
  };
  console.log(`Hook URL configured: ${hookUrl}`);
}

const app = express();
app.use(express.json());

const submarinoNode = new SubmarinoNode('.keys/mcp', messageCallback);
await submarinoNode.start();

const filecoinManager = new FilecoinNodeManager();

async function initializeFilecoinIntegration() {
  try {
    await filecoinManager.start();
  } catch (error) {
    console.warn('[filecoin] Failed to initialize node:', error.message);
    return;
  }

  try {
    const status = await filecoinManager.getStatus();
    if (status.ready) {
      console.log(`[filecoin] Connected to RPC ${status.rpcUrl} (height: ${status.height ?? 'unknown'})`);
    } else {
      console.warn('[filecoin] RPC status unknown:', status.error);
    }
  } catch (error) {
    console.warn('[filecoin] Unable to read status:', error.message);
  }

  try {
    await filecoinManager.storeDatabaseSnapshot({
      peerId: submarinoNode.peerId,
      timestamp: new Date().toISOString(),
      trustedPeers: Array.from(submarinoNode.trustedPeers ?? []),
    }, { fileName: 'startup-snapshot.json' });
  } catch (error) {
    console.warn('[filecoin] Unable to push initial snapshot:', error.message);
  }
}

initializeFilecoinIntegration();

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.once(signal, async () => {
    await filecoinManager.stop().catch(() => {});
    process.exit(0);
  });
});

const mcpServer = createServer(submarinoNode);

app.get('/filecoin/health', async (_req, res) => {
    try {
        const status = await filecoinManager.getStatus();
        const payload = {
            ...status,
            timestamp: new Date().toISOString(),
        };
        res.status(status.ready ? 200 : 503).json(payload);
    } catch (error) {
        res.status(500).json({
            ready: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

app.post('/mcp', async (req, res) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '4242');
app.listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});