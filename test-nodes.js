import { SubmarinoNode } from './submarino.js';

console.log('Creating nodes...');
const node1 = new SubmarinoNode('.keys/node1');

await node1.start();

console.log('Node 1 started');
console.log('Node 1 peer id:', node1.node.peerId.toString());



const node2 = new SubmarinoNode('.keys/node2');
await node2.start();

console.log('Node 2 started');
console.log('Node 2 peer id:', node2.node.peerId.toString());

// Get node addresses for manual dialing
const node1Addrs = node1.node.getMultiaddrs();
const node2Addrs = node2.node.getMultiaddrs();

console.log('Node 1 addresses:', node1Addrs.map(m => m.toString()));
console.log('Node 2 addresses:', node2Addrs.map(m => m.toString()));

// Try to manually dial each other to speed up connection
console.log('Attempting to dial nodes...');
try {
  await node1.node.dial(node2Addrs);
  console.log('Node 1 dialed Node 2');
} catch (err) {
  console.log('Node 1 failed to dial Node 2:', err.message);
}

try {
  await node2.node.dial(node1Addrs);
  console.log('Node 2 dialed Node 1');
} catch (err) {
  console.log('Node 2 failed to dial Node 1:', err.message);
}

console.log('Checking if nodes are connected...');
let attempts = 0;
const maxAttempts = 30; // Wait up to 30 seconds

while (attempts < maxAttempts) {
  // Check if nodes are actually connected (not just discovered)
  const n1ConnectedPeers = Array.from(node1.node.getPeers()).map(p => p.toString());
  const n2ConnectedPeers = Array.from(node2.node.getPeers()).map(p => p.toString());
  
  const n1Peers = Array.from(node1.knownPeers.keys()).map(p => p.toString());
  const n2Peers = Array.from(node2.knownPeers.keys()).map(p => p.toString());
  
  if (n1ConnectedPeers.includes(node2.node.peerId.toString()) && 
      n2ConnectedPeers.includes(node1.node.peerId.toString())) {
    console.log('Nodes are connected!');
    break;
  }
  
  if (n1Peers.includes(node2.node.peerId.toString()) && 
      n2Peers.includes(node1.node.peerId.toString())) {
    console.log('Nodes discovered each other, waiting for connection...');
  } else {
    console.log('Waiting for nodes to discover each other...');
    console.log('Node 1 discovered peers:', n1Peers);
    console.log('Node 2 discovered peers:', n2Peers);
  }
  
  attempts++;
  await new Promise(resolve => setTimeout(resolve, 1000));
}


await node2.addTrustedPeer(node1.peerId);

await node1.sendMessage(node2.peerId, 'Hello from node1!');

if (node2.inbox.length > 0) {
  console.log('Node 2 inbox:', node2.inbox);
}
