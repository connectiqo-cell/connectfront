import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';

const params = new URLSearchParams(window.location.search);
const TOKEN = params.get('token');
const MEETING_ID = params.get('meetingId');

function Tile({ participantId, top, height }) {
  const { webcamStream, webcamOn, displayName } = useParticipant(participantId);
  const videoRef = useRef(null);

  useEffect(() => {
    console.log('[Tile] participant:', participantId, '| webcamOn:', webcamOn, '| hasStream:', !!webcamStream, '| hasTrack:', !!webcamStream?.track);
    const video = videoRef.current;
    if (!video) return;
    const track = webcamStream?.track;
    if (!track) {
      video.srcObject = null;
      return;
    }
    const ms = new MediaStream();
    ms.addTrack(track);
    video.muted = true;
    video.srcObject = ms;
    video.play()
      .then(() => console.log('[Tile] video playing for:', participantId))
      .catch(err => console.error('[Tile] video play error for:', participantId, err));
    return () => { video.srcObject = null; };
  }, [webcamStream, webcamOn]);

  const hasStream = !!webcamStream?.track;

  return (
    <div style={{ position: 'absolute', top, left: 0, right: 0, height, overflow: 'hidden', background: '#111' }}>
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
        }}
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

  const { participants } = useMeeting({
    onMeetingJoined,
    onError,
    onParticipantJoined,
    onParticipantLeft,
    onStreamEnabled,
    onStreamDisabled,
  });

  // Fallback: also read from participants map directly (in case callbacks fire before mount)
  useEffect(() => {
    const mapIds = [...participants.keys()];
    console.log('[Meeting] participants map size:', mapIds.length, '| ids:', mapIds);
    if (mapIds.length > 0) {
      setIds(prev => {
        const merged = [...new Set([...prev, ...mapIds])];
        return merged;
      });
    }
  }, [participants.size]);

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
      config={{ meetingId: MEETING_ID, micEnabled: false, webcamEnabled: false, name: 'Recorder', multiStream: false }}
      token={TOKEN}
      joinWithoutUserInteraction
    >
      <MeetingView />
    </MeetingProvider>
  );
}
