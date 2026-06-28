import React, { useEffect, useRef } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

const params = new URLSearchParams(window.location.search);
const TOKEN = params.get('token');
const MEETING_ID = params.get('meetingId');

function ParticipantTile({ participantId }) {
  const { webcamStream, webcamOn, displayName } = useParticipant(participantId);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !webcamStream) return;

    const mediaStream = new MediaStream();
    mediaStream.addTrack(webcamStream.track);
    video.srcObject = mediaStream;

    const fillContainer = () => {
      if (!video.videoWidth || !container) return;
      const scaleX = container.clientWidth / video.videoWidth;
      const scaleY = container.clientHeight / video.videoHeight;
      const scale = Math.max(scaleX, scaleY);
      // Set natural size then scale-up to cover the container
      video.style.width = video.videoWidth + 'px';
      video.style.height = video.videoHeight + 'px';
      video.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };

    video.addEventListener('loadedmetadata', () => {
      fillContainer();
      video.play().catch(() => {});
    });
    video.addEventListener('resize', fillContainer);
  }, [webcamStream]);

  return (
    <div ref={containerRef} style={styles.tile}>
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
    top: '50%',
    left: '50%',
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
