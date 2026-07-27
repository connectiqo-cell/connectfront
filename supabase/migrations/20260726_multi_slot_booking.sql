-- Multi-slot same-day checkout: one Razorpay order can cover several slots.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS slot_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN public.transactions.slot_ids IS
  'All availability slot IDs paid in this order. slot_id remains the first for FK/compat.';

-- Pending multi-slot orders must protect every selected slot from mentor deletes.
CREATE INDEX IF NOT EXISTS txn_slot_ids_gin_idx
  ON public.transactions USING GIN (slot_ids);
