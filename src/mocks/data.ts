import { Bay, DowntimeEntry, getStatusLevel, HourlyRecord, Machine, User, Workcell } from '@/types';

const MACHINE_NAMES = [
  'SMTT01', 'AOI TOP', 'UNDERFILL DISPENSING', 'FW DOWNLOAD',
  'DA1', 'DA2', 'DA3', 'DA4', 'WIREBOND', 'E TEST',
  'LASER DEPANELING 1', 'LENS ASY & TEST', 'Y CABLE ASY & TEST',
  'HOUSING ASY', 'POWER CHECK', 'DC COMBINE', 'SMSR TEST', 'HS TEST',
];

function generateHourlyData(): HourlyRecord[] {
  const hours: HourlyRecord[] = [];
  for (let i = 11; i >= 0; i--) {
    const h = new Date();
    h.setHours(h.getHours() - i);
    const plan = Math.floor(Math.random() * 20) + 30;
    const actual = Math.floor(plan * (0.5 + Math.random() * 0.6));
    hours.push({ hour: `${h.getHours()}:00`, plan, actual });
  }
  return hours;
}

function generateMachines(bayId: string): Machine[] {
  return MACHINE_NAMES.map((name, i) => {
    const uph = Math.floor(Math.random() * 100);
    return {
      id: `${bayId}-m${i}`,
      name,
      bayId,
      uph,
      status: getStatusLevel(uph),
      wipCount: Math.floor(Math.random() * 50),
      sparklineData: Array.from({ length: 12 }, () => Math.floor(Math.random() * 100)),
    };
  });
}

function generateDowntimeLog(): DowntimeEntry[] {
  return [
    { timestamp: '08:14', duration: '12m', reason: 'Feeder jam' },
    { timestamp: '10:32', duration: '5m', reason: 'Nozzle change' },
    { timestamp: '13:01', duration: '22m', reason: 'PCB misfeed' },
  ];
}

const operators = ['J. Santos', 'M. Rivera', 'K. Chen', 'A. Patel'];

