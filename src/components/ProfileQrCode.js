import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import QRCode from 'qrcode';
import { BRAND_LOGO } from '../utils/brandLogo';

/**
 * Reliable View-matrix QR (works inside ViewShot / no SVG blank issues).
 * Matches web portal: ECL H, Connectiqo logo center, quiet zone for scanners.
 */
export default function ProfileQrCode({
  value,
  size = 200,
  color = '#000000',
  backgroundColor = '#ffffff',
  /** Outer white padding in px — scanners need quiet zone */
  quietZone = 12,
  /** Logo box as fraction of inner QR — web uses 36/200 ≈ 0.18 */
  logoRatio = 0.18,
  showLogo = true,
}) {
  const matrix = useMemo(() => {
    const text = String(value || '').trim();
    if (!text) return null;
    try {
      const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
      const n = qr.modules.size;
      const rows = [];
      for (let y = 0; y < n; y += 1) {
        const row = [];
        for (let x = 0; x < n; x += 1) {
          row.push(Boolean(qr.modules.get(y, x)));
        }
        rows.push(row);
      }

      // Clear center for logo (same idea as qrcode.react excavate)
      if (showLogo && logoRatio > 0) {
        // Slightly larger than logo so the mark sits on white, not modules
        const logoMods = Math.max(5, Math.round(n * logoRatio * 1.15));
        const start = Math.floor((n - logoMods) / 2);
        const end = start + logoMods;
        for (let y = start; y < end; y += 1) {
          for (let x = start; x < end; x += 1) {
            if (rows[y]) rows[y][x] = false;
          }
        }
      }

      return rows;
    } catch {
      return null;
    }
  }, [value, showLogo, logoRatio]);

  if (!matrix?.length || size <= 0) {
    return (
      <View
        style={[
          styles.placeholder,
          { width: size, height: size, backgroundColor },
        ]}
      />
    );
  }

  const moduleCount = matrix.length;
  const pad = Math.max(0, quietZone);
  const innerBudget = Math.max(moduleCount, size - pad * 2);
  // Integer cell size avoids hairline gaps that break camera scanners
  const cell = Math.max(1, Math.floor(innerBudget / moduleCount));
  const qrPx = cell * moduleCount;
  const total = qrPx + pad * 2;
  const logoPx = Math.max(16, Math.round(qrPx * logoRatio));

  return (
    <View
      collapsable={false}
      style={[
        styles.wrap,
        {
          width: total,
          height: total,
          padding: pad,
          backgroundColor,
        },
      ]}
    >
      <View
        collapsable={false}
        style={{ width: qrPx, height: qrPx, backgroundColor }}
      >
        {matrix.map((row, y) => (
          <View key={`r-${y}`} style={styles.row} collapsable={false}>
            {row.map((dark, x) => (
              <View
                // eslint-disable-next-line react/no-array-index-key
                key={`c-${y}-${x}`}
                collapsable={false}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: dark ? color : backgroundColor,
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {showLogo ? (
        <View
          pointerEvents="none"
          style={[
            styles.logoWrap,
            {
              width: logoPx,
              height: logoPx,
              borderRadius: 8,
              marginLeft: -logoPx / 2,
              marginTop: -logoPx / 2,
            },
          ]}
        >
          <Image
            source={BRAND_LOGO}
            style={{ width: logoPx - 6, height: logoPx - 6 }}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
