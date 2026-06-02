/**
 * ipkExport.ts — XLSX export for IPK results. Client-side only.
 *
 * Sheet 1 "IPK Summary"       — all summary columns; variance colored, totals bold.
 * Sheet 2 "Run Info"          — workcell / period / date / source / totals.
 * Sheet 3 "Calculation Detail"— per-group CT/UPH/IPK step inputs.
 *
 * Dynamic import of exceljs keeps it out of the main bundle (mirrors
 * cycleTimeExport.ts).
 */

import type { IPKSummaryRow } from '@/pages/ipk/mockIpkData';
import { totalRequired } from './ipkCalc';

const RED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } } as const;
const GREEN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } } as const;

interface ExportOpts {
  rows: IPKSummaryRow[];
  workcell: string;
  period: string;
  source: string;
}

export async function exportIPKResults({ rows, workcell, period, source }: ExportOpts): Promise<void> {
  if (!rows.length) {
    console.warn('exportIPKResults called with no rows');
    return;
  }

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IE Pulse';
  wb.created = new Date();

  // ── Sheet 1 — Summary ──
  const ws = wb.addWorksheet('IPK Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  const cols = [
    { header: 'Process Group',  key: 'processGroup',   width: 22 },
    { header: 'Loading Qty',    key: 'loadingQty',     width: 12 },
    { header: 'Eff. UPH',       key: 'effectiveUph',   width: 10 },
    { header: 'IPK Units',      key: 'ipkUnits',       width: 11 },
    { header: 'WIP+Buffer',     key: 'wipWithBuffer',  width: 12 },
    { header: 'IPK Trolleys',   key: 'ipkTrolleys',    width: 12 },
    { header: 'In/Out',         key: 'inOutTrolleys',  width: 9  },
    { header: 'Reject',         key: 'rejectTrolleys', width: 9  },
    { header: 'On-Hold',        key: 'onHoldTrolleys', width: 9  },
    { header: 'Total Required', key: 'totalRequired',  width: 14 },
    { header: 'On Floor',       key: 'actualOnFloor',  width: 10 },
    { header: 'Variance',       key: 'variance',       width: 10 },
  ];
  ws.columns = cols;

  const headerRow = ws.getRow(1);
  headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  const totals = { loadingQty: 0, ipkUnits: 0, wipWithBuffer: 0, ipkTrolleys: 0, inOutTrolleys: 0, rejectTrolleys: 0, onHoldTrolleys: 0, totalRequired: 0, actualOnFloor: 0, variance: 0 };

  for (const r of rows) {
    const req = totalRequired(r);
    const variance = req - r.actualOnFloor;
    const row = ws.addRow({ ...r, totalRequired: req, variance });
    row.font = { name: 'Calibri', size: 10 };
    row.getCell('totalRequired').font = { name: 'Calibri', size: 10, bold: true };
    const vCell = row.getCell('variance');
    vCell.font = { name: 'Calibri', size: 10, bold: true };
    vCell.fill = variance > 0 ? RED_FILL : GREEN_FILL;

    totals.loadingQty += r.loadingQty;
    totals.ipkUnits += r.ipkUnits;
    totals.wipWithBuffer += r.wipWithBuffer;
    totals.ipkTrolleys += r.ipkTrolleys;
    totals.inOutTrolleys += r.inOutTrolleys;
    totals.rejectTrolleys += r.rejectTrolleys;
    totals.onHoldTrolleys += r.onHoldTrolleys;
    totals.totalRequired += req;
    totals.actualOnFloor += r.actualOnFloor;
    totals.variance += variance;
  }

  const totalRow = ws.addRow({ processGroup: 'TOTAL', ...totals });
  totalRow.font = { name: 'Calibri', size: 10, bold: true };
  totalRow.eachCell(c => { c.border = { top: { style: 'thin' } }; });
  totalRow.getCell('variance').fill = totals.variance > 0 ? RED_FILL : GREEN_FILL;

  // ── Sheet 2 — Run Info ──
  const info = wb.addWorksheet('Run Info');
  info.columns = [{ key: 'k', width: 20 }, { key: 'v', width: 28 }];
  const infoRows: [string, string][] = [
    ['Workcell', workcell],
    ['Period', period],
    ['Date Generated', new Date().toISOString().slice(0, 10)],
    ['Source', source],
    ['Total Required', String(totals.totalRequired)],
    ['On Floor', String(totals.actualOnFloor)],
    ['Variance', String(totals.variance)],
  ];
  infoRows.forEach(([k, v]) => {
    const r = info.addRow({ k, v });
    r.getCell('k').font = { bold: true };
  });

  // ── Sheet 3 — Calculation Detail ──
  const detail = wb.addWorksheet('Calculation Detail');
  detail.columns = [
    { header: 'Process Group',   key: 'processGroup',     width: 22 },
    { header: 'CT (sec)',        key: 'bottleneckCtSec',  width: 10 },
    { header: 'FPY',             key: 'fpy',              width: 8  },
    { header: 'Efficiency',      key: 'efficiency',       width: 11 },
    { header: 'Conversion %',    key: 'conversionPct',    width: 13 },
    { header: 'Qty Equipment',   key: 'qtyEquipment',     width: 14 },
    { header: 'UPH Upstream',    key: 'uphUpstream',      width: 13 },
    { header: 'UPH Downstream',  key: 'uphDownstream',    width: 15 },
    { header: 'Eff. UPH',        key: 'effectiveUph',     width: 10 },
    { header: 'IPK Units',       key: 'ipkUnits',         width: 11 },
    { header: 'WIP+Buffer',      key: 'wipWithBuffer',    width: 12 },
    { header: 'Boards/Trolley',  key: 'boardsPerTrolley', width: 14 },
    { header: 'IPK Trolleys',    key: 'ipkTrolleys',      width: 12 },
  ];
  const dHeader = detail.getRow(1);
  dHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  rows.forEach(r => detail.addRow(r));

  // ── Write + download ──
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ipk_${workcell}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
