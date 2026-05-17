import {
  createGiftOverlayQueueState,
  getHomeResponsiveMetrics,
  shouldClearGiftOverlayTimerBeforeEnqueue,
  shouldLeaveRandomQueueOnUnmount,
} from './voiceCallUiState';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const matchedUnmount = shouldLeaveRandomQueueOnUnmount({
  hasLeftCall: false,
  isFriendCallSession: false,
  isMatched: true,
  isRealtimeSession: true,
});
assert(!matchedUnmount, 'matched random calls must not leaveQueue on unmount');

const searchingUnmount = shouldLeaveRandomQueueOnUnmount({
  hasLeftCall: false,
  isFriendCallSession: false,
  isMatched: false,
  isRealtimeSession: true,
});
assert(searchingUnmount, 'searching random calls should leaveQueue on unmount');

let queueState = createGiftOverlayQueueState();
queueState = queueState.enqueue({ caption: 'first', giftId: 'heart' });
queueState = queueState.enqueue({ caption: 'second', giftId: 'star' });
assert(queueState.current?.giftId === 'heart', 'first gift should start immediately');
assert(queueState.queue.length === 1, 'second gift should wait in queue');

queueState = queueState.completeCurrent();
assert(queueState.current?.giftId === 'star', 'second gift should start after first completes');
assert(queueState.queue.length === 0, 'queue should be empty after advancing');
assert(!shouldClearGiftOverlayTimerBeforeEnqueue(true), 'enqueueing while overlay is active must not clear the active timeout');
assert(shouldClearGiftOverlayTimerBeforeEnqueue(false), 'enqueueing with no active overlay may clear stale timeout');

const iphone8 = getHomeResponsiveMetrics({ height: 667, width: 375 });
assert(iphone8.featureCardHeight < 58, 'iPhone 7/8 feature cards should shrink below regular compact height');
assert(iphone8.ctaCardHeight < 88, 'iPhone 7/8 CTA cards should shrink below previous minimum');
assert(iphone8.gap <= 6, 'iPhone 7/8 vertical gap should be tight');
