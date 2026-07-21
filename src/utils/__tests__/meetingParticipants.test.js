import { getMeetingParticipantSnapshot } from '../meetingParticipants';

describe('getMeetingParticipantSnapshot', () => {
  it('counts solo caller as one participant', () => {
    const participants = new Map([['local-1', { id: 'local-1' }]]);

    expect(
      getMeetingParticipantSnapshot(participants, 'local-1'),
    ).toMatchObject({
      remoteParticipantIds: [],
      remoteParticipantId: null,
      participantIds: ['local-1'],
      remoteParticipantCount: 0,
      participantCount: 1,
    });
  });

  it('counts mentor and learner as two without double-counting local', () => {
    const participants = new Map([
      ['local-1', { id: 'local-1' }],
      ['remote-2', { id: 'remote-2', displayName: 'Learner' }],
    ]);

    expect(
      getMeetingParticipantSnapshot(participants, 'local-1'),
    ).toMatchObject({
      remoteParticipantIds: ['remote-2'],
      remoteParticipantId: 'remote-2',
      participantIds: ['local-1', 'remote-2'],
      remoteParticipantCount: 1,
      participantCount: 2,
    });
  });

  it('treats remote-only map as solo until local id is known', () => {
    const participants = new Map([['remote-2', { id: 'remote-2' }]]);

    expect(
      getMeetingParticipantSnapshot(participants, null),
    ).toMatchObject({
      remoteParticipantIds: ['remote-2'],
      participantCount: 1,
    });
  });
});
