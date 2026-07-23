import {
  initConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
} from 'react-native-iap';

// Google Play Billing one-time products have a fixed price per product ID —
// there's no way to pass a dynamic per-mentor price at purchase time the way
// Razorpay orders can. So mentor unlock_price is constrained (see migration
// constrain_unlock_price_to_tiers) to this same discrete set, each mapped to
// its own pre-created Play Console product. UPDATE these IDs to match exactly
// what's entered in Play Console if you name them differently.
export const VIDEO_UNLOCK_PRICE_TIERS = [199, 299, 499, 799, 999];

export const VIDEO_UNLOCK_PRODUCT_IDS = {
  199: 'video_unlock_199',
  299: 'video_unlock_299',
  499: 'video_unlock_499',
  799: 'video_unlock_799',
  999: 'video_unlock_999',
};

/** Looks up the Play Console product ID for a mentor's current unlock_price. */
export function getPlayProductIdForPrice(price) {
  const productId = VIDEO_UNLOCK_PRODUCT_IDS[price];
  if (!productId) {
    throw new Error(`No Play Billing product configured for price ₹${price}`);
  }
  return productId;
}

let connected = false;

async function ensureConnected() {
  if (connected) return;
  await initConnection();
  connected = true;
}

/**
 * Opens the Play Billing purchase sheet for a one-time product and resolves
 * with the resulting Purchase once Google reports success.
 * Mirrors openRazorpayCheckout's promise-based contract.
 */
export async function purchaseAndroidProduct(productId) {
  await ensureConnected();

  // Populates the native SKU-details cache so requestPurchase has what it
  // needs to build the purchase request.
  await getProducts({ skus: [productId] });

  // Recover a purchase that was charged by Google but never consumed (app
  // crashed / network dropped between purchase success and finishAndroidPurchase).
  // Without this, Google blocks any new purchase of the same product with
  // "already owned" forever. Returning it here lets the caller re-run
  // verify + finish on it — verify is idempotent, so this is safe even if
  // it was already credited last time.
  const existing = await getAvailablePurchases();
  const stuck = existing.find(p => p.productId === productId);
  if (stuck) return stuck;

  return new Promise((resolve, reject) => {
    let settled = false;
    let updateSub;
    let errorSub;

    const cleanup = () => {
      updateSub?.remove();
      errorSub?.remove();
    };

    updateSub = purchaseUpdatedListener(purchase => {
      if (settled || purchase.productId !== productId) return;
      settled = true;
      cleanup();
      resolve(purchase);
    });

    errorSub = purchaseErrorListener(error => {
      if (settled) return;
      settled = true;
      cleanup();
      const code = error?.code;
      const message = error?.message || 'Purchase failed';
      const err = new Error(message);
      err.code = code === 'E_USER_CANCELLED' ? 'PAYMENT_CANCELLED' : code;
      reject(err);
    });

    requestPurchase({ skus: [productId] }).catch(err => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * Marks the purchase consumed on Google's side — required for a one-time
 * product to become purchasable again (our 30-day unlock is re-bought every
 * cycle, not auto-renewing). Call ONLY after the server has confirmed and
 * credited the purchase — if this runs before that and the app dies, the
 * purchase would be consumed with nothing granted.
 */
export async function finishAndroidPurchase(purchase) {
  await finishTransaction({ purchase, isConsumable: true });
}
