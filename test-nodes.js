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

console.log('Checking if nodes are connected...');
while (true) {

  const n1Peers = Array.from(node1.knownPeers.keys()).map(p => p.toString());
  const n2Peers = Array.from(node2.knownPeers.keys()).map(p => p.toString());
  if (n1Peers.includes(node2.node.peerId.toString()) && n2Peers.includes(node1.node.peerId.toString())) {
    break;
  }
  console.log('Waiting for nodes to connect...');
  await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log('Nodes are connected, sending message...');

await node1.sendMessage(node2.node.peerId.toString(), 'Hello from node1!');


