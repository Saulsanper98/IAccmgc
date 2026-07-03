export interface Citation {
  index: number;
  chunk_id: string;
  page_title: string;
  page_path: string;
  heading_path: string;
  wiki_url: string;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  cited_chunk_ids?: string[];
  citations?: Citation[];
  latency_ms?: number | null;
  model?: string | null;
  created_at?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}
