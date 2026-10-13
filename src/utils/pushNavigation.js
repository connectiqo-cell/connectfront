import { SCREEN_NAMES } from '../navigators/screenNames';

/**
 * Routes a tapped push notification to its screen. Every tap path feeds
 * openFromPush(): FCM tray tap (background / cold start), Notifee tray tap
 * (foreground / background / cold start). The target is held as `pending`
 * until navigation is mounted AND the signed-in stack exists, so a tap that
 * cold-starts the app still lands on the right screen after splash/auth.
 */
let navigationRef = null;
let pending = null;

function targetFor(data) {
  if (data?.type === 'new_message') {
    return data.conversationId
      ? [SCREEN_NAMES.MessageThread, { conversationId: data.conversationId }]
      : [SCREEN_NAMES.Messages];
  }
  return null; // other push types keep their existing behaviour (app just opens)
}

/** Try to perform the pending navigation; safe to call any time. */
export function flushPushNavigation() {
  const nav = navigationRef?.current;
  if (!pending || !nav?.isReady?.()) return;
  const [name, params] = pending;
  // Guest/onboarding stacks don't have the screen yet — keep waiting.
  if (!nav.getRootState()?.routeNames?.includes(name)) return;
  pending = null;
  nav.navigate(name, params);
}

export function setPushNavigationRef(ref) {
  navigationRef = ref;
  flushPushNavigation();
}

export function openFromPush(data) {
  const target = targetFor(data);
  if (!target) return;
  pending = target;
  flushPushNavigation();
}
