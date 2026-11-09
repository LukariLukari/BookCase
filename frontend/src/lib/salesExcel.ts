import type { Order, Report } from '@/app/business/BusinessClient';
import { filteredSalesReport, filterSalesOrders, groupSalesOrders, orderChannel, saleChannelLabels, saleStatusLabels, salesDay, type SalesFilters } from './salesData';

export type SalesFormat = 'xlsx' | 'xls' | 'csv';
export type SalesSection = 'summary' | 'daily' | 'orders' | 'items' | 'products' | 'expenses';
export const salesSectionLabels: Record<SalesSection, string> = { summary: 'Tổng hợp', daily: 'Theo ngày', orders: 'Chi tiết đơn hàng', items: 'Chi tiết món trong đơn', products: 'Sản phẩm đã bán', expenses: 'Chi phí chung' };
type Cell = string | number | Date;
type ExportOptions = { orders: Order[]; report?: Report; filters: SalesFilters; sections: SalesSection[]; format: SalesFormat; ledgerName: string };
const paymentLabel = (value: string) => ({ paid: 'Đã thanh toán', pending: 'Chưa thanh toán', partial: 'Thanh toán một phần' }[value] || value);
const excelDate = (value: string) => new Date(`${salesDay(value)}T00:00:00Z`);

export function salesExportTables(options: ExportOptions) {
  const orders = filterSalesOrders(options.orders, options.filters);
  const active = orders.filter(order => order.status !== 'cancelled');
  const tables: { key: SalesSection; headers: string[]; rows: Cell[][]; money: number[]; dates: number[] }[] = [];
  const add = (key: SalesSection, headers: string[], rows: Cell[][], money: number[] = [], dates: number[] = []) => {
    if (options.sections.includes(key)) tables.push({ key, headers, rows, money, dates });
  };
  const report = options.report ? filteredSalesReport(options.orders, options.report, options.filters) : undefined;
  const fallbackReport = !options.orders.length && options.report ? options.report : undefined;
  const revenue = active.length ? active.reduce((total, order) => total + order.total, 0) : Number(fallbackReport?.revenue || 0);
  const profit = active.length ? active.reduce((total, order) => total + order.profit, 0) : Number(fallbackReport ? fallbackReport.net_profit + fallbackReport.operating_expense : 0);
  add('summary', ['Chỉ tiêu', 'Giá trị', 'Đơn vị'], [
    ['Sổ bán hàng', options.ledgerName, ''],
    ['Loại đơn', saleChannelLabels[options.filters.channel], ''],
    ['Từ ngày', options.filters.from || 'Toàn bộ', ''], ['Đến ngày', options.filters.to || 'Toàn bộ', ''],
    ['Trạng thái thanh toán', paymentLabel(options.filters.payment === 'all' ? 'Tất cả' : options.filters.payment), ''],
    ['Trạng thái đơn', saleStatusLabels[options.filters.status] || options.filters.status, ''],
    ['Số đơn (không gồm đơn hủy)', active.length || Number(fallbackReport?.order_count || 0), 'đơn'],
    ['Số món đã bán', active.length ? active.reduce((total, order) => total + order.item_count, 0) : (fallbackReport?.top_products?.reduce((sum, p) => sum + p.quantity, 0) || 0), 'món'],
    ['Doanh thu', revenue, 'đ'],
    ['Giá vốn', active.length ? active.reduce((total, order) => total + order.capital_cost, 0) : Number(fallbackReport?.capital_cost || 0), 'đ'],
    ['Ship thực trả', active.reduce((total, order) => total + order.shipping_cost, 0), 'đ'],
    ['Phí khác', active.reduce((total, order) => total + order.other_fee, 0), 'đ'],
    ['Lãi từ đơn', profit, 'đ'],
    ...(report ? [['Chi phí chung', report.operating_expense, 'đ'], ['Lợi nhuận ròng', fallbackReport ? fallbackReport.net_profit : report.net_profit, 'đ']] as Cell[][] : []),
  ]);
  const dailyRows: Cell[][] = active.length
    ? groupSalesOrders(active).flatMap(([day, rows]) =>
      (['pos', 'inventory', 'unknown'] as const).flatMap(channel => {
        const matching = rows.filter(order => orderChannel(order) === channel);
        return matching.length ? [[excelDate(day), saleChannelLabels[channel], matching.length, matching.reduce((total, order) => total + order.total, 0), matching.reduce((total, order) => total + order.profit, 0)]] : [];
      }))
    : (fallbackReport?.daily || []).map(d => [excelDate(d.date), 'Tất cả đơn', d.orders, d.revenue, d.profit]);
  add('daily', ['Ngày', 'Loại đơn', 'Số đơn', 'Doanh thu', 'Lãi từ đơn'], dailyRows, [4, 5], [1]);
  add('orders', ['Ngày', 'Mã đơn', 'Loại đơn', 'Nguồn phân loại', 'Khách hàng', 'Liên hệ', 'Sản phẩm', 'Số món', 'Tiền hàng', 'Ship thu khách', 'Giảm giá', 'Khách trả', 'Giá vốn', 'Ship thực trả', 'Phí khác', 'Lãi từ đơn', 'Thanh toán', 'Trạng thái đơn', 'Voucher', 'Ghi chú'], orders.map(order => [
    excelDate(order.ordered_at), order.code, saleChannelLabels[orderChannel(order)], order.sale_channel_inferred ? 'Nhận diện theo sản phẩm' : 'Lưu khi tạo đơn', order.customer_name, order.customer_contact || '',
    order.items.map(item => `${item.product_name} ×${item.quantity}`).join('; '), order.item_count, order.items.reduce((total, item) => total + item.quantity * item.unit_price, 0), order.shipping_fee, order.discount, order.total, order.capital_cost, order.shipping_cost, order.other_fee, order.profit, paymentLabel(order.payment_status), saleStatusLabels[order.status || 'confirmed'] || order.status || '', order.voucher_code || '', order.note || '',
  ]), [9, 10, 11, 12, 13, 14, 15, 16], [1]);
  add('items', ['Ngày', 'Mã đơn', 'Loại đơn', 'Khách hàng', 'Sản phẩm', 'Số lượng', 'Đơn giá', 'Giá vốn / món', 'Thành tiền', 'Ghi chú món', 'Trạng thái đơn'], orders.flatMap(order => order.items.map(item => [excelDate(order.ordered_at), order.code, saleChannelLabels[orderChannel(order)], order.customer_name, item.product_name, item.quantity, item.unit_price, item.unit_cost, item.quantity * item.unit_price, item.note || '', saleStatusLabels[order.status || 'confirmed'] || order.status || ''])), [7, 8, 9], [1]);
  const products = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of active) for (const item of order.items) {
    const previous = products.get(item.product_id) || { name: item.product_name, quantity: 0, revenue: 0 };
    previous.quantity += item.quantity; previous.revenue += item.quantity * item.unit_price;
    products.set(item.product_id, previous);
  }
  const productRows: Cell[][] = products.size
    ? [...products.values()].sort((a, b) => b.revenue - a.revenue).map(product => [product.name, product.quantity, product.revenue])
    : (fallbackReport?.top_products || []).map(p => [p.name, p.quantity, p.revenue]);
  add('products', ['Sản phẩm', 'Số lượng bán', 'Tiền hàng trước giảm giá'], productRows, [3]);
  if (report) add('expenses', ['Ngày', 'Loại chi phí', 'Số tiền', 'Ghi chú'], report.expenses.map(expense => [excelDate(expense.spent_at), expense.category, expense.amount, expense.note || '']), [3], [1]);
  return tables;
}

