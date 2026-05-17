export type GiftOverlayItem = {
  caption: string;
  giftId: string;
};

export type GiftOverlayQueueState = {
  current: GiftOverlayItem | null;
  queue: GiftOverlayItem[];
  enqueue: (item: GiftOverlayItem) => GiftOverlayQueueState;
  completeCurrent: () => GiftOverlayQueueState;
  clear: () => GiftOverlayQueueState;
};

function buildGiftOverlayQueueState(current: GiftOverlayItem | null, queue: GiftOverlayItem[]): GiftOverlayQueueState {
  return {
    current,
    queue,
    enqueue: (item) => {
      if (!current) {
        return buildGiftOverlayQueueState(item, queue);
      }

      return buildGiftOverlayQueueState(current, [...queue, item]);
    },
    completeCurrent: () => buildGiftOverlayQueueState(queue[0] ?? null, queue.slice(1)),
    clear: () => buildGiftOverlayQueueState(null, []),
  };
}

export function createGiftOverlayQueueState() {
  return buildGiftOverlayQueueState(null, []);
}

export function shouldClearGiftOverlayTimerBeforeEnqueue(isOverlayActive: boolean) {
  return !isOverlayActive;
}

export function shouldLeaveRandomQueueOnUnmount({
  hasLeftCall,
  isFriendCallSession,
  isMatched,
  isRealtimeSession,
}: {
  hasLeftCall: boolean;
  isFriendCallSession: boolean;
  isMatched: boolean;
  isRealtimeSession: boolean;
}) {
  return isRealtimeSession && !isFriendCallSession && !isMatched && !hasLeftCall;
}

export function getHomeResponsiveMetrics({ width, height }: { width: number; height: number }) {
  const tiny = width < 360;
  const compact = width < 390 || height <= 844;
  const veryShort = height < 700;
  const short = height <= 844;

  return {
    compact,
    short,
    veryShort,
    tiny,
    gap: veryShort ? 5 : short ? 7 : 10,
    ctaGap: veryShort ? 7 : 10,
    ctaCardHeight: veryShort ? 78 : 88,
    ctaCardMinHeight: veryShort ? 78 : 88,
    ctaCardMaxHeight: veryShort ? 88 : 96,
    autoMinHeight: veryShort ? 58 : 70,
    autoMaxHeight: veryShort ? 70 : 84,
    featureBlockMinHeight: veryShort ? 156 : 192,
    featureCardHeight: veryShort ? 46 : compact ? 58 : 62,
    featureCardMinHeight: veryShort ? 46 : compact ? 58 : 62,
    featureOffset: veryShort ? 0 : compact ? 3 : 6,
    iconButton: veryShort ? 38 : compact ? 42 : 48,
  };
}
