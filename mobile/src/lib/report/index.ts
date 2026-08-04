import * as RNFS from '@dr.pogodin/react-native-fs';
import Share from 'react-native-share';
import type { Expense } from '../types';
import { buildReportData, type ReportOptions } from './data';

export type {
  ReportOptions,
  ReportPeriod,
  ReportSections,
  ReportSectionKey,
  ReportView,
  ReportData,
  Breakdown,
} from './data';

function sanitize(s: string): string {
  return (s || 'space').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'space';
}

// Remove any previously generated report files from the cache so they never
// accumulate. We keep only the file we're about to share (transient; the OS
// clears the cache on its own). Nothing ever leaves the device / touches a server.
async function purgeOldReports(): Promise<void> {
  try {
    const items = await RNFS.readDir(RNFS.CachesDirectoryPath);
    await Promise.all(
      items
        .filter(f => f.isFile() && /^Spendly_.*\.(pdf|xlsx)$/.test(f.name))
        .map(f => RNFS.unlink(f.path).catch(() => {})),
    );
  } catch {
    // Directory listing not critical — ignore.
  }
}

// Generate the report entirely on-device, write it to the app cache, and hand it
// to the OS share sheet (Save to Files / Drive / email / etc.). NOTHING is
// uploaded or persisted server-side — the cache file is transient.
export async function generateReport(
  expenses: Expense[],
  options: ReportOptions,
): Promise<{ filename: string; empty: boolean; shared: boolean }> {
  const data = buildReportData(expenses, options);
  const base = `Spendly_${sanitize(options.spaceName)}_${sanitize(data.periodLabel)}`;

  await purgeOldReports();

  let filename: string;
  let base64: string;
  let mime: string;

  if (options.format === 'pdf') {
    const { generatePdfBase64 } = await import('./pdf');
    base64 = await generatePdfBase64(data, options);
    filename = `${base}.pdf`;
    mime = 'application/pdf';
  } else {
    const { generateExcelBase64 } = await import('./excel');
    base64 = generateExcelBase64(data, options);
    filename = `${base}.xlsx`;
    mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  const path = `${RNFS.CachesDirectoryPath}/${filename}`;
  await RNFS.writeFile(path, base64, 'base64');

  let shared = true;
  try {
    const res = await Share.open({
      url: `file://${path}`,
      type: mime,
      filename,
      failOnCancel: false,
      // Store the temp file in internal storage cache (Android) — never public.
      useInternalStorage: true,
    });
    shared = res?.success !== false;
  } catch {
    // User dismissed the sheet, or no share target — the file still exists in
    // the cache (transient). Treat as a non-error; the modal reports "saved".
    shared = false;
  }
  // NOTE: we deliberately don't delete `path` here — some share targets read
  // the file lazily after the sheet closes. It's a transient cache file and the
  // next report run purges it via purgeOldReports().

  return { filename, empty: data.txnCount === 0, shared };
}
