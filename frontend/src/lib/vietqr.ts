import QRCode from 'qrcode';

export interface BankInfo {
  code: string;
  bin: string;
  name: string;
  shortName: string;
}

export const VIETNAM_BANKS: BankInfo[] = [
  { code: 'MB', bin: '970422', name: 'MBBank (Quân Đội)', shortName: 'MB Bank' },
  { code: 'VCB', bin: '970436', name: 'Vietcombank (Ngoại Thương)', shortName: 'Vietcombank' },
  { code: 'TCB', bin: '970407', name: 'Techcombank (Kỹ Thương)', shortName: 'Techcombank' },
  { code: 'ACB', bin: '970416', name: 'ACB (Á Châu)', shortName: 'ACB' },
  { code: 'VPB', bin: '970432', name: 'VPBank (Việt Nam Thịnh Vượng)', shortName: 'VPBank' },
  { code: 'BIDV', bin: '970418', name: 'BIDV (Đầu tư và Phát triển)', shortName: 'BIDV' },
  { code: 'ICB', bin: '970415', name: 'VietinBank (Công Thương)', shortName: 'VietinBank' },
  { code: 'TPB', bin: '970423', name: 'TPBank (Tiên Phong)', shortName: 'TPBank' },
  { code: 'VIB', bin: '970441', name: 'VIB (Quốc Tế)', shortName: 'VIB' },
  { code: 'STB', bin: '970403', name: 'Sacombank (Sài Gòn Thương Tín)', shortName: 'Sacombank' },
  { code: 'HDB', bin: '970437', name: 'HDBank (Phát triển TP.HCM)', shortName: 'HDBank' },
  { code: 'VBA', bin: '970405', name: 'Agribank (Nông nghiệp)', shortName: 'Agribank' },
  { code: 'OCB', bin: '970448', name: 'OCB (Phương Đông)', shortName: 'OCB' },
  { code: 'MSB', bin: '970426', name: 'MSB (Hàng Hải)', shortName: 'MSB' },
  { code: 'SHB', bin: '970443', name: 'SHB (Sài Gòn - Hà Nội)', shortName: 'SHB' },
  { code: 'LPB', bin: '970449', name: 'LPBank (Lộc Phát)', shortName: 'LPBank' },
  { code: 'SEAB', bin: '970440', name: 'SeABank (Đông Nam Á)', shortName: 'SeABank' },
  { code: 'TIMO', bin: '963388', name: 'Timo (Ngân hàng số)', shortName: 'Timo' },
  { code: 'CAKE', bin: '546034', name: 'Cake by VPBank', shortName: 'Cake' },
];

export function findBank(input?: string): BankInfo | undefined {
  if (!input) return undefined;
  const raw = input.trim();
  const normalized = raw.toLowerCase().replace(/[\s\-_]/g, '');
  return VIETNAM_BANKS.find(b => {
    const code = b.code.toLowerCase().replace(/[\s\-_]/g, '');
    const short = b.shortName.toLowerCase().replace(/[\s\-_]/g, '');
    const name = b.name.toLowerCase().replace(/[\s\-_]/g, '');
    return code === normalized || short === normalized || name.includes(normalized) || normalized.includes(code);
  });
}

export function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateVietQRPayload({
  bin,
  accountNumber,
  amount,
  memo,
}: {
  bin: string;
  accountNumber: string;
  amount?: number;
  memo?: string;
}): string {
  const f = (id: string, val: string) => `${id}${String(val.length).padStart(2, '0')}${val}`;
  const cleanAccount = accountNumber.replace(/\D/g, '');
  const sub38_01 = f('00', bin) + f('01', cleanAccount);
  const tag38 = f('00', 'A000000727') + f('01', sub38_01) + f('02', 'QRIBFTTA');

  let payload =
    f('00', '01') +
    f('01', amount && amount > 0 ? '12' : '11') +
    f('38', tag38) +
    f('53', '704');

  if (amount && amount > 0) {
    payload += f('54', String(Math.round(amount)));
  }
  payload += f('58', 'VN');

  if (memo && memo.trim()) {
    payload += f('62', f('08', memo.trim().slice(0, 25)));
  }

  payload += '6304';
  return payload + crc16ccitt(payload);
}

export async function generateBankQrDataUrl({
  bankCodeOrName,
  accountNumber,
  accountName,
  amount,
  memo,
  color = '#3E3630',
}: {
  bankCodeOrName?: string;
  accountNumber: string;
  accountName?: string;
  amount?: number;
  memo?: string;
  color?: string;
}): Promise<string> {
  const cleanAcc = (accountNumber || '').replace(/\D/g, '');
  if (!cleanAcc) {
    const text = [bankCodeOrName, accountName, memo].filter(Boolean).join(' ') || 'VIETQR';
    return QRCode.toDataURL(text, {
      color: { dark: color, light: '#FCF7DF' },
      margin: 2,
      width: 400,
      errorCorrectionLevel: 'M',
    });
  }

  const bank = findBank(bankCodeOrName);
  const bin = bank ? bank.bin : '970422'; // default MB if bank not specified

  const payload = generateVietQRPayload({
    bin,
    accountNumber: cleanAcc,
    amount,
    memo,
  });

  return QRCode.toDataURL(payload, {
    color: {
      dark: color,
      light: '#FCF7DF',
    },
    margin: 2,
    width: 400,
    errorCorrectionLevel: 'M',
  });
}

export async function renderBankQrToCanvas(
  targetCanvas: HTMLCanvasElement,
  {
    bankCodeOrName,
    accountNumber,
    accountName,
    amount,
    memo,
    color = '#3E3630',
    width = 300,
  }: {
    bankCodeOrName?: string;
    accountNumber: string;
    accountName?: string;
    amount?: number;
    memo?: string;
    color?: string;
    width?: number;
  }
) {
  const cleanAcc = (accountNumber || '').replace(/\D/g, '');
  const bank = findBank(bankCodeOrName);
  const bin = bank ? bank.bin : '970422';
  const payload = cleanAcc
    ? generateVietQRPayload({ bin, accountNumber: cleanAcc, amount, memo })
    : [bankCodeOrName, accountName, memo].filter(Boolean).join(' ') || 'VIETQR';

  await QRCode.toCanvas(targetCanvas, payload, {
    color: { dark: color, light: '#FCF7DF' },
    margin: 1,
    width,
    errorCorrectionLevel: 'M',
  });
}

export async function ensureMontserratLoaded() {
  if (typeof window === 'undefined') return;
  try {
    if (!document.getElementById('montserrat-canvas-loader')) {
      const link = document.createElement('link');
      link.id = 'montserrat-canvas-loader';
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900&display=swap';
      document.head.appendChild(link);
    }
    if (document.fonts) {
      await document.fonts.ready;
      await Promise.race([
        document.fonts.load('800 38px Montserrat'),
        new Promise(resolve => setTimeout(resolve, 600)),
      ]);
    }
  } catch {}
}
