const mockRpc = jest.fn();
const mockEq = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ delete: mockDelete }));

jest.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    from: (...args) => mockFrom(...args),
  },
}));

import { blockApi } from "../blockApi";

describe("blockApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
    mockEq.mockResolvedValue({ error: null });
  });

  it("blocks through the RPC so the report is filed server-side", async () => {
    await blockApi.blockUser({
      blockedUserId: "target-id",
      reason: "harassment",
      details: "  kept sending abuse  ",
    });

    expect(mockRpc).toHaveBeenCalledWith("block_user", {
      p_blocked_id: "target-id",
      p_reason: "harassment",
      p_details: "kept sending abuse",
    });
  });

  it("defaults the reason and sends no empty details", async () => {
    await blockApi.blockUser({ blockedUserId: "target-id" });

    expect(mockRpc).toHaveBeenCalledWith("block_user", {
      p_blocked_id: "target-id",
      p_reason: "other",
      p_details: null,
    });
  });

  it("rejects a missing target without calling the server", async () => {
    await expect(blockApi.blockUser({ blockedUserId: "" })).rejects.toThrow(
      /missing/i
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("unblocks by deleting the viewer's own row", async () => {
    await blockApi.unblockUser("target-id");

    expect(mockFrom).toHaveBeenCalledWith("user_blocks");
    expect(mockEq).toHaveBeenCalledWith("blocked_id", "target-id");
  });
});
