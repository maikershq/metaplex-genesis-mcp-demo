import { NextRequest, NextResponse } from "next/server";
import { callMcpTool, getToolsDescription } from "@/lib/mcp";
import { z } from "zod";
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const RequestSchema = z.object({
  message: z.string(),
  history: z.array(MessageSchema).optional(),
  walletAddress: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history, walletAddress } = RequestSchema.parse(body);

    const toolsDesc = await getToolsDescription();

    const walletContext = walletAddress
      ? `\n\n## User's Connected Wallet\nThe user has connected their wallet: ${walletAddress}\nUse this address for baseMint, authority, and payer when creating tokens.`
      : `\n\n## Wallet Status\nThe user has NOT connected a wallet yet. If they want to create a token, remind them to connect their wallet first using the button in the top-right corner.`;

    // Build messages array from history
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    // Add current message
    messages.push({ role: "user", content: message });

    const result = await generateText({
      model: openai.chat("gpt-4o"),
      system: `You are a friendly AI assistant for the Metaplex Genesis Protocol on Solana Devnet.
You help users create tokens, fetch accounts, and interact with bonding curves.

## Your Personality
- Be concise and helpful
- Don't overwhelm users with technical jargon
- Guide them step-by-step when needed

## Available Tools
${toolsDesc}

## SIMPLIFIED TOKEN CREATION FLOW
When a user wants to create a token, DON'T ask for all technical parameters upfront.
Instead, follow this simplified flow:

1. **Ask only for essentials**: Token name, symbol, and optionally total supply
2. **Use sensible defaults**:
   - totalSupplyBaseToken: "1000000000" (1 billion) if not specified
   - uri: "https://arweave.net/placeholder" (placeholder metadata)
   - fundingMode: "Mint"
   - For baseMint, authority, and payer: Use the user's connected wallet address

3. **Example simple flow**:
   User: "I want to create a token"
   You: "Great! Let's create your token. I just need a few things:
   - **Name**: What's your token called?
   - **Symbol**: Short ticker (e.g., SOL, USDC)
   - **Supply** (optional): How many tokens? Default is 1 billion."

4. **IMPORTANT: When user provides name and symbol, IMMEDIATELY call the tool.**
   Don't say "Let's proceed" or ask for confirmation - just execute the tool right away!
   If they haven't connected a wallet, ask them to connect first.
    
    ## SIMPLIFIED TOKEN SWAP FLOW
    When a user wants to swap tokens:
    1. Ask for the bonding curve address (or token name/symbol to look it up), amount, and direction (Buy/Sell).
    2. Call 'get_swap_quote' to get an estimated output.
    3. Show the estimate to the user.
    4. If they confirm, calculate 'minAmountOut' (e.g., 95% of estimated output for 5% slippage) and call the 'swap' tool.
    5. Use the user's connected wallet address as the 'authority'.

    ## Tool Execution
    - Call 'execute_mcp_tool' with tool_name and arguments as a JSON string
    - For create_genesis_account, the required fields are: baseMint, totalSupplyBaseToken, name, uri, symbol
    - You MUST also provide 'authority' OR 'payer' (use the user's wallet address for both)
    - IMPORTANT: For baseMint, ALWAYS use the literal string "generate" - this tells the server to generate a new keypair for the token mint
    - ALWAYS execute the tool when you have enough information - don't wait for user confirmation
    
    Example JSON for create_genesis_account:
{
  "baseMint": "generate",
  "totalSupplyBaseToken": "1000000000",
  "name": "TokenName",
  "uri": "https://arweave.net/placeholder",
  "symbol": "TKN",
  "authority": "<user_wallet_address>",
  "payer": "<user_wallet_address>"
}

## Transaction Output
If a tool returns a transaction with a "transaction" field containing base64, output it in a JSON block:
\`\`\`json
{
  "transaction": "base64_string_here",
  "message": "Sign this transaction to create your token!"
}
\`\`\`

## Help Command
If user asks for "help", list available actions in simple terms:
- Create a new token
- Look up existing Genesis accounts
- Check bonding curve prices
- Swap tokens (Buy/Sell)
- Get swap quotes
${walletContext}
`,
      messages,
      maxSteps: 5, // Allow multi-step reasoning (e.g. fetch then analyze)
      tools: {
        execute_mcp_tool: tool({
          description: "Execute a Metaplex Genesis MCP tool",
          inputSchema: z.object({
            tool_name: z.string().describe("The name of the tool to execute"),
            arguments: z
              .string()
              .describe(
                "The arguments for the tool as a JSON string. MUST be a valid JSON string.",
              ),
          }),
          execute: async ({ tool_name, arguments: argsStr }) => {
            try {
              let args = {};
              try {
                args = JSON.parse(argsStr);
              } catch (e) {
                return "Error: arguments must be a valid JSON string.";
              }
              const result = await callMcpTool(tool_name, args);

              // Parse the MCP response format and return readable content for the LLM
              if (result.content && Array.isArray(result.content)) {
                const texts = result.content
                  .filter(
                    (c: { type: string; text?: string }) =>
                      c.type === "text" && c.text,
                  )
                  .map((c: { text: string }) => c.text);
                if (texts.length > 0) {
                  return texts.join("\n");
                }
              }

              if (result.isError) {
                return "Tool execution failed with an unknown error.";
              }

              return "Tool executed successfully but returned no content.";
            } catch (error: any) {
              return `Error executing tool: ${error.message}`;
            }
          },
        }),
      },
    });

    // Extract content - the LLM might only call tools without generating text
    let content = result.text || "";
    let transactionData = null;
    let toolError = null;

    // Check steps for tool results if text is empty
    if (result.steps && result.steps.length > 0) {
      for (const step of result.steps) {
        // In newer AI SDK, tool results are in step.content as items with type "tool-result"
        if (step.content && Array.isArray(step.content)) {
          for (const contentItem of step.content) {
            if (contentItem.type === "tool-result") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const output = (contentItem as any).output;
              const resultStr =
                output != null
                  ? typeof output === "string"
                    ? output
                    : JSON.stringify(output)
                  : "";

              if (!resultStr) continue;

              // Check if it's a plain error string (new format)
              if (
                resultStr.startsWith("Error:") ||
                resultStr.startsWith("Error executing")
              ) {
                toolError = resultStr;
                continue;
              }

              // Try to parse as JSON for transaction data
              try {
                const parsed = JSON.parse(resultStr);

                // Check if it's a transaction object directly
                if (parsed.transaction) {
                  transactionData = parsed;
                  continue;
                }

                // Check if it's an array of content items (old MCP format)
                if (Array.isArray(parsed)) {
                  for (const item of parsed) {
                    if (item.type === "text" && item.text) {
                      if (item.text.startsWith("Error:")) {
                        toolError = item.text;
                      } else {
                        try {
                          const innerParsed = JSON.parse(item.text);
                          if (innerParsed.transaction) {
                            transactionData = innerParsed;
                          }
                        } catch {}
                      }
                    }
                  }
                }
              } catch {
                // Not valid JSON - check for error in raw string
                if (resultStr.includes("Error")) {
                  toolError = resultStr;
                }
              }
            }
          }
        }
      }
    }

    // If we have no content but have tool results, generate a response
    if (!content && transactionData) {
      content = `I've prepared the transaction to create your token. Please sign it to complete the process.\n\n\`\`\`json\n${JSON.stringify(transactionData, null, 2)}\n\`\`\``;
    } else if (!content && toolError) {
      content = `There was an issue: ${toolError}`;
    } else if (!content) {
      // Check if there were any tool calls at all and extract any useful info
      const hadToolCalls = result.steps?.some(
        (s) => s.toolCalls && s.toolCalls.length > 0,
      );
      if (hadToolCalls) {
        // Try to extract any tool result text
        let toolResultText = "";
        for (const step of result.steps || []) {
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              if (tr.result) {
                const rStr =
                  typeof tr.result === "string"
                    ? tr.result
                    : JSON.stringify(tr.result);
                if (rStr && rStr.length > 0) {
                  toolResultText = rStr;
                }
              }
            }
          }
        }
        if (toolResultText) {
          content = `Tool result: ${toolResultText}`;
        } else {
          content =
            "I processed your request but the tool didn't return any data. Please try again.";
        }
      }
    }

    // Also try to find transaction in the text content
    if (!transactionData && content) {
      const jsonMatch = content.match(
        /```json\s*({[\s\S]*?"transaction"[\s\S]*?})\s*```/,
      );
      if (jsonMatch) {
        try {
          transactionData = JSON.parse(jsonMatch[1]);
        } catch {}
      } else {
        const simpleMatch = content.match(/({[\s\S]*?"transaction"[\s\S]*?})/);
        if (simpleMatch) {
          try {
            transactionData = JSON.parse(simpleMatch[1]);
          } catch {}
        }
      }
    }

    let inferredToolName = "create_genesis_account";
    if (transactionData && !transactionData.baseMint) {
      inferredToolName = "swap";
    }

    return NextResponse.json({
      type: transactionData ? "tool_result" : "text",
      content: content,
      tool: transactionData ? inferredToolName : undefined,
      result: transactionData
        ? { content: [{ type: "text", text: JSON.stringify(transactionData) }] }
        : undefined,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 },
    );
  }
}
