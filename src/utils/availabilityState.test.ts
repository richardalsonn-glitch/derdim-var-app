import { computeFriendAvailability } from './availabilityState';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`);
  }
}

assertEqual(
  computeFriendAvailability({
    activeCallFound: false,
    activeMatchFound: false,
    isOnline: true,
    profileCallStatus: 'busy',
    rpcStatus: 'busy',
  }).status,
  'available',
  'stale busy status should not keep an online friend busy',
);

assertEqual(
  computeFriendAvailability({
    activeCallFound: false,
    activeMatchFound: false,
    isOnline: false,
    profileCallStatus: 'busy',
    rpcStatus: 'busy',
  }).status,
  'offline',
  'stale busy status should fall back to offline when presence is not fresh',
);

assertEqual(
  computeFriendAvailability({
    activeCallFound: false,
    activeMatchFound: true,
    isOnline: true,
    profileCallStatus: 'available',
    rpcStatus: 'available',
  }).status,
  'busy',
  'active matched session should be busy',
);

assertEqual(
  computeFriendAvailability({
    activeCallFound: true,
    activeMatchFound: false,
    isOnline: false,
    profileCallStatus: 'offline',
    rpcStatus: 'available',
  }).status,
  'busy',
  'active call should remain busy even when presence is stale',
);

assertEqual(
  computeFriendAvailability({
    activeCallFound: false,
    activeMatchFound: false,
    activeSearchFound: true,
    isOnline: true,
    profileCallStatus: 'available',
    rpcStatus: 'searching',
  }).status,
  'searching',
  'active waiting queue should be searching',
);
