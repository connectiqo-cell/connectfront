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

  // Match canvas pixel size to container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sync = () => {
      canvas.width = container.clientWidth || 360;
      canvas.height = container.clientHeight || 640;
    };

    sync();
    const t = setTimeout(sync, 300); // retry after layout settles
    return () => clearTimeout(t);
  }, []);

  // Draw video to canvas every frame with cover scaling — bypasses objectFit entirely
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
      if (!video.videoWidth || video.readyState < 2) return;

      const cw = canvas.width || 360;
      const ch = canvas.height || 640;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // Cover: scale up so both dimensions fill, crop the excess
      const scale = Math.max(cw / vw, ch / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, dx, dy, dw, dh);
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
    return <div style={{ color: '#888', padding: 24, fontFamily: 'sans-serif' }}>Missing token or meetingId in URL params.</div>;
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
  canvas: { display: 'block', width: '100%', height: '100%' },
  avatarWrap: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, background: '#2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700', fontFamily: 'sans-serif' },
  nameText: { color: '#888', fontSize: 14, fontFamily: 'sans-serif' },
  waiting: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
