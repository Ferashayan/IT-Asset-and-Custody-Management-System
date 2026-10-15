import QRCode from 'qrcode';

/** Generates a PNG data URL encoding the asset tag (scanned by the mobile app). */
export function generateAssetQr(assetTag: string): Promise<string> {
  return QRCode.toDataURL(assetTag, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
  });
}
