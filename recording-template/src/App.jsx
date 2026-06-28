import React, { useEffect, useRef } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

const params = new URLSearchParams(window.location.search);
const TOKEN = params.get('token');
const MEETING_ID = params.get('meetingId');

function ParticipantTile({ participantId }) {
  const { webcamStream, webcamOn, displayName } = useParticipant(participantId);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !webcamStream) return;

    const ms = new MediaStream();
    ms.addTrack(webcamStream.track);
    video.srcObject = ms;
    video.play().catch(() => {});

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      // Sync canvas pixel size to actual rendered container size every frame
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const cw = Math.round(rect.width) || window.innerWidth || 720;
        const ch = Math.round(rect.height) || Math.floor(window.innerHeight / 2) || 640;
        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;
      }

      if (!video.videoWidth || video.readyState < 2) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // Cover: scale so video fills tile completely, crop the excess
      const scale = Math.max(cw / vw, ch / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      canvas.getContext('2d').drawImage(video, dx, dy, dw, dh);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.srcObject = null;
    };
  }, [webcamStream]);

  return (
    <div ref={containerRef} style={styles.tile}>
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      {webcamOn ? (
        <canvas ref={canvasRef} style={styles.canvas} />
      ) : (
        <div style={styles.avatarWrap}>
          <div style={styles.avatar}>
            <span style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || '?'}</span>
          </div>
          <span style={styles.nameText}>{displayName || 'Participant'}</span>
        </div>
      )}
    </div>
  );
}

function MeetingView() {
  const { participants, join } = useMeeting();
  useEffect(() => { join(); }, []);
  const ids = [...participants.keys()];

  return (
    <div style={styles.container}>
      {ids.length === 0 ? (
        <div style={styles.waiting}>
          <span style={{ color: '#555', fontSize: 14 }}>Waiting for participants…</span>
        </div>
      ) : (
        ids.map(id => <ParticipantTile key={id} participantId={id} />)
      )}
    </div>
  );
}

export default function App() {
  if (!TOKEN || !MEETING_ID) {
    return <div style={{ color: '#888', padding: 24, fontFamily: 'sans-serif' }}>Missing token or meetingId.</div>;
  }

  return (
    <MeetingProvider
      config={{ meetingId: MEETING_ID, micEnabled: false, webcamEnabled: false, name: 'Recorder', multiStream: false }}
      token={TOKEN}
      joinWithoutUserInteraction
    >
      <MeetingView />
    </MeetingProvider>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#000' },
  tile: { flex: 1, overflow: 'hidden', background: '#000', position: 'relative', minHeight: 0 },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' },
  avatarWrap: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, background: '#2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700', fontFamily: 'sans-serif' },
  nameText: { color: '#888', fontSize: 14, fontFamily: 'sans-serif' },
  waiting: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
