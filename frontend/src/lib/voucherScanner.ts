import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, ChecksumException, DecodeHintType, FormatException, NotFoundException } from '@zxing/library';

export function createVoucherScanner() {
  // Prefer the new square QR vouchers while accepting previously shared barcodes.
  return new BrowserMultiFormatReader(new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]), { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 150 });
}

export async function readVoucherImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return (await createVoucherScanner().decodeFromImageUrl(url)).getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isUnreadableBarcodeFrame(error: unknown) {
  return error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException;
}
