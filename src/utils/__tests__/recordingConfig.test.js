import {
  buildOneToOneRecordingConfig,
  startOneToOneRecording,
  ONE_TO_ONE_RECORDING_CONFIG,
} from '../recordingConfig';

const BASE = {
  theme: 'DARK',
  mode: 'video-and-audio',
  quality: 'high',
  orientation: 'portrait',
};

describe('recordingConfig', () => {
  describe('buildOneToOneRecordingConfig', () => {
    it('always uses GRID layout regardless of participant count', () => {
      expect(buildOneToOneRecordingConfig(1)).toEqual({
        ...BASE,
        layout: { type: 'GRID', priority: 'SPEAKER', gridSize: 1 },
      });

      expect(buildOneToOneRecordingConfig(2)).toEqual({
        ...BASE,
        layout: { type: 'GRID', priority: 'SPEAKER', gridSize: 2 },
      });

      expect(buildOneToOneRecordingConfig(3).layout).toEqual({
        type: 'GRID',
        priority: 'SPEAKER',
        gridSize: 3,
      });
    });

    it('clamps invalid counts to safe bounds', () => {
      expect(buildOneToOneRecordingConfig(0).layout.gridSize).toBe(1);
      expect(buildOneToOneRecordingConfig(-2).layout.gridSize).toBe(1);
      expect(buildOneToOneRecordingConfig(9).layout.gridSize).toBe(4);
    });

    it('defaults to a 2-person grid', () => {
      expect(buildOneToOneRecordingConfig().layout).toEqual({
        type: 'GRID',
        priority: 'SPEAKER',
        gridSize: 2,
      });
    });
  });

  describe('ONE_TO_ONE_RECORDING_CONFIG', () => {
    it('matches the 2-participant grid preset', () => {
      expect(ONE_TO_ONE_RECORDING_CONFIG).toEqual(buildOneToOneRecordingConfig(2));
    });
  });

  describe('startOneToOneRecording', () => {
    it('passes null webhook paths and dynamic layout to VideoSDK', () => {
      const startRecording = jest.fn();

      startOneToOneRecording(startRecording, 2);

      expect(startRecording).toHaveBeenCalledTimes(1);
      expect(startRecording).toHaveBeenCalledWith(
        null,
        null,
        buildOneToOneRecordingConfig(2),
      );
    });
  });
});
