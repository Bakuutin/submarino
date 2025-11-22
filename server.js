/**
 * MCP Server for Chat
 * Provides two tools: send_message and check_inbox
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@libp2p/noise'
import { yamux } from '@libp2p/yamux'
import { identify } from '@libp2p/identify'
import { mdns } from '@libp2p/mdns'
import { peerIdFromString } from '@libp2p/peer-id'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Create MCP server
const server = new McpServer(
  {
    name: 'chat-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Inbox implementation with in-memory storage
const inbox = {
  messages: new Map(),

  addMessage({ from, to, content }) {
    const id = `${Date.now()}-${randomBytes(8).toString('hex')}`
    const message = {
      id,
      from,
      to,
      content,
      timestamp: Date.now(),
      read: false,
    }
    this.messages.set(id, message)
    return message
  },

  getMessages(recipient, unreadOnly = false) {
    const messages = Array.from(this.messages.values())
      .filter(msg => msg.to === recipient)
      .filter(msg => !unreadOnly || !msg.read)
      .sort((a, b) => b.timestamp - a.timestamp)
    return messages
  },

  getMessage(id) {
    return this.messages.get(id)
  },

  markAsRead(ids) {
    let count = 0
    for (const id of ids) {
      const message = this.messages.get(id)
      if (message && !message.read) {
        message.read = true
        count++
      }
    }
    return count
  },

  clear() {
    this.messages.clear()
  },
}

class NetworkNode {
  constructor(keyPath) {
    this.keyPath = keyPath
    this.node = null
    this.contacts = new Map()
    this.protocolName = '/submarino/1.0.0'
    this.messageHandlers = new Map()
  }

  async start() {
    if (this.node) {
      return
    }

    // Load or create peer ID
    let peerId
    const keyFile = join(this.keyPath, 'peer-id.json')
    
    if (existsSync(keyFile)) {
      const keyData = JSON.parse(readFileSync(keyFile, 'utf-8'))
      peerId = peerIdFromString(keyData.id)
    } else {
      // Create new peer ID
      peerId = await createEd25519PeerId()
      
      // Save peer ID
      mkdirSync(this.keyPath, { recursive: true })
      writeFileSync(keyFile, JSON.stringify({ id: peerId.toString() }))
    }

    // Create libp2p node
    this.node = await createLibp2p({
      peerId,
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0'],
      },
      transports: [tcp()],
      streamMuxers: [yamux()],
      connectionEncryption: [noise()],
      services: {
        identify: identify(),
      },
      peerDiscovery: [
        mdns({
          interval: 2e3,
        }),
      ],
    })

    // Set up custom protocol handler
    await this.node.handle(this.protocolName, async ({ stream, connection }) => {
      const peerId = connection.remotePeer.toString()
      
      try {
        const chunks = []
        for await (const chunk of stream.source) {
          chunks.push(chunk)
        }
        
        const data = Buffer.concat(chunks).toString('utf-8')
        const message = JSON.parse(data)
        
        // Store incoming message in inbox
        inbox.addMessage({
          from: message.from || peerId,
          to: this.getPeerId(),
          content: message.content,
        })
        
        // Call registered handlers
        const handler = this.messageHandlers.get(peerId)
        if (handler) {
          handler(message)
        }
      } catch (error) {
        console.error('Error handling incoming message:', error)
      }
    })

    // Start the node
    await this.node.start()
    
    // Listen for peer connections
    this.node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail.toString()
      const contact = this.contacts.get(peerId)
      if (contact) {
        contact.lastSeen = Date.now()
      }
    })
  }

  async stop() {
    if (this.node) {
      await this.node.stop()
      this.node = null
    }
  }

  getPeerId() {
    if (!this.node) {
      throw new Error('Network node not started')
    }
    return this.node.peerId.toString()
  }

  getConnectedPeers() {
    if (!this.node) {
      return []
    }
    return Array.from(this.node.getPeers()).map(peer => peer.toString())
  }

  async sendMessage(to, message) {
    if (!this.node) {
      throw new Error('Network node not started')
    }

    const results = []
    const messageIds = []

    for (const peerIdStr of to) {
      try {
        const peerId = peerIdFromString(peerIdStr)
        
        // Check if peer is connected
        if (!this.node.getPeers().some(p => p.toString() === peerIdStr)) {
          // Try to dial the peer
          await this.node.dial(peerId)
        }

        // Open stream with custom protocol
        const stream = await this.node.dialProtocol(peerId, this.protocolName)
        
        // Send message
        const messageId = `${Date.now()}-${randomBytes(8).toString('hex')}`
        const messageData = JSON.stringify({
          message,
          messageId,
          timestamp: Date.now(),
        })
        
        await stream.sink(async function* () {
          yield new TextEncoder().encode(messageData)
        }())

        messageIds.push(messageId)
        results.push({
          success: true,
          peerId: peerIdStr,
          messageId,
        })
      } catch (error) {
        results.push({
          success: false,
          peerId: peerIdStr,
          error: error.message,
        })
      }
    }

    return { results, messageIds }
  }

  addContact(peerId, name) {
    const contact = {
      peerId,
      name,
      addedAt: Date.now(),
    }
    this.contacts.set(peerId, contact)
    return contact
  }

  getContact(peerId) {
    return this.contacts.get(peerId)
  }

  getAllContacts() {
    return Array.from(this.contacts.values())
  }

  updateContact(peerId, updates) {
    const contact = this.contacts.get(peerId)
    if (!contact) {
      return undefined
    }
    
    if (updates.name !== undefined) {
      contact.name = updates.name
    }
    if (updates.metadata !== undefined) {
      contact.metadata = updates.metadata
    }
    
    return contact
  }

  deleteContact(peerId) {
    return this.contacts.delete(peerId)
  }
}

// Initialize network and inbox
const keyPath = process.env.KEY_PATH || join(process.cwd(), '.keys')
const network = new NetworkNode(keyPath)

// Start network asynchronously
network.start().catch(err => {
  console.error('Failed to start network:', err)
})

// Register tools using server.registerTool
server.registerTool(
  'send_message',
  {
    description: 'Send a message to one or more recipients',
    inputSchema: z.object({
      to: z.array(z.string()).describe('The recipient libp2p peer IDs'),
      content: z.any().describe('The message content'),
    }),
  },
  async (args) => {
    const { to, content } = args

    try {
      // Send message via libp2p to all recipients
      const result = await network.sendMessage(to, {
        from: network.getPeerId(),
        to: to[0],
        content: JSON.stringify(content),
      })

      const sentMessages = []
      for (const res of result.results) {
        if (res.success && res.messageId) {
          const message = inbox.addMessage({
            from: network.getPeerId(),
            to: res.peerId,
            content: typeof content === 'string' ? content : JSON.stringify(content),
          })
          sentMessages.push({
            id: message.id,
            from: message.from,
            to: message.to,
            content: message.content,
            timestamp: message.timestamp,
          })
        }
      }

      const allSuccessful = result.results.every(r => r.success)
      const someSuccessful = result.results.some(r => r.success)

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: allSuccessful,
                partialSuccess: someSuccessful && !allSuccessful,
                messageIds: result.messageIds,
                results: result.results,
                messages: sentMessages,
                peerId: network.getPeerId(),
              },
              null,
              2
            ),
          },
        ],
        isError: !someSuccessful,
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to send message via libp2p',
              message: error.message,
              peerId: network.getPeerId(),
              connectedPeers: network.getConnectedPeers(),
            }),
          },
        ],
        isError: true,
      }
    }
  }
)

server.registerTool(
  'check_inbox',
  {
    description: 'Check inbox for messages',
    inputSchema: z.object({
      recipient: z.string().describe('The recipient identifier to check messages for'),
      unreadOnly: z.boolean().optional().default(false).describe('Only return unread messages (default: false)'),
    }),
  },
  async (args) => {
    const { recipient, unreadOnly = false } = args

    const messages = inbox.getMessages(recipient, unreadOnly)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              count: messages.length,
              messages: messages.map((msg) => ({
                id: msg.id,
                from: msg.from,
                to: msg.to,
                content: msg.content,
                timestamp: msg.timestamp,
                read: msg.read,
              })),
            },
            null,
            2
          ),
        },
      ],
    }
  }
)

server.registerTool(
  'create_contact',
  {
    description: 'Create a new contact. All contacts are automatically trusted.',
    inputSchema: z.object({
      peerId: z.string().describe('The peer ID of the contact'),
      name: z.string().optional().describe('Optional human-readable name for the contact'),
    }),
  },
  async (args) => {
    const { peerId, name: contactName } = args

    try {
      const contact = network.addContact(peerId, contactName)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Contact ${peerId} created${contactName ? ` (${contactName})` : ''}`,
                contact,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to create contact',
              message: error.message,
            }),
          },
        ],
        isError: true,
      }
    }
  }
)

server.registerTool(
  'get_contact',
  {
    description: 'Get a contact by peer ID',
    inputSchema: z.object({
      peerId: z.string().describe('The peer ID to look up'),
    }),
  },
  async (args) => {
    const { peerId } = args

    try {
      const contact = network.getContact(peerId)
      if (!contact) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `Contact ${peerId} not found`,
              }),
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                contact,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to get contact',
              message: error.message,
            }),
          },
        ],
        isError: true,
      }
    }
  }
)

server.registerTool(
  'list_contacts',
  {
    description: 'List all contacts',
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const allContacts = network.getAllContacts()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: allContacts.length,
                contacts: allContacts,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to list contacts',
              message: error.message,
            }),
          },
        ],
        isError: true,
      }
    }
  }
)

server.registerTool(
  'update_contact',
  {
    description: 'Update a contact',
    inputSchema: z.object({
      peerId: z.string().describe('The peer ID of the contact to update'),
      name: z.string().optional().describe('Optional new name for the contact'),
      metadata: z.record(z.any()).optional().describe('Optional metadata to associate with the contact'),
    }),
  },
  async (args) => {
    const { peerId, name: contactName, metadata } = args

    try {
      const updates = {}
      if (contactName !== undefined) updates.name = contactName
      if (metadata !== undefined) updates.metadata = metadata

      const contact = network.updateContact(peerId, updates)
      if (!contact) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `Contact ${peerId} not found`,
              }),
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Contact ${peerId} updated`,
                contact,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to update contact',
              message: error.message,
            }),
          },
        ],
        isError: true,
      }
    }
  }
)

server.registerTool(
  'delete_contact',
  {
    description: 'Delete a contact',
    inputSchema: z.object({
      peerId: z.string().describe('The peer ID of the contact to delete'),
    }),
  },
  async (args) => {
    const { peerId } = args

    try {
      const deleted = network.deleteContact(peerId)
      if (!deleted) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `Contact ${peerId} not found`,
              }),
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Contact ${peerId} deleted`,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to delete contact',
              message: error.message,
            }),
          },
        ],
        isError: true,
      }
    }
  }
)

server.registerTool(
  'get_my_id',
  {
    description: 'Get the local peer ID and connection info',
    inputSchema: z.object({}),
  },
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              peerId: network.getPeerId(),
              connectedPeers: network.getConnectedPeers(),
              contacts: network.getAllContacts().map(c => c.peerId),
            },
            null,
            2
          ),
        },
      ],
    }
  }
)

export { server, NetworkNode }

