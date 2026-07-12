/**
 * Fee calculator for Connectiqo sessions.
 *
 * Breakdown:
 *   mentor_amount      = mentor's session rate (stored as price_per_hour)   (what mentor earns)
 *   platform_base_fee  = 5% of mentor_amount       (platform revenue)
 *   gst_on_fee         = 18% of platform_base_fee  (GST on the service fee)
 *   convenience_fee    = platform_base_fee + gst   (extra charged to learner)
 *   total_amount       = mentor_amount + convenience_fee
 */

export const DEFAULT_PLATFORM_FEE_PERCENT = 5;
export const DEFAULT_GST_PERCENT = 18;

/**
 * @param {number} pricePerHour - Mentor's per-session price in ₹ (e.g. 500)
 * @returns {{
 *   mentorAmount: number,
 *   platformBaseFee: number,
 *   gstOnFee: number,
 *   convenienceFee: number,
 *   totalAmount: number,
 *   totalAmountPaise: number,
 *   mentorAmountPaise: number,
 *   platformFeePaise: number,
 * }}
 */
export function calculateFees(pricePerHour, config = {}) {
  const platformFeePercent =
    Number(config.platformFeePercent ?? DEFAULT_PLATFORM_FEE_PERCENT) ||
    DEFAULT_PLATFORM_FEE_PERCENT;
  const gstPercent =
    Number(config.gstPercent ?? DEFAULT_GST_PERCENT) || DEFAULT_GST_PERCENT;

  const mentorAmount    = pricePerHour;
  const platformBaseFee = Math.round(mentorAmount * platformFeePercent / 100);
  const gstOnFee        = Math.round(platformBaseFee * gstPercent / 100);
  const convenienceFee  = platformBaseFee + gstOnFee;
  const totalAmount     = mentorAmount + convenienceFee;

  return {
    platformFeePercent,
    gstPercent,
    mentorAmount,
    platformBaseFee,
    gstOnFee,
    convenienceFee,
    totalAmount,
    totalAmountPaise:  totalAmount  * 100,
    mentorAmountPaise: mentorAmount * 100,
    platformFeePaise:  convenienceFee * 100,
  };
}
