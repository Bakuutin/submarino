import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function createServer(submarinoNode) {
  const server = new McpServer({
    name: "submarino-mcp-server",
    version: "0.0.1",
  });

  server.registerTool(
    "send_message",
    {
      description: "Send a message to one or more recipients",
      inputSchema: z.object({
        to: z.array(z.string()).describe("The recipient libp2p peer IDs"),
        content: z.any().describe("The message content"),
      }),
    },
    async (args) => {
      const { to, content } = args;

      if (!submarinoNode.node) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Node not started",
                message: "Please start the node before sending messages",
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const messageStr = typeof content === "string" ? content : JSON.stringify(content);
        const results = [];
        const sentMessages = [];
        const peerId = submarinoNode.node.peerId.toString();

        // Send message to each recipient
        for (const recipientId of to) {
          try {
            await submarinoNode.sendMessage(recipientId, messageStr);
            results.push({
              success: true,
              peerId: recipientId,
            });
            sentMessages.push({
              from: peerId,
              to: recipientId,
              content: messageStr,
            });
          } catch (error) {
            results.push({
              success: false,
              peerId: recipientId,
              error: error.message,
            });
          }
        }

        const allSuccessful = results.every((r) => r.success);
        const someSuccessful = results.some((r) => r.success);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: allSuccessful,
                  partialSuccess: someSuccessful && !allSuccessful,
                  results: results,
                  messages: sentMessages,
                  peerId: peerId,
                },
                null,
                2
              ),
            },
          ],
          isError: !someSuccessful,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to send message via libp2p",
                message: error.message,
                peerId: submarinoNode.node?.peerId?.toString() || "unknown",
                connectedPeers: submarinoNode.node ? Array.from(submarinoNode.node.getPeers()).map(p => p.toString()) : [],
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "check_inbox",
    {
      description: "Check inbox for messages",
      inputSchema: z.object({
        from: z
          .string()
          .optional()
          .describe("Filter messages from a specific peer ID"),
      }),
    },
    async (args) => {
      const { from } = args;

      let messages = submarinoNode.inbox || [];
      
      // Filter by sender if specified
      if (from) {
        messages = messages.filter((msg) => msg.from === from);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                count: messages.length,
                messages: messages.map((msg, index) => ({
                  id: index,
                  from: msg.from,
                  content: msg.content,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "add_trusted_peer",
    {
      description:
        "Add a peer to the trusted peers list. Only messages from trusted peers are accepted.",
      inputSchema: z.object({
        peerId: z.string().describe("The peer ID to add as trusted"),
      }),
    },
    async (args) => {
      const { peerId } = args;

      try {
        const added = await submarinoNode.addTrustedPeer(peerId);
        if (!added) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `Peer ${peerId} is already trusted`,
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Peer ${peerId} added to trusted list`,
                  peerId: peerId,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to add trusted peer",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "is_trusted_peer",
    {
      description: "Check if a peer is trusted",
      inputSchema: z.object({
        peerId: z.string().describe("The peer ID to check"),
      }),
    },
    async (args) => {
      const { peerId } = args;

      try {
        const isTrusted = submarinoNode.trustedPeers.has(peerId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  peerId: peerId,
                  isTrusted: isTrusted,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to check trusted peer status",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_trusted_peers",
    {
      description: "List all trusted peers",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const trustedPeers = Array.from(submarinoNode.trustedPeers);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  count: trustedPeers.length,
                  trustedPeers: trustedPeers,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to list trusted peers",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "remove_trusted_peer",
    {
      description: "Remove a peer from the trusted peers list",
      inputSchema: z.object({
        peerId: z.string().describe("The peer ID to remove from trusted list"),
      }),
    },
    async (args) => {
      const { peerId } = args;

      try {
        const removed = await submarinoNode.removeTrustedPeer(peerId);
        if (!removed) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `Peer ${peerId} is not in trusted list`,
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Peer ${peerId} removed from trusted list`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to remove trusted peer",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_my_id",
    {
      description: "Get the local peer ID and connection info",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        if (!submarinoNode.node) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Node not started",
                }),
              },
            ],
            isError: true,
          };
        }

        const peerId = submarinoNode.node.peerId.toString();
        const connectedPeers = submarinoNode.node ? Array.from(submarinoNode.node.getPeers()).map(p => p.toString()) : [];
        const trustedPeers = Array.from(submarinoNode.trustedPeers);
        const multiaddrs = submarinoNode.node ? submarinoNode.node.getMultiaddrs().map(m => m.toString()) : [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  peerId: peerId,
                  multiaddrs: multiaddrs,
                  connectedPeers: connectedPeers,
                  trustedPeers: trustedPeers,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Failed to get node info",
                message: error.message,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

export { createServer };
