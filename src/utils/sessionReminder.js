import notifee, {
  TriggerType,
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const CHANNEL_ID = 'session_reminders';
const REMINDER_MINUTES = 15;

async function ensureChannel() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Session Reminders',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function requestNotificationPermission() {
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

// Call this ONCE ever on first app launch
export async function requestBatteryOptimizationExemption() {
  if (Platform.OS !== 'android') return;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const asked = await AsyncStorage.getItem('battery_opt_asked');
    if (asked) return;
    const enabled = await notifee.isBatteryOptimizationEnabled();
    if (enabled) {
      await AsyncStorage.setItem('battery_opt_asked', 'true');
      await notifee.openBatteryOptimizationSettings();
    }
  } catch (_) {}
}

/**
 * Schedule a 15-min reminder for both mentor and learner.
 * bookingId is used as the notification ID so it can be cancelled later.
 *
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.sessionDate  — "YYYY-MM-DD"
 * @param {string} params.sessionTime  — "HH:MM:SS"
 * @param {string} params.mentorName
 * @param {boolean} params.isMentor
 */
export async function scheduleSessionReminder({
  bookingId,
  sessionDate,
  sessionTime,
  mentorName,
  isMentor,
}) {
  try {
    await ensureChannel();
    await requestBatteryOptimizationExemption();

    const [year, month, day] = sessionDate.split('-').map(Number);
    const [hours, minutes] = (sessionTime || '00:00').split(':').map(Number);

    const sessionMs = new Date(year, month - 1, day, hours, minutes, 0).getTime();
    const reminderMs = sessionMs - REMINDER_MINUTES * 60 * 1000;

    if (reminderMs <= Date.now()) return; // session is too soon or past

    const title = isMentor ? 'Session starting soon' : 'Your session is starting soon';
    const body = isMentor
      ? `You have a mentoring session in ${REMINDER_MINUTES} minutes.`
      : `Your session with ${mentorName} starts in ${REMINDER_MINUTES} minutes.`;

    await notifee.createTriggerNotification(
      {
        id: bookingId,
        title,
        body,
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          smallIcon: 'ic_notification',
        },
        ios: {
          sound: 'default',
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: reminderMs,
      },
    );

  } catch (err) {
    console.warn('⚠️ Failed to schedule reminder:', err);
  }
}

/**
 * Cancel a previously scheduled reminder (e.g. booking cancelled).
 */
export async function cancelSessionReminder(bookingId) {
  try {
    await notifee.cancelTriggerNotification(bookingId);
  } catch (err) {
    console.warn('⚠️ Failed to cancel reminder:', err);
  }
}
