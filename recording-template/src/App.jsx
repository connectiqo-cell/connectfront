import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

const params = new URLSearchParams(window.location.search);
const TOKEN = params.get('token');
const MEETING_ID = params.get('meetingId');
const PARTICIPANT_ID = params.get('participantId');

const coverStyle = {
  position: 'absolute',
  top: '50%', left: '50%',
  minWidth: '100%', minHeight: '100%',
  width: 'auto', height: 'auto',
  maxWidth: 'none', maxHeight: 'none',
  transform: 'translate(-50%, -50%)',
};

function Tile({ participantId, top, height }) {
  const { webcamStream, webcamOn, micStream, micOn, displayName } = useParticipant(participantId);
  const videoRef = useRef(null);   // hidden source — never shown
  const canvasRef = useRef(null);  // beauty-filtered output — shown
  const audioRef = useRef(null);
  const rafRef = useRef(null);

  // Wire raw stream to hidden video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = webcamStream?.track;
    if (!track) { video.srcObject = null; return; }
    const ms = new MediaStream();
    ms.addTrack(track);
    video.muted = true;
    video.srcObject = ms;
    video.play().catch(err => console.error('[Tile] video play error:', participantId, err));
    return () => { video.srcObject = null; };
  }, [webcamStream, webcamOn]);

  // Beauty filter render loop: video frames → canvas
  // Dual-pass technique:
  //   Pass 1 — blur smooths skin texture
  //   Pass 2 — sharp original at 70% opacity restores edges + adds brightness/tone
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;

        // Pass 1: soft skin smoothing
        ctx.filter = 'blur(1.5px)';
        ctx.drawImage(video, 0, 0, w, h);

        // Pass 2: sharp detail + beauty tone
        ctx.filter = 'brightness(1.08) contrast(1.06) saturate(1.1)';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(video, 0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.filter = 'none';
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [webcamStream, webcamOn]);

  // Wire mic audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const track = micStream?.track;
    if (!track) { audio.srcObject = null; return; }
    const ms = new MediaStream();
    ms.addTrack(track);
    audio.srcObject = ms;
    audio.play().catch(err => console.error('[Tile] audio play error:', participantId, err));
    return () => { audio.srcObject = null; };
  }, [micStream, micOn]);

  const hasStream = !!webcamStream?.track;

  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height, overflow: 'hidden', background: '#111' }}>
      <audio ref={audioRef} autoPlay />
      <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        style={{ ...coverStyle, display: hasStream ? 'block' : 'none' }}
      />
      {!hasStream && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: 'sans-serif' }}>
              {displayName?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <span style={{ color: '#888', fontSize: 13, fontFamily: 'sans-serif' }}>{displayName || 'Participant'}</span>
        </div>
      )}
    </div>
  );
}

function MeetingView() {
  const [ids, setIds] = useState([]);

  const onMeetingJoined = useCallback(() => {
    console.log('[Meeting] joined successfully');
  }, []);

  const onError = useCallback((err) => {
    console.error('[Meeting] error:', JSON.stringify(err));
  }, []);

  const onParticipantJoined = useCallback((p) => {
    console.log('[Meeting] participant joined:', p.id, p.displayName);
    if (PARTICIPANT_ID && p.id === PARTICIPANT_ID) return;
    setIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
  }, []);

  const onParticipantLeft = useCallback((p) => {
    console.log('[Meeting] participant left:', p.id);
    setIds(prev => prev.filter(id => id !== p.id));
  }, []);

  const onStreamEnabled = useCallback((stream, participant) => {
    console.log('[Meeting] stream enabled | participant:', participant?.id, '| kind:', stream?.kind);
  }, []);

  const onStreamDisabled = useCallback((stream, participant) => {
    console.log('[Meeting] stream disabled | participant:', participant?.id, '| kind:', stream?.kind);
  }, []);

  const { participants, localParticipant } = useMeeting({
    onMeetingJoined,
    onError,
    onParticipantJoined,
    onParticipantLeft,
    onStreamEnabled,
    onStreamDisabled,
  });

  // Fallback: sync from participants map, excluding the recorder
  useEffect(() => {
    const localId = localParticipant?.id || PARTICIPANT_ID;
    const mapIds = [...participants.keys()].filter(id => id !== localId);
    console.log('[Meeting] participants map size:', mapIds.length, '| ids:', mapIds, '| localId:', localId);
    if (mapIds.length > 0) {
      setIds(prev => [...new Set([...prev, ...mapIds])]);
    }
  }, [participants.size, localParticipant?.id]);

  if (ids.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <span style={{ color: '#444', fontSize: 14, fontFamily: 'sans-serif' }}>Connecting…</span>
      </div>
    );
  }

  const tileHeight = `${100 / ids.length}%`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {ids.map((id, i) => (
        <Tile
          key={id}
          participantId={id}
          top={`${(100 / ids.length) * i}%`}
          height={tileHeight}
        />
      ))}
    </div>
  );
}

export default function App() {
  if (!TOKEN || !MEETING_ID) {
    return <div style={{ color: '#888', padding: 24, fontFamily: 'sans-serif' }}>Missing token or meetingId.</div>;
  }
  return (
    <MeetingProvider
      config={{ meetingId: MEETING_ID, micEnabled: false, webcamEnabled: false, name: 'Recorder', participantId: PARTICIPANT_ID }}
      token={TOKEN}
      joinWithoutUserInteraction
    >
      <MeetingView />
    </MeetingProvider>
  );
}
