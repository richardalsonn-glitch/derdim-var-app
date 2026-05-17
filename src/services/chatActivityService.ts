let activeChatThreadId: string | null = null;

export function setActiveChatThreadId(threadId: string | null) {
  activeChatThreadId = threadId;
}

export function getActiveChatThreadId() {
  return activeChatThreadId;
}
