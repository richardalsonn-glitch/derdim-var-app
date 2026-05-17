const NIGHT_MODE_OPEN_HOUR_TR = 22;
const NIGHT_MODE_CLOSE_HOUR_TR = 6;
const TURKEY_TIME_ZONE = 'Europe/Istanbul';

function getTurkeyHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat('tr-TR', {
    hour: 'numeric',
    hour12: false,
    timeZone: TURKEY_TIME_ZONE,
  }).format(date);

  return Number(hour);
}

export function isNightModeOpen(date = new Date()) {
  if (process.env.EXPO_PUBLIC_FORCE_NIGHT_MODE_OPEN?.trim().toLowerCase() === 'true') {
    return true;
  }

  const hour = getTurkeyHour(date);
  return hour >= NIGHT_MODE_OPEN_HOUR_TR || hour < NIGHT_MODE_CLOSE_HOUR_TR;
}

export function getNightModeSubtitle(isDemoMode: boolean) {
  return isDemoMode ? '22:00 - 06:00 • erken erişim açık' : '22:00 - 06:00 • Türkiye saati';
}

export const NIGHT_MODE_CLOSED_MESSAGE = 'Gece Modu Türkiye saati ile 22:00 - 06:00 arasında aktiftir.';
