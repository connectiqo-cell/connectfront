jest.mock("react-native-compressor", () => ({ Video: { compress: jest.fn() }, getVideoMetaData: jest.fn() }));
jest.mock("@react-native-community/netinfo", () => ({ fetch: jest.fn().mockResolvedValue({ type: "wifi" }) }));
jest.mock("../../lib/resumableUpload", () => ({ uploadResumable: jest.fn() }));

jest.mock("../../lib/supabase", () => ({
  supabase: {},
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_ANON_KEY: "anon",
}));

import { uploadFileXHR } from "../videoApi";

// Fake XHR whose send() fails the first N attempts the way a dropped socket does.
const installXHR = (failures) => {
  let attempt = 0;
  global.XMLHttpRequest = function () {
    this.upload = {};
    this.open = () => {};
    this.setRequestHeader = () => {};
    this.abort = () => {};
    this.send = () => {
      attempt += 1;
      setTimeout(() => {
        if (attempt <= failures) this.onerror();
        else { this.status = 200; this.onload(); }
      }, 0);
    };
  };
  return () => attempt;
};

describe("uploadFileXHR", () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ["setTimeout"] }));
  afterEach(() => jest.useRealTimers());

  it("retries a dropped connection and succeeds", async () => {
    const attempts = installXHR(2);
    await expect(uploadFileXHR("p", "file://v.mp4", "v.mp4", "video/mp4", "tok")).resolves.toBeUndefined();
    expect(attempts()).toBe(3);
  }, 20000);

  it("gives up after 3 attempts with a connection message", async () => {
    installXHR(99);
    await expect(uploadFileXHR("p", "file://v.mp4", "v.mp4", "video/mp4", "tok"))
      .rejects.toThrow(/connection dropped/);
  }, 20000);
});

import { storagePathFromPublicUrl } from "../videoApi";

describe("storagePathFromPublicUrl", () => {
  const base = "https://x.supabase.co/storage/v1/object/public";

  it("extracts the path after the bucket name", () => {
    expect(storagePathFromPublicUrl(`${base}/mentor-videos-thumbnail/abc/123_thumb.jpg`, "mentor-videos-thumbnail"))
      .toBe("abc/123_thumb.jpg");
  });

  it("strips a cache-busting query string", () => {
    expect(storagePathFromPublicUrl(`${base}/mentor-videos-thumbnail/a/b.jpg?t=99`, "mentor-videos-thumbnail"))
      .toBe("a/b.jpg");
  });

  it("decodes percent-encoded path segments", () => {
    expect(storagePathFromPublicUrl(`${base}/thumbs/a%20b/c.jpg`, "thumbs")).toBe("a b/c.jpg");
  });

  it("returns null for junk or a mismatched bucket", () => {
    expect(storagePathFromPublicUrl(null, "thumbs")).toBeNull();
    expect(storagePathFromPublicUrl(`${base}/other/a.jpg`, "thumbs")).toBeNull();
  });
});
