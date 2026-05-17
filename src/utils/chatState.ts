export type ChatMessageLike = {
  id: string;
  createdAt: string;
};

export function mergeChatMessages<TMessage extends ChatMessageLike>(current: TMessage[], incoming: TMessage[]) {
  const byId = new Map<string, TMessage>();

  current.forEach((message) => {
    byId.set(message.id, message);
  });

  incoming.forEach((message) => {
    byId.set(message.id, message);
  });

  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function shouldAutoScrollForIncomingMessage({
  isNearBottom,
  isOwnMessage,
}: {
  isNearBottom: boolean;
  isOwnMessage: boolean;
}) {
  return isNearBottom || isOwnMessage;
}
