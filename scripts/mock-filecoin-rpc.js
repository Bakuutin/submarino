#!/usr/bin/env node
import express from 'express';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

const host = process.env.MOCK_FILECOIN_HOST || '127.0.0.1';
const port = Number(process.env.MOCK_FILECOIN_PORT || 1234);
const basePath = process.env.MOCK_FILECOIN_PATH || '/rpc/v0';
let height = Number(process.env.MOCK_FILECOIN_HEIGHT || 1500);

const makeCid = () => `bafy${randomUUID().replace(/-/g, '').slice(0, 30)}`;

app.post(basePath, (req, res) => {
  const { method, params, id } = req.body || {};

  switch (method) {
    case 'Filecoin.ChainHead': {
      height += 1;
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          Height: height,
          Cids: [{ '/': makeCid() }],
          Blocks: [
            {
              Height: height,
              Cid: { '/': makeCid() },
            },
          ],
        },
      });
    }
    case 'Filecoin.ClientImport': {
      const filePath = params?.[0]?.Path;
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          Root: { '/': makeCid() },
          ImportPath: filePath,
        },
      });
    }
    default:
      return res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Mock server: method ${method} not implemented`,
        },
      });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Mock Filecoin RPC expects POST requests to /rpc/v0' });
});

app.listen(port, host, () => {
  console.log(`[mock-filecoin] listening on http://${host}:${port}${basePath}`);
});

