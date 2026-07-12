import { useMemo } from 'react';
import { MediaStream } from '@videosdk.live/react-native-sdk';

/** Stable RTCView streamURL — avoids recreating MediaStream every render (iOS memory/CPU). */
export function useRtcStreamUrl(stream) {
  const track = stream?.track;
  return useMemo(() => {
    if (!track) return null;
    return new MediaStream([track]).toURL();
  }, [track]);
}