export const bays: Bay[] = [
  { id: 'bay-211-top', name: 'Bay 211 AOI_TOP', workcellId: 'arista', plant: 'Plant 1', area: 'P1A', model: 'DR4 400G', productivity: 89.4, plan: 50, cumm: 35, delta: -15, status: getStatusLevel(89.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-211-top'), overallWip: 380, pendingWip: 42, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[0] },
  { id: 'bay-211-btm', name: 'Bay 211 AOI_BTM', workcellId: 'arista', plant: 'Plant 1', area: 'P1A', model: 'DR4 400G', productivity: 84.3, plan: 50, cumm: 33, delta: -17, status: getStatusLevel(84.3), hourlyData: generateHourlyData(), machines: generateMachines('bay-211-btm'), overallWip: 350, pendingWip: 38, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[1] },
  { id: 'bay-212-top', name: 'Bay 212 AOI_TOP', workcellId: 'keysight', plant: 'Plant 1', area: 'P1B', model: 'DR4 400G', productivity: 63.8, plan: 50, cumm: 25, delta: -25, status: getStatusLevel(63.8), hourlyData: generateHourlyData(), machines: generateMachines('bay-212-top'), overallWip: 290, pendingWip: 35, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[2] },
  { id: 'bay-212-bot', name: 'Bay 212 AOI_BOT', workcellId: 'keysight', plant: 'Plant 1', area: 'P1B', model: 'DR4 400G', productivity: 46.4, plan: 33, cumm: 12, delta: -21, status: getStatusLevel(46.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-212-bot'), overallWip: 180, pendingWip: 20, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[3] },
  { id: 'bay-213-bot', name: 'Bay 213 AOI_BOT', workcellId: 'aop', plant: 'Plant 2', area: 'P2A', model: 'DR4 400G', productivity: 85.1, plan: 33, cumm: 22, delta: -11, status: getStatusLevel(85.1), hourlyData: generateHourlyData(), machines: generateMachines('bay-213-bot'), overallWip: 120, pendingWip: 15, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[0] },
  { id: 'bay-213-top', name: 'Bay 213 AOI_TOP', workcellId: 'aop', plant: 'Plant 2', area: 'P2A', model: 'DR4 400G', productivity: 16.4, plan: 78, cumm: 10, delta: -68, status: getStatusLevel(16.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-213-top'), overallWip: 50, pendingWip: 8, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[1] },
  { id: 'bay-215-bot', name: 'Bay 215 AOI_BOT', workcellId: 'micron', plant: 'Batu Kawan', area: 'BKA', model: 'DR4 400G', productivity: 44.4, plan: 135, cumm: 47, delta: -88, status: getStatusLevel(44.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-215-bot'), overallWip: 30, pendingWip: 5, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[2] },
  { id: 'bay-215-top', name: 'Bay 215 AOI_TOP', workcellId: 'micron', plant: 'Batu Kawan', area: 'BKB', model: 'DR4 400G', productivity: 27.1, plan: 113, cumm: 24, delta: -89, status: getStatusLevel(27.1), hourlyData: generateHourlyData(), machines: generateMachines('bay-215-top'), overallWip: 22, pendingWip: 4, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[3] },
];

export const workcells: Workcell[] = [
  { id: 'arista', name: 'Arista', bayIds: ['bay-211-top', 'bay-211-btm'], status: getStatusLevel(86.85) },
  { id: 'keysight', name: 'Keysight', bayIds: ['bay-212-top', 'bay-212-bot'], status: getStatusLevel(55.1) },
  { id: 'aop', name: 'Aop', bayIds: ['bay-213-bot', 'bay-213-top'], status: getStatusLevel(50.75) },
  { id: 'micron', name: 'Micron', bayIds: ['bay-215-bot', 'bay-215-top'], status: getStatusLevel(35.75) },
];

// Plant → Area hierarchy
export const plants = [
  {
    id: 'plant-1', name: 'Plant 1',
    areas: [
      { id: 'P1A', name: 'P1A' },
      { id: 'P1B', name: 'P1B' },
      { id: 'P1C', name: 'P1C' },
    ],
  },
  {
    id: 'plant-2', name: 'Plant 2',
    areas: [
      { id: 'P2A', name: 'P2A' },
      { id: 'P2C', name: 'P2C' },
    ],
  },
  {
    id: 'batu-kawan', name: 'Batu Kawan',
    areas: [
      { id: 'BKA', name: 'BKA' },
      { id: 'BKB', name: 'BKB' },
    ],
  },
];

export const currentUser: User = {
  id: '4033375',
  name: 'Syed Faiz Alhady',
  role: 'engineer',
};
// ─── NEW API-ALIGNED DATA ─────────────────────────────────────────────────
// These mirror our real API response shapes.
// Pages migrate to these one at a time.

export const realWorkcells = [
  { customer_id: 68, workcell_name: 'ARISTANETWORKS', division_name: 'ARISTANETWORKS', display_name: 'ARISTANETWORKS / ARISTANETWORKS', active: 1 },
  { customer_id: 7, workcell_name: 'KEYSIGHT', division_name: 'KEYSIGHT', display_name: 'KEYSIGHT / KEYSIGHT', active: 1 },
  { customer_id: 118, workcell_name: 'MICRON SIG', division_name: 'MICRON SIG', display_name: 'MICRON SIG / MICRON SIG', active: 1 },
  { customer_id: 51, workcell_name: 'ADVANTEST', division_name: 'ADVANTEST', display_name: 'ADVANTEST / ADVANTEST', active: 1 },
];

export const realPlants = [
  { plant: 'P1', step_count: 55112 },
  { plant: 'P2', step_count: 10487 },
  { plant: 'P3', step_count: 6163 },
  { plant: 'P4', step_count: 3341 },
  { plant: 'BK', step_count: 10640 },
];

export const totalWip = 1422;
export const pendingWip = 167;
