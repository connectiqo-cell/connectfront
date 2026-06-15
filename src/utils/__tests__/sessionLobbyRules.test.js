import {
  getMainLobbyPanelType,
  shouldTransitionToExpiredOnSlotEnd,
  getParticipantStatusText,
  resolveLobbyPartner,
} from '../sessionLobbyRules';
import { formatCountdown } from '../sessionSlotTimer';

describe('resolveLobbyPartner', () => {
  it('shows mentor profile for learners, not learner profile fallback', () => {
    const partner = resolveLobbyPartner({
      isMentor: false,
      otherUser: null,
      booking: {
        profiles: { name: 'Me Learner', avatar_url: 'learner.jpg' },
        mentor_profile: { name: 'Dr. Smith', avatar_url: 'mentor.jpg' },
      },
    });
    expect(partner.name).toBe('Dr. Smith');
    expect(partner.avatar_url).toBe('mentor.jpg');
  });

  it('shows learner profile for mentors', () => {
    const partner = resolveLobbyPartner({
      isMentor: true,
      otherUser: null,
      booking: {
        profiles: { name: 'Sam Learner', avatar_url: 'learner.jpg' },
        mentor_profile: { name: 'Dr. Smith', avatar_url: 'mentor.jpg' },
      },
    });
    expect(partner.name).toBe('Sam Learner');
  });

  it('prefers otherUser when provided', () => {
    const partner = resolveLobbyPartner({
      isMentor: false,
      otherUser: { name: 'Alex', avatar_url: 'alex.jpg' },
      booking: { mentor_profile: { name: 'Dr. Smith' } },
    });
    expect(partner.name).toBe('Alex');
  });
});

describe('sessionLobbyRules', () => {
  describe('getMainLobbyPanelType', () => {
    it('shows pre-start panel before slot opens', () => {
      expect(getMainLobbyPanelType('upcoming')).toBe('pre_start');
    });

    it('shows no-show panel when slot is live', () => {
      expect(getMainLobbyPanelType('live')).toBe('no_show');
    });

    it('shows no main panel when slot ended', () => {
      expect(getMainLobbyPanelType('ended')).toBeNull();
    });
  });

  describe('shouldTransitionToExpiredOnSlotEnd', () => {
    it('transitions once when slot ends', () => {
      expect(shouldTransitionToExpiredOnSlotEnd('ended', false)).toBe(true);
      expect(shouldTransitionToExpiredOnSlotEnd('ended', true)).toBe(false);
      expect(shouldTransitionToExpiredOnSlotEnd('live', false)).toBe(false);
    });
  });

  describe('getParticipantStatusText', () => {
    const base = {
      connecting: false,
      isSessionUpcoming: false,
      isSessionLive: false,
      untilStartSec: 600,
      remainingSec: 1200,
      otherLabel: 'mentor',
      formatCountdown,
    };

    it('shows connecting message', () => {
      expect(
        getParticipantStatusText({ ...base, connecting: true })
      ).toBe('Connecting to session room…');
    });

    it('shows countdown before start', () => {
      expect(
        getParticipantStatusText({ ...base, isSessionUpcoming: true })
      ).toBe('Session starts in 10:00');
    });

    it('shows remaining time when live', () => {
      expect(
        getParticipantStatusText({ ...base, isSessionLive: true })
      ).toBe('Slot is live · 20:00 remaining');
    });

    it('shows generic wait when neither upcoming nor live', () => {
      expect(getParticipantStatusText(base)).toBe('Waiting for your mentor to join');
    });
  });
});
