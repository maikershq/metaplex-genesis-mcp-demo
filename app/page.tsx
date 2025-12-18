import { ChatInterface } from "@/components/ChatInterface";
import { WalletContextProvider } from "@/components/WalletContextProvider";

export default function Home() {
  return (
    <main className="min-h-screen bg-background p-4">
      <WalletContextProvider>
        <ChatInterface />
      </WalletContextProvider>
    </main>
  );
}
