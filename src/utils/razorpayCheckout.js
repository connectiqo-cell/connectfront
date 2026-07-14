import { NativeModules, Platform } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';

/**
 * Opens Razorpay Standard Checkout with iOS-safe options.
 * Throws a clear error if the native module was never linked (common when
 * `pod install` was skipped after adding react-native-razorpay).
 */
export async function openRazorpayCheckout(options = {}) {
  const native = NativeModules.RNRazorpayCheckout;
  if (!native?.open) {
    throw new Error(
      Platform.OS === 'ios'
        ? 'Payments are not set up on this iOS build. Rebuild after running: cd ios && pod install'
        : 'Payment module is unavailable. Please reinstall the app.',
    );
  }

  const amount =
    options.amount == null ? options.amount : String(options.amount);

  const checkoutOptions = {
    ...options,
    amount,
    currency: options.currency || 'INR',
    theme: options.theme || { color: '#5eead4' },
  };

  // Prefer collect on iOS so UPI still works even if wallet apps aren't queried.
  // Intent apps still appear when LSApplicationQueriesSchemes is configured.
  if (Platform.OS === 'ios' && !checkoutOptions.upi) {
    checkoutOptions.upi = { flow: 'intent' };
  }

  try {
    return await RazorpayCheckout.open(checkoutOptions);
  } catch (err) {
    const code = err?.code;
    const description = err?.description || err?.message || '';
    if (
      code === 2 ||
      code === 'PAYMENT_CANCELLED' ||
      /cancel/i.test(String(description))
    ) {
      const cancelErr = new Error(description || 'Payment cancelled');
      cancelErr.code = 'PAYMENT_CANCELLED';
      cancelErr.description = description || 'Payment cancelled';
      throw cancelErr;
    }
    const failErr = new Error(description || 'Payment failed. Please try again.');
    failErr.code = code;
    failErr.description = description;
    throw failErr;
  }
}
