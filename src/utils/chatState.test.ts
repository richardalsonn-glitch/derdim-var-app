import * as assert from 'node:assert/strict';

import { ChatMessageItem } from '../services/socialService';
import { mergeChatMessages, shouldAutoScrollForIncomingMessage } from './chatState';

function message(id: string, createdAt: string): ChatMessageItem {
  return {
    id,
    threadId: 'thread-1',
    senderId: 'sender-1',
    receiverId: 'receiver-1',
    message: id,
    isRead: false,
    createdAt,
  };
}

const merged = mergeChatMessages(
  [message('b', '2026-05-17T10:00:02.000Z'), message('a', '2026-05-17T10:00:01.000Z')],
  [message('b', '2026-05-17T10:00:02.000Z'), message('c', '2026-05-17T10:00:03.000Z')],
);

assert.deepEqual(merged.map((item) => item.id), ['a', 'b', 'c']);
assert.equal(shouldAutoScrollForIncomingMessage({ isNearBottom: true, isOwnMessage: false }), true);
assert.equal(shouldAutoScrollForIncomingMessage({ isNearBottom: false, isOwnMessage: true }), true);
assert.equal(shouldAutoScrollForIncomingMessage({ isNearBottom: false, isOwnMessage: false }), false);
