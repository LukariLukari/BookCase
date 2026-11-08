import QRCode from 'qrcode';

// Encode the permanent identifier so existing Vietnamese voucher codes also work.
export const voucherBarcodePayload = (id: string) => `BV:${id}`;
export async function makeVoucherBarcode(id: string) {
  // Keep the existing payload and API field so saved vouchers and previously
  // distributed barcodes continue to resolve to the same voucher.
  return QRCode.toDataURL(voucherBarcodePayload(id), {
    width: 320,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}
