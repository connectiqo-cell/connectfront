import React, { useEffect, useRef } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

const params = new URLSearchParams(window.location.search);
const TOKEN = params.get('token');
const MEETING_ID = params.get('meetingId');

function ParticipantTile({ participantId }) {
  const { webcamStream, webcamOn, displayName } = useParticipant(participantId);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !webcamStream) return;
    const mediaStream = new MediaStream();
    mediaStream.addTrack(webcamStream.track);
    videoRef.current.srcObject = mediaStream;
    videoRef.current.play().catch(() => {});
  }, [webcamStream]);

  return (
    <div style={styles.tile}>
      {webcamOn ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={styles.video}
        />
      ) : (
        <div style={styles.avatarWrap}>
          <div style={styles.avatar}>
            <span style={styles.avatarText}>
              {displayName?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <span style={styles.nameText}>{displayName || 'Participant'}</span>
        </div>
      )}
    </div>
  );
}

function MeetingView() {
  const { participants, join } = useMeeting();

  useEffect(() => {
    join();
  }, []);

  const ids = [...participants.keys()];

  return (
    <div style={styles.container}>
      {ids.length === 0 ? (
        <div style={styles.waiting}>
          <span style={{ color: '#666', fontSize: 16 }}>Waiting for participants…</span>
        </div>
      ) : (
        ids.map(id => <ParticipantTile key={id} participantId={id} />)
      )}
    </div>
  );
}

export default function App() {
  if (!TOKEN || !MEETING_ID) {
    return (
      <div style={{ color: '#888', padding: 24, fontFamily: 'sans-serif' }}>
        Missing token or meetingId in URL params.
      </div>
    );
  }

  return (
    <MeetingProvider
      config={{
        meetingId: MEETING_ID,
        micEnabled: false,
        webcamEnabled: false,
        name: 'Recorder',
        multiStream: false,
      }}
      token={TOKEN}
      joinWithoutUserInteraction
    >
      <MeetingView />
    </MeetingProvider>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    background: '#000',
  },
  tile: {
    flex: 1,
    overflow: 'hidden',
    background: '#000',
    position: 'relative',
    minHeight: 0,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  avatarWrap: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: '#2a2a3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'sans-serif',
  },
  nameText: {
    color: '#888',
    fontSize: 14,
    fontFamily: 'sans-serif',
  },
  waiting: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
