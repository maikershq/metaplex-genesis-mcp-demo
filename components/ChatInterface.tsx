"use client";

import { useState, useRef, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VersionedTransaction, Keypair } from "@solana/web3.js";
import { Buffer } from "buffer";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import Markdown from "react-markdown";

// Polyfill Buffer for browser
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
}

type Message = {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "tool_result" | "error";
  tool?: string;
  result?: any;
};

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey! 👋 I'm your **Metaplex Genesis** assistant.\n\nI can help you:\n- **Create a new token** - just tell me the name and symbol\n- **Look up accounts** and bonding curves\n- **Get swap quotes**\n\nConnect your wallet to get started, then tell me what you'd like to do!",
};

export function ChatInterface() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Prepare history (exclude initial message and current user message)
      const historyToSend = messages
        .slice(1) // Skip initial assistant greeting
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          history: historyToSend,
          walletAddress: publicKey?.toBase58(),
        }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        role: "assistant",
        content: data.content || data.error || "I'm processing your request...",
        type: data.type || (data.error ? "error" : "text"),
        tool: data.tool,
        result: data.result,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error communicating with server.",
          type: "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignAndSend = async (
    base64Tx: string,
    mintSecretKey?: string,
  ) => {
    if (!publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const txBuffer = Buffer.from(base64Tx, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // If we have a mint secret key, sign with it first
      if (mintSecretKey) {
        const mintKeypair = Keypair.fromSecretKey(
          Buffer.from(mintSecretKey, "base64"),
        );
        transaction.sign([mintKeypair]);
      }

      const signature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(signature, "confirmed");

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Transaction confirmed!\n\n**Signature:** \`${signature}\`\n\n[View on Solana Explorer](https://explorer.solana.com/tx/${signature}?cluster=devnet)`,
          type: "text",
        },
      ]);
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Transaction failed: ${error.message}`,
          type: "error",
        },
      ]);
    }
  };

  const getTransactionData = (content: any[]) => {
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === "text") {
          try {
            const parsed = JSON.parse(item.text);
            if (parsed && parsed.transaction) {
              return {
                transaction: parsed.transaction,
                mintSecretKey: parsed.mintSecretKey,
              };
            }
          } catch {}
        }
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background bg-pattern-enhanced text-foreground p-4 md:p-8">
      <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading tracking-wide">
              METAPLEX GENESIS
            </h1>
            <p className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
              Agent Interface
            </p>
          </div>
        </div>
        <WalletButton />
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden max-w-5xl mx-auto w-full border-white/10 shadow-2xl bg-card/50 backdrop-blur-xl">
        <CardHeader className="border-b border-white/5 bg-black/20 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">
                SYSTEM ONLINE // DEVNET
              </span>
            </div>
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <Trash2 size={14} className="mr-1" />
                <span className="text-xs">Clear</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0 relative">
          <ScrollArea className="h-full p-4 md:p-6">
            <div className="flex flex-col gap-6">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <Avatar
                    className={`h-10 w-10 border ${m.role === "assistant" ? "border-primary/20 bg-primary/10" : "border-white/10 bg-white/5"}`}
                  >
                    <AvatarFallback className="bg-transparent text-foreground">
                      {m.role === "user" ? (
                        <User size={18} />
                      ) : (
                        <Bot size={18} />
                      )}
                    </AvatarFallback>
                    {m.role === "assistant" && (
                      <AvatarImage src="/bot-avatar.png" />
                    )}
                  </Avatar>

                  <div
                    className={`flex flex-col gap-2 max-w-[85%] md:max-w-[75%]`}
                  >
                    <div
                      className={`rounded-2xl p-4 text-sm shadow-sm ${
                        m.role === "user"
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "bg-muted/50 border border-white/5"
                      }`}
                    >
                      <div className="prose prose-sm prose-invert max-w-none leading-relaxed [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>p:last-child]:mb-0 [&>ul:last-child]:mb-0 [&>ol:last-child]:mb-0">
                        <Markdown
                          components={{
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {m.content}
                        </Markdown>
                      </div>
                    </div>

                    {m.type === "tool_result" && m.result && (
                      <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                        <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center">
                          <div className="text-xs font-mono text-muted-foreground uppercase flex items-center gap-2">
                            <span className="text-primary">⚡</span>
                            {m.tool} result
                          </div>
                        </div>
                        <div className="p-4 overflow-x-auto">
                          <pre className="text-xs font-mono text-muted-foreground/80">
                            {JSON.stringify(m.result, null, 2)}
                          </pre>

                          {(m.tool === "create_genesis_account" ||
                            m.tool === "swap") &&
                            m.result.content &&
                            (() => {
                              const txData = getTransactionData(
                                m.result.content,
                              );
                              if (txData) {
                                return (
                                  <div className="mt-4 pt-4 border-t border-white/10">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleSignAndSend(
                                          txData.transaction,
                                          txData.mintSecretKey,
                                        )
                                      }
                                      className="btn-cta w-full sm:w-auto"
                                    >
                                      Sign & Send Transaction
                                    </Button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-4">
                  <Avatar className="h-10 w-10 border border-primary/20 bg-primary/10">
                    <AvatarFallback className="bg-transparent">
                      <Bot size={18} />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted/30 rounded-2xl p-4 text-sm border border-white/5 flex items-center gap-2 text-muted-foreground">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex w-full gap-3 relative"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Shift+Enter for new line)"
              disabled={loading}
              rows={1}
              className="bg-white/5 border-white/10 focus-visible:ring-primary/50 min-h-[50px] max-h-[150px] pl-4 pr-14 py-3 rounded-xl text-base resize-none"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 btn-cta h-auto px-4 rounded-lg"
            >
              <Send size={18} />
            </Button>
          </form>
        </CardFooter>
      </Card>

      <div className="text-center mt-6 text-xs text-muted-foreground opacity-50">
        Powered by Metaplex Genesis MCP & Maikers
      </div>
    </div>
  );
}
