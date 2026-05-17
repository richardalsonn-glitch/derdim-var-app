export type ComputedFriendAvailabilityStatus = 'available' | 'busy' | 'searching' | 'offline';

type ComputeFriendAvailabilityInput = {
  activeCallFound?: boolean;
  activeMatchFound?: boolean;
  activeSearchFound?: boolean;
  isOnline?: boolean;
  profileCallStatus?: 'available' | 'busy' | 'offline';
  rpcStatus?: ComputedFriendAvailabilityStatus;
};

export function computeFriendAvailability({
  activeCallFound = false,
  activeMatchFound = false,
  activeSearchFound = false,
  isOnline = false,
  profileCallStatus = 'offline',
  rpcStatus,
}: ComputeFriendAvailabilityInput) {
  if (activeCallFound || activeMatchFound) {
    return {
      activeCallFound,
      activeMatchFound,
      reason: activeCallFound ? 'active-call' : 'active-match',
      staleIgnored: false,
      status: 'busy' as const,
    };
  }

  if (activeSearchFound) {
    return {
      activeCallFound,
      activeMatchFound,
      reason: 'active-search',
      staleIgnored: false,
      status: 'searching' as const,
    };
  }

  if (!isOnline || profileCallStatus === 'offline') {
    return {
      activeCallFound,
      activeMatchFound,
      reason: 'offline-presence',
      staleIgnored: rpcStatus === 'busy' || profileCallStatus === 'busy' || rpcStatus === 'searching',
      status: 'offline' as const,
    };
  }

  if (rpcStatus === 'searching') {
    return {
      activeCallFound,
      activeMatchFound,
      reason: 'active-search',
      staleIgnored: false,
      status: 'searching' as const,
    };
  }

  return {
    activeCallFound,
    activeMatchFound,
    reason: rpcStatus === 'busy' || profileCallStatus === 'busy' ? 'stale-busy-ignored' : 'online-available',
    staleIgnored: rpcStatus === 'busy' || profileCallStatus === 'busy',
    status: 'available' as const,
  };
}