export async function createSalesExport(options: ExportOptions) {
  if (!options.sections.length) throw new Error('Chọn ít nhất một nội dung để xuất.');
  const tables = salesExportTables(options);
  if (!tables.length) throw new Error('Không có nội dung phù hợp để xuất.');
  if (options.format === 'csv' && tables.length !== 1) throw new Error('CSV chỉ xuất một nội dung mỗi lần.');
  if (options.format === 'xls' && tables.some(table => table.rows.length + 2 > 65536)) throw new Error('Dữ liệu vượt giới hạn của .xls. Hãy chọn .xlsx hoặc thu hẹp bộ lọc.');
  if (tables.some(table => table.rows.length + 2 > 1048576)) throw new Error('Quá nhiều dòng. Hãy thu hẹp khoảng ngày để xuất.');
  if (options.format === 'xlsx') {
    try {
      const excelModule = await import('exceljs');
      const ExcelJS = (excelModule as unknown as { default?: typeof excelModule }).default || excelModule;
      const book = new ExcelJS.Workbook();
      book.creator = 'Billy';
      for (const table of tables) {
        const sheet = book.addWorksheet(salesSectionLabels[table.key], { views: [{ state: 'frozen', ySplit: 2 }] });
        sheet.mergeCells(1, 1, 1, table.headers.length);
        sheet.getCell('A1').value = `Báo cáo: ${options.ledgerName}`;
        sheet.getRow(1).font = { bold: true, size: 16 };
        sheet.getRow(1).height = 30;
        sheet.addRow(table.headers); sheet.addRows(table.rows);
        sheet.getRow(2).font = { bold: true };
        sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFAD32' } };
        sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: sheet.rowCount, column: table.headers.length } };
        table.headers.forEach((_, index) => {
          const column = sheet.getColumn(index + 1);
          column.width = index === 0 ? 24 : 28;
          column.alignment = { vertical: 'middle', wrapText: true };
          if (table.money.includes(index + 1)) column.numFmt = '#,##0" đ";[Red]-#,##0" đ"';
          if (table.dates.includes(index + 1)) column.numFmt = 'dd/mm/yyyy';
          if (table.key === 'summary' && index === 1) column.numFmt = '#,##0;[Red]-#,##0';
        });
      }
      return { bytes: new Uint8Array(await book.xlsx.writeBuffer()), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    } catch {
      const xlsxMod = await import('xlsx');
      const XLSX = (xlsxMod as unknown as { default?: typeof xlsxMod }).default || xlsxMod;
      const book = XLSX.utils.book_new();
      for (const table of tables) {
        const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows], { dateNF: 'dd/mm/yyyy' });
        sheet['!cols'] = table.headers.map(() => ({ wch: 26 }));
        sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1' };
        XLSX.utils.book_append_sheet(book, sheet, salesSectionLabels[table.key]);
      }
      return { bytes: new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' })), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
  }
  const xlsxMod = await import('xlsx');
  const XLSX = (xlsxMod as unknown as { default?: typeof xlsxMod }).default || xlsxMod;
  const book = XLSX.utils.book_new();
  for (const table of tables) {
    const rows = options.format === 'csv' ? table.rows.map(row => row.map(value => value instanceof Date ? salesDay(value.toISOString()) : typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value)) : table.rows;
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...rows], { dateNF: 'dd/mm/yyyy' });
    sheet['!cols'] = table.headers.map(() => ({ wch: 28 }));
    sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1' };
    if (options.format === 'xls') table.rows.forEach((_, row) => table.money.forEach(column => {
      const cell = sheet[XLSX.utils.encode_cell({ r: row + 1, c: column - 1 })];
      if (cell) cell.z = '#,##0" đ";[Red]-#,##0" đ"';
    }));
    XLSX.utils.book_append_sheet(book, sheet, salesSectionLabels[table.key]);
  }
  if (options.format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]]);
    return { bytes: new TextEncoder().encode(`\ufeff${csv}`), mime: 'text/csv;charset=utf-8' };
  }
  return { bytes: new Uint8Array(XLSX.write(book, { bookType: 'biff8', type: 'array' })), mime: 'application/vnd.ms-excel' };
}

export async function downloadSalesExport(options: ExportOptions) {
  const result = await createSalesExport(options);
  const url = URL.createObjectURL(new Blob([result.bytes], { type: result.mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `bao-cao-${options.ledgerName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim() || 'ban-hang'}-${options.filters.from || 'tat-ca'}-${options.filters.to || 'hom-nay'}.${options.format}`;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
