import { SubmarinoNode } from './submarino.js';

import { multiaddr, isMultiaddr } from '@multiformats/multiaddr';

// Node started, peer ID: 12D3KooWPMzZ7uKB7aTwFqv11VymHw8BfLWDydNSQwcDW1LjXiM8
// Listening on: [
//   '/ip4/127.0.0.1/tcp/55873/p2p/12D3KooWPMzZ7uKB7aTwFqv11VymHw8BfLWDydNSQwcDW1LjXiM8',
//   '/ip4/10.140.164.174/tcp/55873/p2p/12D3KooWPMzZ7uKB7aTwFqv11VymHw8BfLWDydNSQwcDW1LjXiM8',
//   '/ip4/192.168.66.1/tcp/55873/p2p/12D3KooWPMzZ7uKB7aTwFqv11VymHw8BfLWDydNSQwcDW1LjXiM8'
// ]



other.getPeerId = () => 'QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt';
console.log(other.getPeerId());
const node = new SubmarinoNode('.keys/mcp');


await node.start();

await node.node.dial(other)

