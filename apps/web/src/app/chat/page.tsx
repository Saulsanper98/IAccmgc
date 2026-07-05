import type { Metadata } from "next";
import { auth } from "@/auth";
import { listConversations } from "@/lib/api";
import { getIngestStatus } from "@/lib/api";
import { lastIngestSyncAt } from "@/lib/format";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import type { ConversationSummary } from "@/lib/chat-types";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  const session = await auth();
  let conversations: ConversationSummary[] = [];
  let pageCount: number | null = null;
  let wikiUrl: string | null = null;
  let lastSyncAt: string | null = null;

  if (session) {
    try {
      const [convData, status] = await Promise.all([
        listConversations(session),
        getIngestStatus().catch(() => null),
      ]);
      conversations = convData.items ?? [];
      pageCount = status?.pages ?? null;
      wikiUrl = status?.wikijs_url ?? null;
      lastSyncAt = lastIngestSyncAt(status);
    } catch {
      conversations = [];
    }
  }

  return (
    <ChatWorkspace
      conversationId={undefined}
      initialConversations={conversations}
      pageCount={pageCount}
      wikiUrl={wikiUrl}
      lastSyncAt={lastSyncAt}
      userRole={session?.user.role}
      isAdmin={session?.user.role === "admin"}
    />
  );
}
