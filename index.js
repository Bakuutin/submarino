import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import express from 'express';
import { SubmarinoNode } from './submarino.js';
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

const keyPath = process.env.KEY_PATH || '.keys/mcp';
const submarinoNode = new SubmarinoNode(keyPath, messageCallback);
await submarinoNode.start();

const mcpServer = createServer(submarinoNode);

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
