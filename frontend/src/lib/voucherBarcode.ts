import bwipjs from 'bwip-js/node';

// Encode the permanent identifier so existing Vietnamese voucher codes also work.
export const voucherBarcodePayload = (id: string) => `BV:${id}`;
export async function makeVoucherBarcode(id: string) {
  const png = await bwipjs.toBuffer({ bcid: 'code128', text: voucherBarcodePayload(id), scale: 3, height: 18, paddingwidth: 12, paddingheight: 6, backgroundcolor: 'FFFFFF' });
  return `data:image/png;base64,${png.toString('base64')}`;
}
