import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const moneyFormat = '#,##0.##';
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF302D28' } },
  left: { style: 'thin', color: { argb: 'FF302D28' } },
  bottom: { style: 'thin', color: { argb: 'FF302D28' } },
  right: { style: 'thin', color: { argb: 'FF302D28' } },
};

const parseDate = (value: unknown, end = false) => {
  const raw = String(value || '');
  if (!datePattern.test(raw)) return null;
  const parsed = new Date(`${raw}T${end ? '23:59:59.999' : '00:00:00'}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value);

const displayDate = (value: Date) => new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(value);

const displayMonth = (key: string) => {
  const [year, month] = key.split('-');
  return `Tháng ${Number(month)}/${year}`;
};

type Totals = { income: number; expense: number; count: number };
const addTotal = (map: Map<string, Totals>, currency: string, type: string, amount: number) => {
  const total = map.get(currency) || { income: 0, expense: 0, count: 0 };
  if (type === 'income') total.income += amount;
  else total.expense += amount;
  total.count += 1;
  map.set(currency, total);
};

const styleTitle = (row: ExcelJS.Row) => {
  row.height = 28;
  row.font = { bold: true, size: 18, color: { argb: 'FFDF5B2A' } };
  row.alignment = { vertical: 'middle' };
};

const styleHeader = (row: ExcelJS.Row, fill = 'FFFFC857') => {
  row.font = { bold: true, color: { argb: 'FF171513' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 24;
  row.eachCell(cell => { cell.border = thinBorder; });
};

const styleTotal = (row: ExcelJS.Row, fill: string) => {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  row.eachCell(cell => { cell.border = thinBorder; });
  row.getCell(7).numFmt = moneyFormat;
  row.getCell(8).numFmt = moneyFormat;
  row.getCell(9).numFmt = moneyFormat;
};

const safeFilename = (value: string) => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'so-chi-tieu';

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ detail: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const bookId = String(body?.bookId || '');
  const type = String(body?.type || 'all');
  const from = parseDate(body?.from);
  const to = parseDate(body?.to, true);
  const hasCategoryFilter = Array.isArray(body?.categoryIds);
  const categoryIds: string[] = hasCategoryFilter
    ? [...new Set<string>(body.categoryIds.map((id: unknown) => String(id)).filter(Boolean))]
    : [];

  if (!bookId || !['all', 'income', 'expense'].includes(type) || !from || !to || from > to) {
    return NextResponse.json({ detail: 'Bộ lọc xuất báo cáo không hợp lệ.' }, { status: 400 });
  }
  if (hasCategoryFilter && !categoryIds.length) {
    return NextResponse.json({ detail: 'Hãy chọn ít nhất một danh mục.' }, { status: 400 });
  }

  const book = await prisma.expenseBook.findFirst({
    where: { id: bookId, userId: user.id },
    select: { id: true, name: true },
  });
  if (!book) return NextResponse.json({ detail: 'Không tìm thấy sổ chi tiêu.' }, { status: 404 });

  if (hasCategoryFilter) {
    const validCategories = await prisma.financeCategory.count({
      where: { id: { in: categoryIds }, userId: user.id, ...(type === 'all' ? {} : { type }) },
    });
    if (validCategories !== categoryIds.length) {
      return NextResponse.json({ detail: 'Có danh mục không hợp lệ trong bộ lọc.' }, { status: 400 });
    }
  }

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      userId: user.id, bookId, transactionDate: { gte: from, lte: to },
      ...(type === 'all' ? {} : { type }),
      ...(hasCategoryFilter ? { categoryId: { in: categoryIds } } : {}),
    },
    include: { account: { select: { name: true } }, categoryRef: { select: { name: true } } },
    orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
  });
  if (!transactions.length) {
    return NextResponse.json({ detail: 'Không có giao dịch phù hợp với bộ lọc đã chọn.' }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Billy';
  workbook.created = new Date();
  workbook.modified = new Date();

  const selectedCategories = hasCategoryFilter
    ? await prisma.financeCategory.findMany({ where: { id: { in: categoryIds } }, select: { name: true } })
    : [];
  const typeLabel = type === 'income' ? 'Chỉ khoản thu' : type === 'expense' ? 'Chỉ khoản chi' : 'Khoản thu và khoản chi';
  const categoryLabel = hasCategoryFilter ? selectedCategories.map(item => item.name).sort().join(', ') : 'Tất cả danh mục';

  const summary = workbook.addWorksheet('Tổng hợp', { views: [{ state: 'frozen', ySplit: 7 }] });
  summary.columns = [
    { key: 'month', width: 18 }, { key: 'currency', width: 13 }, { key: 'income', width: 18 },
    { key: 'expense', width: 18 }, { key: 'net', width: 18 }, { key: 'count', width: 16 },
  ];
  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = 'BÁO CÁO THU CHI';
  styleTitle(summary.getRow(1));
  summary.addRow(['Sổ chi tiêu', book.name]);
  summary.addRow(['Khoảng thời gian', `${displayDate(from)} - ${displayDate(to)}`]);
  summary.addRow(['Loại giao dịch', typeLabel]);
  summary.addRow(['Danh mục', categoryLabel]);
  summary.addRow([]);
  styleHeader(summary.addRow(['Tháng', 'Tiền tệ', 'Tổng thu', 'Tổng chi', 'Chênh lệch', 'Số giao dịch']));

  const monthGroups = new Map<string, typeof transactions>();
  const overall = new Map<string, Totals>();
  transactions.forEach(item => {
    const month = dateKey(item.transactionDate).slice(0, 7);
    monthGroups.set(month, [...(monthGroups.get(month) || []), item]);
    addTotal(overall, item.currency, item.type, Number(item.amount));
  });
  monthGroups.forEach((items, month) => {
    const totals = new Map<string, Totals>();
    items.forEach(item => addTotal(totals, item.currency, item.type, Number(item.amount)));
    totals.forEach((total, currency) => {
      const row = summary.addRow([displayMonth(month), currency, total.income, total.expense, total.income - total.expense, total.count]);
      row.eachCell(cell => { cell.border = thinBorder; });
      [3, 4, 5].forEach(column => { row.getCell(column).numFmt = moneyFormat; });
    });
  });
  const totalStart = summary.rowCount + 1;
  overall.forEach((total, currency) => {
    const row = summary.addRow(['TỔNG TOÀN KỲ', currency, total.income, total.expense, total.income - total.expense, total.count]);
    row.font = { bold: true };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9F1D5' } };
    row.eachCell(cell => { cell.border = thinBorder; });
    [3, 4, 5].forEach(column => { row.getCell(column).numFmt = moneyFormat; });
  });
  summary.autoFilter = { from: { row: 7, column: 1 }, to: { row: Math.max(7, totalStart - 1), column: 6 } };

  monthGroups.forEach((items, month) => {
    const sheet = workbook.addWorksheet(month, { views: [{ state: 'frozen', ySplit: 3 }] });
    sheet.columns = [
      { width: 14 }, { width: 15 }, { width: 24 }, { width: 24 }, { width: 35 },
      { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 },
    ];
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = `${book.name.toUpperCase()} · ${displayMonth(month).toUpperCase()}`;
    styleTitle(sheet.getRow(1));
    sheet.addRow([]);
    const dayGroups = new Map<string, typeof transactions>();
    items.forEach(item => {
      const day = dateKey(item.transactionDate);
      dayGroups.set(day, [...(dayGroups.get(day) || []), item]);
    });
    const monthTotals = new Map<string, Totals>();
    dayGroups.forEach(dayItems => {
      const dayTitle = sheet.addRow([`NGÀY ${displayDate(dayItems[0].transactionDate)}`]);
      sheet.mergeCells(dayTitle.number, 1, dayTitle.number, 9);
      dayTitle.font = { bold: true, color: { argb: 'FF171513' } };
      dayTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE69A' } };
      dayTitle.height = 22;
      styleHeader(sheet.addRow(['Ngày', 'Loại', 'Danh mục', 'Tài khoản', 'Ghi chú', 'Tiền tệ', 'Thu', 'Chi', 'Dòng tiền']), 'FFFFD978');
      const dayTotals = new Map<string, Totals>();
      dayItems.forEach(item => {
        const amount = Number(item.amount);
        const income = item.type === 'income' ? amount : 0;
        const expense = item.type === 'expense' ? amount : 0;
        const row = sheet.addRow([
          displayDate(item.transactionDate), item.type === 'income' ? 'Khoản thu' : 'Khoản chi',
          item.categoryRef?.name || item.category, item.account.name, item.description || '', item.currency,
          income || null, expense || null, income - expense,
        ]);
        row.eachCell(cell => { cell.border = thinBorder; cell.alignment = { vertical: 'top', wrapText: true }; });
        [7, 8, 9].forEach(column => { row.getCell(column).numFmt = moneyFormat; });
        row.getCell(2).font = { bold: true, color: { argb: item.type === 'income' ? 'FF16733B' : 'FFB42318' } };
        addTotal(dayTotals, item.currency, item.type, amount);
        addTotal(monthTotals, item.currency, item.type, amount);
      });
      dayTotals.forEach((total, currency) => {
        styleTotal(sheet.addRow(['TỔNG NGÀY', '', '', '', '', currency, total.income, total.expense, total.income - total.expense]), 'FFF3E8BD');
      });
      sheet.addRow([]);
    });
    monthTotals.forEach((total, currency) => {
      const row = sheet.addRow(['TỔNG THÁNG', '', '', '', '', currency, total.income, total.expense, total.income - total.expense]);
      styleTotal(row, 'FFC9F1D5');
      row.height = 24;
    });
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `bao-cao-thu-chi-${safeFilename(book.name)}-${String(body.from)}-${String(body.to)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
