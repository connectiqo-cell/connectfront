const mockInvoke = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: (...args) => mockInvoke(...args),
    },
  },
}));

import { paymentApi } from "../paymentApi";

describe("paymentApi recording preference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("includes recording preference when creating an order", async () => {
    await paymentApi.createOrder({
      mentorId: "mentor-id",
      learnerId: "learner-id",
      slotId: "slot-id",
      message: "Career guidance",
      recordingRequested: false,
    });

    expect(mockInvoke).toHaveBeenCalledWith("create-razorpay-order", {
      body: {
        mentorId: "mentor-id",
        learnerId: "learner-id",
        slotId: "slot-id",
        slotIds: ["slot-id"],
        message: "Career guidance",
        recordingRequested: false,
      },
    });
  });

  it("includes recording preference when verifying and creating the booking", async () => {
    await paymentApi.verifyAndBook({
      razorpayOrderId: "order-id",
      razorpayPaymentId: "payment-id",
      razorpaySignature: "signature",
      mentorId: "mentor-id",
      learnerId: "learner-id",
      slotId: "slot-id",
      message: "Career guidance",
      recordingRequested: true,
    });

    expect(mockInvoke).toHaveBeenCalledWith("verify-razorpay-payment", {
      body: expect.objectContaining({
        recordingRequested: true,
        slotIds: ["slot-id"],
      }),
    });
  });

  it("forwards multiple slotIds for same-day multi booking", async () => {
    await paymentApi.createOrder({
      mentorId: "mentor-id",
      learnerId: "learner-id",
      slotIds: ["slot-a", "slot-b"],
      message: "Two sessions",
      recordingRequested: true,
    });

    expect(mockInvoke).toHaveBeenCalledWith("create-razorpay-order", {
      body: {
        mentorId: "mentor-id",
        learnerId: "learner-id",
        slotId: "slot-a",
        slotIds: ["slot-a", "slot-b"],
        message: "Two sessions",
        recordingRequested: true,
      },
    });
  });
});
