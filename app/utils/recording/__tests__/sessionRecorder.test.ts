import { pickMimeType, recordingWanted } from '../sessionRecorder';

describe('recordingWanted', () => {
  it('is null unless the study records audio or camera', () => {
    expect(recordingWanted({ audioRecord: false, cameraRecord: false })).toBeNull();
    expect(recordingWanted({ audioRecord: true, cameraRecord: false })).toEqual({ audio: true, camera: false });
    expect(recordingWanted({ audioRecord: false, cameraRecord: true })).toEqual({ audio: false, camera: true });
  });
});

describe('pickMimeType', () => {
  it('records video when the camera is on, and audio only otherwise', () => {
    const all = () => true;
    expect(pickMimeType({ audio: true, camera: true }, all)).toMatch(/^video\//);
    expect(pickMimeType({ audio: true, camera: false }, all)).toMatch(/^audio\//);
  });

  it('falls back to MP4 where WebM cannot be recorded (Safari / iPad)', () => {
    const safari = (type: string) => type.endsWith('mp4');
    expect(pickMimeType({ audio: true, camera: true }, safari)).toBe('video/mp4');
    expect(pickMimeType({ audio: true, camera: false }, safari)).toBe('audio/mp4');
    expect(pickMimeType({ audio: true, camera: false }, () => false)).toBe('');
  });
});
