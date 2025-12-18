# Metaplex Genesis MCP Demo

**AI chat demo for Metaplex Genesis MCP.**

> Create Solana tokens through natural conversation with wallet signing.

Demo web app showcasing the [metaplex-genesis-mcp](https://github.com/maikershq/metaplex-genesis-mcp) server.

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6)](https://typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF)](https://solana.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue)](LICENSE)

## Demo

[![Watch the demo](https://img.shields.io/badge/YouTube-Demo-red?logo=youtube)](https://youtu.be/ojRoDDvvNck)

https://youtu.be/ojRoDDvvNck

## Overview

A Next.js chat interface that connects to the Metaplex Genesis MCP server, enabling natural language token creation on Solana. Users can create tokens by simply describing what they want.

**Features:**

- 💬 **Chat Interface** - Natural language interaction with GPT-4o
- 👛 **Wallet Integration** - Solana wallet adapter for transaction signing
- 🪙 **Token Creation** - Create Genesis tokens with minimal input
- 🔗 **MCP Integration** - Direct connection to metaplex-genesis-mcp server

## Quick Start

```bash
pnpm install
cp env.example .env
# Add your OPENAI_API_KEY to .env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

## Configuration

| Variable         | Required | Description              |
| ---------------- | -------- | ------------------------ |
| `OPENAI_API_KEY` | Yes      | OpenAI API key for GPT-4o |

## How It Works

1. **User connects wallet** - Phantom, Solflare, or any Solana wallet
2. **User describes token** - "Create a token called MyCoin with symbol MC"
3. **LLM calls MCP tool** - `create_genesis_account` with smart defaults
4. **Server generates transaction** - Including new mint keypair
5. **User signs and submits** - Transaction sent to Solana devnet

## Project Structure

```
├── app/
│   ├── api/chat/     # LLM + MCP integration endpoint
│   └── page.tsx      # Main page
├── components/
│   ├── ChatInterface.tsx      # Chat UI with message handling
│   ├── WalletButton.tsx       # Wallet connect button
│   └── WalletContextProvider.tsx  # Solana wallet adapter setup
└── lib/
    └── mcp.ts        # MCP client for metaplex-genesis-mcp
```

## Development

```bash
pnpm install       # Install dependencies
pnpm dev           # Start development server
pnpm build         # Build for production
pnpm lint          # Run linter
```

## Requirements

- Node.js 20+
- OpenAI API key

## Related Repositories

- **[metaplex-genesis-mcp](https://github.com/maikershq/metaplex-genesis-mcp)** - MCP server for Metaplex Genesis
- **[metaplex-genesis](https://github.com/metaplex-foundation/genesis)** - Metaplex Genesis program
- **[wallet-adapter](https://github.com/anza-xyz/wallet-adapter)** - Solana wallet adapter

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

**Built by [maikers - creators of realities](https://maikers.com)**
