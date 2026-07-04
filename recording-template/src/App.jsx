import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

const params = new URLSearchParams(window.location.search);
const TOKEN = params.get('token');
const MEETING_ID = params.get('meetingId');
const PARTICIPANT_ID = params.get('participantId');
const MENTOR_ID = params.get('mentorId');

function NameOverlay({ displayName }) {
  const firstName = displayName?.split(' ')[0] || displayName;
  return (
    <div style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 10, pointerEvents: 'none', textAlign: 'right' }}>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 15, fontFamily: 'sans-serif', textShadow: '0 1px 4px rgba(0,0,0,0.85)' }}>
        {firstName}
      </div>
    </div>
  );
}

function ConnectiqoDivider() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: 0, right: 0,
      transform: 'translateY(-50%)',
      height: 40, zIndex: 20,
      display: 'flex', alignItems: 'center',
      paddingLeft: 16, paddingRight: 16, gap: 10,
      pointerEvents: 'none',
    }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #7c3aed)' }} />
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed' }} />
      <span style={{ color: '#fff', fontSize: 14, fontFamily: 'sans-serif', letterSpacing: 1, fontWeight: 500 }}>
        connectiqo
      </span>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed' }} />
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #7c3aed)' }} />
    </div>
  );
}

function Tile({ participantId, top, height, isMentor }) {
  const { webcamStream, webcamOn, micStream, micOn, displayName, setQuality } = useParticipant(participantId);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => { setQuality('high'); }, []);

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
  const role = MENTOR_ID ? (isMentor ? 'Creator' : 'Learner') : null;

  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height, overflow: 'hidden', background: '#111' }}>
      <audio ref={audioRef} autoPlay />
      <video
        ref={videoRef}
        autoPlay muted playsInline
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          minWidth: '100%', minHeight: '100%',
          width: 'auto', height: 'auto',
          maxWidth: 'none', maxHeight: 'none',
          transform: 'translate(-50%, -50%)',
          display: hasStream ? 'block' : 'none',
          filter: 'brightness(1.08) contrast(1.06) saturate(1.1)',
        }}
      />
      {displayName && <NameOverlay displayName={displayName} />}
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

  const onMeetingJoined = useCallback(() => { console.log('[Meeting] joined'); }, []);
  const onError = useCallback((err) => { console.error('[Meeting] error:', JSON.stringify(err)); }, []);

  const onParticipantJoined = useCallback((p) => {
    console.log('[Meeting] participant joined:', p.id, p.displayName);
    if (PARTICIPANT_ID && p.id === PARTICIPANT_ID) return;
    setIds(prev => prev.includes(p.id) ? prev : [...prev, p.id]);
  }, []);

  const onParticipantLeft = useCallback((p) => {
    setIds(prev => prev.filter(id => id !== p.id));
  }, []);

  const onStreamEnabled = useCallback((stream, participant) => {
    console.log('[Meeting] stream enabled | participant:', participant?.id, '| kind:', stream?.kind);
  }, []);

  const onStreamDisabled = useCallback((stream, participant) => {
    console.log('[Meeting] stream disabled | participant:', participant?.id, '| kind:', stream?.kind);
  }, []);

  const { participants, localParticipant } = useMeeting({
    onMeetingJoined, onError, onParticipantJoined, onParticipantLeft, onStreamEnabled, onStreamDisabled,
  });

  useEffect(() => {
    const localId = localParticipant?.id || PARTICIPANT_ID;
    const mapIds = [...participants.keys()].filter(id => id !== localId);
    if (mapIds.length > 0) setIds(prev => [...new Set([...prev, ...mapIds])]);
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
          isMentor={MENTOR_ID ? id === MENTOR_ID : i === 0}
        />
      ))}
      {ids.length === 2 && <ConnectiqoDivider />}
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
