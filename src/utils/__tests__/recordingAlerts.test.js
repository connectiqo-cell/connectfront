import { Alert } from 'react-native';
import {
  RECORDING_ALERTS,
  showMentorBookingRecordingAlert,
  showRequestRecordingConsentAlert,
  showStopRecordingAlert,
} from '../recordingAlerts';

describe('recordingAlerts', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('shows mentor booking alert with friendly buttons', () => {
    showMentorBookingRecordingAlert({ onAgree: jest.fn(), onSkip: jest.fn() });

    expect(Alert.alert).toHaveBeenCalledWith(
      RECORDING_ALERTS.mentorAtBooking.title,
      RECORDING_ALERTS.mentorAtBooking.message,
      expect.arrayContaining([
        expect.objectContaining({ text: RECORDING_ALERTS.mentorAtBooking.skip }),
        expect.objectContaining({ text: RECORDING_ALERTS.mentorAtBooking.agree }),
      ]),
      { cancelable: false },
    );
  });

  it('shows request consent alert', () => {
    showRequestRecordingConsentAlert({ onRequest: jest.fn() });

    expect(Alert.alert).toHaveBeenCalledWith(
      RECORDING_ALERTS.requestConsent.title,
      RECORDING_ALERTS.requestConsent.message,
      expect.any(Array),
      { cancelable: true },
    );
  });

  it('shows stop recording alert', () => {
    showStopRecordingAlert({ onStop: jest.fn() });

    expect(Alert.alert).toHaveBeenCalledWith(
      RECORDING_ALERTS.stopRecording.title,
      RECORDING_ALERTS.stopRecording.message,
      expect.arrayContaining([
        expect.objectContaining({ text: RECORDING_ALERTS.stopRecording.keep }),
        expect.objectContaining({ text: RECORDING_ALERTS.stopRecording.stop }),
      ]),
      { cancelable: true },
    );
  });
});
