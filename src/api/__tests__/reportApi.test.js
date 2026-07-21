const mockInsert = jest.fn();
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
const mockGetUser = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    auth: { getUser: (...args) => mockGetUser(...args) },
    from: (...args) => mockFrom(...args),
  },
}));

import { reportApi } from "../reportApi";

describe("reportApi.submitUserReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "reporter-id" } },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("derives the reporter from the authenticated user", async () => {
    await reportApi.submitUserReport({
      reportedUserId: "target-id",
      reason: "spam_or_scam",
      details: "Suspicious payment request",
    });

    expect(mockFrom).toHaveBeenCalledWith("user_reports");
    expect(mockInsert).toHaveBeenCalledWith({
      reporter_id: "reporter-id",
      reported_user_id: "target-id",
      reason: "spam_or_scam",
      details: "Suspicious payment request",
      context_type: "profile",
      context_id: null,
    });
  });

  it("rejects attempts to report the signed-in user", async () => {
    await expect(
      reportApi.submitUserReport({
        reportedUserId: "reporter-id",
        reason: "other",
      })
    ).rejects.toThrow("You cannot report your own profile.");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects unsupported reasons before querying auth", async () => {
    await expect(
      reportApi.submitUserReport({
        reportedUserId: "target-id",
        reason: "unsupported",
      })
    ).rejects.toThrow("Select a valid report reason.");

    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns a clear message for a duplicate open report", async () => {
    mockInsert.mockResolvedValue({
      error: { code: "23505", message: "duplicate" },
    });

    await expect(
      reportApi.submitUserReport({
        reportedUserId: "target-id",
        reason: "harassment",
      })
    ).rejects.toThrow("You already have an open report for this user.");
  });
});
