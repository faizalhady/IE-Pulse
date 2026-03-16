import { bays, workcells } from '@/mocks/data';
import type { Bay, Workcell } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// In production these would hit real endpoints.
// For now they resolve mock data with a small delay to simulate network.

async function delay(ms = 150) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchBays(): Promise<Bay[]> {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/bays`);
    return res.json();
  }
  await delay();
  return bays;
}

export async function fetchBay(id: string): Promise<Bay | undefined> {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/bays/${id}`);
    return res.json();
  }
  await delay();
  return bays.find((b) => b.id === id);
}

export async function fetchWorkcells(): Promise<Workcell[]> {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/workcells`);
    return res.json();
  }
  await delay();
  return workcells;
}

export async function fetchWorkcell(id: string): Promise<Workcell | undefined> {
  if (BASE_URL) {
    const res = await fetch(`${BASE_URL}/workcells/${id}`);
    return res.json();
  }
  await delay();
  return workcells.find((w) => w.id === id);
}
