import ChatClient from './chat-client';

// Next.js static export requires at least one param from generateStaticParams.
// The placeholder path is never visited — real conversations are routed client-side.
export async function generateStaticParams() {
  return [{ conversationId: 'placeholder' }];
}

export default function ConversationPage() {
  return <ChatClient />;
}
