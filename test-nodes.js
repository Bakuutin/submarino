import { NetworkNode } from './server.js';

// Set timeout to prevent hanging
const TIMEOUT_MS = 30000; // 30 seconds
const timeoutId = setTimeout(() => {
  console.error('Test timed out after', TIMEOUT_MS, 'ms');
  process.exit(1);
}, TIMEOUT_MS);

async function runTest() {
  try {
    console.log('Creating nodes...');
    const node1 = new NetworkNode('.keys/node1');
    const node2 = new NetworkNode('.keys/node2');

    console.log('Starting node1...');
    await node1.start();
    console.log('Node1 started. Peer ID:', node1.getPeerId());

    console.log('Starting node2...');
    await node2.start();
    console.log('Node2 started. Peer ID:', node2.getPeerId());

    // Wait a bit for nodes to discover each other
    console.log('Waiting for nodes to discover each other...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Sending message from node1 to node2...');
    const result = await node1.sendMessage([node2.getPeerId()], 'Hello, world!');
    console.log('Send result:', JSON.stringify(result, null, 2));

    console.log('Stopping node1...');
    await node1.stop();
    console.log('Stopping node2...');
    await node2.stop();

    clearTimeout(timeoutId);
    console.log('Test completed successfully');
    process.exit(0);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest(); 