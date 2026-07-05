import type { Metadata } from "next";
import { auth } from "@/auth";
import { getConversation, getIngestStatus, listConversations } from "@/lib/api";
import { lastIngestSyncAt } from "@/lib/format";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import type { ChatMessage, ConversationSummary } from "@/lib/chat-types";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Chat" };

interface ChatConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ChatConversationPage({ params }: ChatConversationPageProps) {
  const session = await auth();
  if (!session) notFound();

  const { conversationId } = await params;

  let conversations: ConversationSummary[] = [];
  let messages: ChatMessage[] = [];
  let pageCount: number | null = null;
  let wikiUrl: string | null = null;
  let lastSyncAt: string | null = null;

  try {
    const [convList, conversation, status] = await Promise.all([
      listConversations(session),
      getConversation(session, conversationId),
      getIngestStatus().catch(() => null),
    ]);
    conversations = convList.items ?? [];
    messages = conversation.messages ?? [];
    pageCount = status?.pages ?? null;
    wikiUrl = status?.wikijs_url ?? null;
    lastSyncAt = lastIngestSyncAt(status);
  } catch {
    notFound();
  }

  return (
    <ChatWorkspace
      conversationId={conversationId}
      initialConversations={conversations}
      initialMessages={messages}
      pageCount={pageCount}
      wikiUrl={wikiUrl}
      lastSyncAt={lastSyncAt}
      userRole={session.user.role}
      isAdmin={session.user.role === "admin"}
    />
  );
}
