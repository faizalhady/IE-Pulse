/**
 * useVaNvaData.ts — VA/NVA data hooks.
 *
 * Mock-backed while ingestion is undecided. The component contract is already
 * the final one, so wiring the backend is a one-line swap per queryFn:
 *   GET  /api/va-nva/datasets           → useVaNvaDatasets
 *   GET  /api/va-nva/datasets/:id/rows  → useVaNvaRows
 *   POST /api/va-nva/upload  (multipart) → useVaNvaUpload
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { withMetricsAll } from '@/lib/va_nva/vanvaCalc';
import { NVA_TARGET } from '@/lib/va_nva/vanvaConstants';
import { MOCK_VA_NVA_DATASETS } from '@/pages/vanva/mockVaNvaData';
import type { VaNvaDataset, VaNvaMetrics } from '@/pages/vanva/types';

export const vaNvaKeys = {
  all: ['va-nva'] as const,
  datasets: () => [...vaNvaKeys.all, 'datasets'] as const,
  rows: (datasetId: string) => [...vaNvaKeys.all, 'rows', datasetId] as const,
};

/** Uploaded workbooks, newest first. */
export function useVaNvaDatasets() {
  return useQuery<VaNvaDataset[]>({
    queryKey: vaNvaKeys.datasets(),
    queryFn: async () => MOCK_VA_NVA_DATASETS,
    staleTime: 5 * 60_000,
  });
}

/**
 * Rows of the active (or named) dataset, with every workbook column derived
 * at `target`. Changing the target re-derives locally — no refetch.
 */
export function useVaNvaRows(target: number = NVA_TARGET, datasetId?: string) {
  const { data: datasets = [], ...rest } = useVaNvaDatasets();
  const dataset = datasetId
    ? datasets.find(d => d.id === datasetId)
    : datasets.find(d => d.active) ?? datasets[0];

  const rows: VaNvaMetrics[] = dataset ? withMetricsAll(dataset.rows, target) : [];
  return { ...rest, dataset, rows };
}

/**
 * Upload a workbook. Ingestion is not decided yet, so this only validates and
 * registers the file client-side — nothing is parsed and nothing is persisted.
 * Point it at the real endpoint when the ingest contract lands.
 */
export function useVaNvaUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, periodLabel, uploadedBy }: {
      file: File; periodLabel: string; uploadedBy: string;
    }) => {
      // ponytail: client-side stub until the ingest contract exists. Replace the
      // body with a multipart POST — the caller and the cache key stay the same.
      await new Promise(r => setTimeout(r, 600));
      return {
        id: `ds-${file.name}-${file.size}`,
        filename: file.name,
        periodLabel,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        rowCount: 0,
        active: false,
        rows: [],
      } satisfies VaNvaDataset;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: vaNvaKeys.datasets() }); },
  });
}
