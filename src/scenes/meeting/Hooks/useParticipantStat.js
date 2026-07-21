import { useParticipant } from "@videosdk.live/react-native-sdk";
import { useRef, useState, useEffect } from "react";
import { Platform } from "react-native";

function useParticipantStat({ participantId }) {
  const {
    webcamStream,
    micStream,
    getVideoStats,
    getAudioStats,
    getShareStats,
    isPresenting,
    displayName,
    webcamOn,
    micOn,
    screenShareOn,
    screenShareStream,
    setQuality,
    isLocal,
  } = useParticipant(participantId);

  const statsIntervalIdRef = useRef();
  const mountedRef = useRef(true);
  const [score, setScore] = useState(null);
  const [audioStats, setAudioStats] = useState({});
  const [videoStats, setVideoStats] = useState({});

  function getQualityScore(stats) {
    const packetLossPercent = stats.packetsLost / stats.totalPackets || 0;
    const jitter = stats.jitter;
    const rtt = stats.rtt;
    let score = 100;
    score -= packetLossPercent * 50 > 50 ? 50 : packetLossPercent * 50;
    score -= ((jitter / 30) * 25 > 25 ? 25 : (jitter / 30) * 25) || 0;
    score -= ((rtt / 300) * 25 > 25 ? 25 : (rtt / 300) * 25) || 0;
    return score / 10;
  }

  const updateStats = async () => {
    if (!mountedRef.current) return;
    // Skip if streams are already gone — peer connection may be closed
    if (!webcamStream && !micStream && !isPresenting) return;

    try {
      let stats = [];
      let nextAudioStats = [];
      let nextVideoStats = [];

      if (isPresenting) {
        stats = await getShareStats();
        nextVideoStats = stats;
      } else if (webcamStream) {
        stats = await getVideoStats();
        nextVideoStats = stats;
        nextAudioStats = await getAudioStats();
      } else if (micStream) {
        stats = await getAudioStats();
        nextAudioStats = stats;
      }

      if (!mountedRef.current) return;

      const nextScore = stats?.length > 0 ? getQualityScore(stats[0]) : 100;

      setScore(nextScore);
      setAudioStats(nextAudioStats);
      setVideoStats(nextVideoStats);
    } catch (_) {
      // Peer connection closed or stream ended mid-interval — safe to ignore.
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (webcamStream || micStream) {
      updateStats();

      if (statsIntervalIdRef.current) {
        clearInterval(statsIntervalIdRef.current);
      }

      statsIntervalIdRef.current = setInterval(
        updateStats,
        Platform.OS === 'ios' ? 5000 : 3000,
      );
    } else {
      if (statsIntervalIdRef.current) {
        clearInterval(statsIntervalIdRef.current);
        statsIntervalIdRef.current = null;
      }
    }

    return () => {
      if (statsIntervalIdRef.current) {
        clearInterval(statsIntervalIdRef.current);
        statsIntervalIdRef.current = null;
      }
    };
  }, [webcamStream, micStream]);

  return {
    score,
    audioStats,
    videoStats,
    displayName,
    webcamOn,
    webcamStream,
    micOn,
    screenShareOn,
    screenShareStream,
    setQuality,
    isLocal,
  };
}

export default useParticipantStat;
