import ExcelJS from 'exceljs';
import type { Report } from '@/app/business/BusinessClient';

export function createReportWorkbook(report: Report, ledgerName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Billy';
  workbook.title = `Báo cáo ${ledgerName}`;

  const addSheet = (name: string, headers: string[], rows: (string | number | Date)[][], moneyColumns: number[] = [], dateColumns: number[] = []) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 2 }] });
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell(1, 1).value = `Báo cáo: ${ledgerName}`;
    sheet.getRow(1).font = { bold: true, size: 16 };
    sheet.getRow(1).height = 30;
    sheet.addRow(headers);
    sheet.addRows(rows);
    sheet.getRow(2).font = { bold: true, color: { argb: 'FF171513' } };
    sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFAD32' } };
    sheet.getRow(2).height = 24;
    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: sheet.rowCount, column: headers.length } };
    headers.forEach((_, index) => {
      const column = sheet.getColumn(index + 1);
      column.width = index === 0 ? 32 : 24;
      column.alignment = { vertical: 'middle', wrapText: true };
      if (moneyColumns.includes(index + 1)) column.numFmt = '#,##0" đ";[Red]-#,##0" đ"';
      if (dateColumns.includes(index + 1)) column.numFmt = 'dd/mm/yyyy';
    });
    return sheet;
  };

  addSheet('Tổng quan', ['Chỉ tiêu', 'Giá trị', 'Đơn vị'], [
    ['Doanh thu', report.revenue, 'đ'],
    ['Doanh thu thuần', report.net_revenue, 'đ'],
    ['Tổng chi phí', report.capital_cost + report.shipping_cost + report.other_order_fee + report.operating_expense, 'đ'],
    ['Giá vốn', report.capital_cost, 'đ'],
    ['Ship thực trả', report.shipping_cost, 'đ'],
    ['Phí theo đơn', report.other_order_fee, 'đ'],
    ['Chi phí vận hành', report.operating_expense, 'đ'],
    ['Lợi nhuận gộp', report.gross_profit, 'đ'],
    ['Lợi nhuận ròng', report.net_profit, 'đ'],
    ['Lợi nhuận sau tồn', report.profit_after_inventory, 'đ'],
    ['Giá trị tồn', report.stock_value, 'đ'],
    ['Số đơn hàng', report.order_count, 'đơn'],
    ['Số món đã bán', report.sold_units, 'món'],
    ['Trung bình mỗi đơn', report.average_order_value, 'đ'],
    ['Số lượng tồn', report.stock_units, 'món'],
  ]).getColumn(2).numFmt = '#,##0;[Red]-#,##0';
  addSheet('Theo ngày', ['Ngày', 'Số đơn', 'Doanh thu', 'Lợi nhuận'], report.daily.map(day => [new Date(`${day.date}T00:00:00Z`), day.orders, day.revenue, day.profit]), [3, 4], [1]);
  addSheet('Sản phẩm', ['Sản phẩm', 'Số lượng bán', 'Doanh thu'], report.top_products.map(product => [product.name, product.quantity, product.revenue]), [3]);
  addSheet('Chi phí', ['Ngày', 'Loại chi phí', 'Số tiền', 'Ghi chú'], report.expenses.map(expense => [new Date(`${expense.spent_at.slice(0, 10)}T00:00:00Z`), expense.category, expense.amount, expense.note || '']), [3], [1]);
  return workbook;
}

export async function downloadReportExcel(report: Report, ledgerName: string) {
  const buffer = await createReportWorkbook(report, ledgerName).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `bao-cao-${ledgerName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim() || 'ban-hang'}.xlsx`;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
