const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockUpsert = jest.fn(() => ({ select: mockSelect }));
const mockFrom = jest.fn(() => ({ update: mockUpdate, upsert: mockUpsert }));
const mockUpload = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) },
  },
}));

jest.mock("../videoApi", () => ({ uploadFileXHR: (...args) => mockUpload(...args) }));

import { collabHubApi } from "../collabHubApi";

// RLS rejects any campaign_submissions write whose agreement_accepted_at is
// null, so these two paths must always carry a timestamp.
describe("campaign submission agreement timestamp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: { id: "sub-1" }, error: null });
    mockUpload.mockResolvedValue(undefined);
  });

  it("stamps an acceptance on upload", async () => {
    await collabHubApi.submitVideo({
      applicationId: "app-1",
      creatorId: "creator-1",
      fileUri: "file:///v.mp4",
      fileName: "v.mp4",
    });

    expect(mockFrom).toHaveBeenCalledWith("campaign_submissions");
    expect(mockUpsert.mock.calls[0][0].agreement_accepted_at).toBeTruthy();
  });

  it("carries an existing acceptance forward on retry", async () => {
    await collabHubApi.retryWatermark({
      id: "sub-1",
      agreement_accepted_at: "2026-11-01T00:00:00.000Z",
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ agreement_accepted_at: "2026-11-01T00:00:00.000Z" }),
    );
  });

  it("stamps a retry on a row from before the agreement existed", async () => {
    await collabHubApi.retryWatermark({ id: "sub-1", agreement_accepted_at: null });

    expect(mockUpdate.mock.calls[0][0].agreement_accepted_at).toBeTruthy();
  });
});
