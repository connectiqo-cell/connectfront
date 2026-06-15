/** Pure lobby rules — used by SessionLobbyView and unit tests. */

export function resolveLobbyPartner({ booking, isMentor, otherUser }) {
  if (otherUser?.name || otherUser?.avatar_url) {
    return {
      name: otherUser.name || (isMentor ? 'Learner' : 'Mentor'),
      avatar_url: otherUser.avatar_url,
    };
  }
  if (isMentor) {
    return {
      name: booking?.profiles?.name || 'Learner',
      avatar_url: booking?.profiles?.avatar_url,
    };
  }
  return {
    name: booking?.mentor_profile?.name || 'Mentor',
    avatar_url: booking?.mentor_profile?.avatar_url,
  };
}

export function getMainLobbyPanelType(sessionStatus) {
  if (sessionStatus === 'upcoming') return 'pre_start';
  if (sessionStatus === 'live') return 'no_show';
  return null;
}

export function shouldTransitionToExpiredOnSlotEnd(sessionStatus, alreadyExpired) {
  return sessionStatus === 'ended' && !alreadyExpired;
}

export function getParticipantStatusText({
  connecting,
  isSessionUpcoming,
  isSessionLive,
  untilStartSec,
  remainingSec,
  otherLabel,
  formatCountdown,
}) {
  if (connecting) return 'Connecting to session room…';
  if (isSessionUpcoming) {
    return `Session starts in ${formatCountdown(untilStartSec)}`;
  }
  if (isSessionLive) {
    return `Slot is live · ${formatCountdown(remainingSec)} remaining`;
  }
  return `Waiting for your ${otherLabel} to join`;
}
