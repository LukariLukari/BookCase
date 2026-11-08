import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, ChecksumException, DecodeHintType, FormatException, NotFoundException } from '@zxing/library';

export function createVoucherScanner() {
  // Voucher images use Code 128. Search the whole frame, including rotated codes,
  // instead of spending time looking for unrelated 2D barcode formats.
  return new BrowserMultiFormatReader(new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]), { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 150 });
}

export function isUnreadableBarcodeFrame(error: unknown) {
  return error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException;
}
