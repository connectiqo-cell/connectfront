const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({
  update: mockUpdate,
  insert: mockInsert,
  upsert: mockUpsert,
  select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
}));
const mockUpload = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) },
  },
}));

jest.mock("../videoApi", () => ({ uploadFileXHR: (...args) => mockUpload(...args) }));

import { collabHubApi, fillAgreementClauses, needsAgreement } from "../collabHubApi";

const upload = existingSubmission =>
  collabHubApi.submitVideo({
    applicationId: "app-1",
    creatorId: "creator-1",
    fileUri: "file:///v.mp4",
    fileName: "v.mp4",
    existingSubmission,
  });

// Spec: consent once per application. First insert carries
// agreement_accepted_at; resubmissions leave it out so it carries forward.
describe("campaign submission agreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // update(...).eq(...) is awaited directly by retry, and chained to
    // .select().single() by a resubmission — support both.
    mockEq.mockImplementation(() => {
      const p = Promise.resolve({ error: null });
      p.select = mockSelect;
      return p;
    });
    mockSingle.mockResolvedValue({ data: { id: "sub-1" }, error: null });
    mockUpload.mockResolvedValue(undefined);
  });

  it("inserts the first submission with an acceptance timestamp", async () => {
    await upload(null);

    expect(mockFrom).toHaveBeenCalledWith("campaign_submissions");
    expect(mockInsert.mock.calls[0][0].agreement_accepted_at).toBeTruthy();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("resubmits with a plain update that leaves the acceptance out", async () => {
    await upload({ id: "sub-1", agreement_accepted_at: "2026-11-01T00:00:00.000Z" });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("agreement_accepted_at");
    expect(mockUpdate.mock.calls[0][0].status).toBe("processing");
    expect(mockEq).toHaveBeenCalledWith("id", "sub-1");
  });

  it("stamps a resubmission on a row from before the agreement existed", async () => {
    await upload({ id: "sub-1", agreement_accepted_at: null });

    expect(mockUpdate.mock.calls[0][0].agreement_accepted_at).toBeTruthy();
  });

  it("leaves the acceptance out on retry", async () => {
    await collabHubApi.retryWatermark({
      id: "sub-1",
      agreement_accepted_at: "2026-11-01T00:00:00.000Z",
    });

    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("agreement_accepted_at");
  });

  it("stamps a retry on a row from before the agreement existed", async () => {
    await collabHubApi.retryWatermark({ id: "sub-1", agreement_accepted_at: null });

    expect(mockUpdate.mock.calls[0][0].agreement_accepted_at).toBeTruthy();
  });

  it("asks for consent only when there is no acceptance yet", () => {
    expect(needsAgreement(null)).toBe(true);
    expect(needsAgreement({ agreement_accepted_at: null })).toBe(true);
    expect(needsAgreement({ agreement_accepted_at: "2026-11-01T00:00:00.000Z" })).toBe(false);
  });
});

describe("video usage agreement text", () => {
  beforeEach(() => jest.clearAllMocks());

  it("replaces every {{brand}}, not just the first", () => {
    const [clause] = fillAgreementClauses(
      ["{{brand}} owns it. {{brand}} may edit it."],
      "Acme",
    );
    expect(clause).toBe("Acme owns it. Acme may edit it.");
  });

  it("falls back to 'the brand' and drops empty clauses", () => {
    expect(fillAgreementClauses(["Owned by {{brand}}.", "", null], "  ")).toEqual([
      "Owned by the brand.",
    ]);
  });

  it("loads the shared legal_agreements row", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "creator_video_usage", version: 1, clauses: ["a"] },
      error: null,
    });

    const row = await collabHubApi.getVideoUsageAgreement();

    expect(mockFrom).toHaveBeenCalledWith("legal_agreements");
    expect(row.clauses).toEqual(["a"]);
  });

  it("refuses to continue without agreement text", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(collabHubApi.getVideoUsageAgreement()).rejects.toThrow(/agreement/i);
  });
});
