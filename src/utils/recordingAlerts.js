import { Alert } from 'react-native';

/** Plain-language copy for in-call recording prompts. */
export const RECORDING_ALERTS = {
  mentorAtBooking: {
    title: 'Learner asked to record',
    message:
      'This learner chose "Yes, record it" when booking.\n\n' +
      'If you agree, recording starts automatically once you are both in the call.\n\n' +
      'You can also start later from the menu (⋯) → Start Recording.',
    skip: 'Start without recording',
    agree: 'Agree — record session',
  },
  requestConsent: {
    title: 'Record this session?',
    message:
      'The other person must agree before anything is recorded.\n\n' +
      'They will see a prompt on their screen. Recording starts only after you both say yes.',
    cancel: 'Not now',
    confirm: 'Ask to record',
  },
  incomingConsent: {
    title: (role) => `${role} wants to record`,
    message:
      'If you agree, this call will be recorded and saved for later review.\n\n' +
      'You can say no — the session will continue without recording.',
    decline: 'No, don\'t record',
    agree: 'Yes, I agree',
  },
  stopRecording: {
    title: 'Stop recording?',
    message:
      'Everything recorded so far will be saved.\n\n' +
      'You can start recording again later from the menu if needed.',
    keep: 'Keep recording',
    stop: 'Stop recording',
  },
  declined: {
    title: 'Recording not started',
    message: 'The other person chose not to record this session. You can ask again later from the menu.',
    ok: 'OK',
  },
  mentorOnlyStop: {
    title: 'Can\'t stop recording',
    message: 'Only the mentor can stop the recording. Please ask them to tap ⋯ → Stop Recording.',
    ok: 'OK',
  },
  waitForPeer: {
    title: 'Not ready yet',
    message: 'Wait until the other person joins the call, then try again.',
    ok: 'OK',
  },
};

export function showAlert(title, message, buttons, options) {
  Alert.alert(title, message, buttons, options);
}

export function showMentorBookingRecordingAlert({ onAgree, onSkip, present = showAlert }) {
  const copy = RECORDING_ALERTS.mentorAtBooking;
  present(
    copy.title,
    copy.message,
    [
      { text: copy.skip, style: 'cancel', onPress: onSkip },
      { text: copy.agree, onPress: onAgree },
    ],
    { cancelable: false },
  );
}

export function showRequestRecordingConsentAlert({ onRequest, present = showAlert }) {
  const copy = RECORDING_ALERTS.requestConsent;
  present(
    copy.title,
    copy.message,
    [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.confirm, onPress: onRequest },
    ],
    { cancelable: true },
  );
}

export function showIncomingRecordingConsentAlert({
  requesterRole,
  onAgree,
  onDecline,
  present = showAlert,
}) {
  const copy = RECORDING_ALERTS.incomingConsent;
  present(
    copy.title(requesterRole),
    copy.message,
    [
      { text: copy.decline, style: 'cancel', onPress: onDecline },
      { text: copy.agree, onPress: onAgree },
    ],
    { cancelable: false },
  );
}

export function showStopRecordingAlert({ onStop, present = showAlert }) {
  const copy = RECORDING_ALERTS.stopRecording;
  present(
    copy.title,
    copy.message,
    [
      { text: copy.keep, style: 'cancel' },
      { text: copy.stop, style: 'destructive', onPress: onStop },
    ],
    { cancelable: true },
  );
}

export function showRecordingDeclinedAlert({ present = showAlert } = {}) {
  const copy = RECORDING_ALERTS.declined;
  present(copy.title, copy.message, [{ text: copy.ok }], { cancelable: true });
}

export function showMentorOnlyStopAlert({ present = showAlert } = {}) {
  const copy = RECORDING_ALERTS.mentorOnlyStop;
  present(copy.title, copy.message, [{ text: copy.ok }], { cancelable: true });
}

export function showWaitForPeerAlert({ present = showAlert } = {}) {
  const copy = RECORDING_ALERTS.waitForPeer;
  present(copy.title, copy.message, [{ text: copy.ok }], { cancelable: true });
}
