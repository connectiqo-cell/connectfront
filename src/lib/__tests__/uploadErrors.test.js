import { uploadErrorMessage } from '../uploadErrors';

// tus wraps the HTTP response rather than exposing .status
const tusErr = (code, msg = 'tus: unexpected response while creating upload') => {
  const e = new Error(`${msg}, originated from request (method: POST, response code: ${code})`);
  e.originalResponse = { getStatus: () => code };
  return e;
};

describe('uploadErrorMessage', () => {
  it('explains a too-large video with an action', () => {
    expect(uploadErrorMessage(tusErr(413))).toMatch(/too large/i);
    expect(uploadErrorMessage(tusErr(413))).toMatch(/shorter clip|80 MB/i);
  });

  it('apologises for server errors rather than blaming the user', () => {
    const msg = uploadErrorMessage(tusErr(500));
    expect(msg).toMatch(/our server/i);
    expect(msg).toMatch(/sorry/i);
    expect(msg).toMatch(/saved/i);
  });

  it('treats 502/503 as server errors too', () => {
    expect(uploadErrorMessage(tusErr(503))).toMatch(/our server/i);
  });

  it('tells the user to sign in again on an expired session', () => {
    expect(uploadErrorMessage(tusErr(401))).toMatch(/sign in again/i);
  });

  it('reassures on a network drop', () => {
    const msg = uploadErrorMessage(new Error('Network request failed'));
    expect(msg).toMatch(/no internet|connection/i);
    expect(msg).toMatch(/saved/i);
  });

  it('uses our own watchdog wording', () => {
    expect(uploadErrorMessage(new Error('Connection too slow — upload could not complete')))
      .toMatch(/too slow/i);
    expect(uploadErrorMessage(new Error('Upload stalled'))).toMatch(/dropped/i);
  });

  it('reads the status out of the tus message when no response object exists', () => {
    const bare = new Error('tus: unexpected response, originated from request (response code: 413)');
    expect(uploadErrorMessage(bare)).toMatch(/too large/i);
  });

  it('never leaks raw tus text to the user', () => {
    const msg = uploadErrorMessage(tusErr(418));
    expect(msg).not.toMatch(/tus:|originated from request|response code/i);
  });

  it('falls back politely for anything unrecognised', () => {
    const msg = uploadErrorMessage(new Error('???'));
    expect(msg).toMatch(/something went wrong/i);
    expect(msg).toMatch(/saved/i);
  });
});

describe('uploadErrorMessage — offline detection', () => {
  it('reports offline when a request got no reply at all', () => {
    const e = new Error('tus: failed to upload chunk');
    e.originalRequest = {};            // request made
    e.originalResponse = null;         // nothing came back
    expect(uploadErrorMessage(e)).toMatch(/no internet/i);
  });

  it('does NOT claim offline just because no status could be parsed', () => {
    expect(uploadErrorMessage(new Error('some unexpected failure')))
      .not.toMatch(/no internet/i);
  });
});
