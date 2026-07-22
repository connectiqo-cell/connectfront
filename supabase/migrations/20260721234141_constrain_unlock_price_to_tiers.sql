-- Snap the 4 mentors with non-tier prices to the nearest new tier (rounds up on ties,
-- favoring mentor earnings). The 44 mentors already at 299 are unaffected.
UPDATE mentor_profiles SET unlock_price = 199 WHERE unlock_price = 149;
UPDATE mentor_profiles SET unlock_price = 199 WHERE unlock_price = 200;
UPDATE mentor_profiles SET unlock_price = 299 WHERE unlock_price = 249;
UPDATE mentor_profiles SET unlock_price = 499 WHERE unlock_price = 399;

-- Google Play Billing one-time products require a fixed price per product ID,
-- so mentor-set unlock prices must come from a small discrete set that maps
-- 1:1 to pre-created Play Console products (video_unlock_199, _299, _499, _799, _999).
ALTER TABLE mentor_profiles
  ADD CONSTRAINT unlock_price_tier CHECK (unlock_price IN (199, 299, 499, 799, 999));
