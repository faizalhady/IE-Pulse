import { Bay, Machine, Workcell, User, getStatusLevel, HourlyRecord, DowntimeEntry } from '@/types';

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
  { id: 'bay-211-top', name: 'Bay 211 AOI_TOP', workcellId: 'gardena', model: 'DR4 400G', productivity: 89.4, plan: 50, cumm: 35, delta: -15, status: getStatusLevel(89.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-211-top'), overallWip: 380, pendingWip: 42, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[0] },
  { id: 'bay-211-btm', name: 'Bay 211 AOI_BTM', workcellId: 'gardena', model: 'DR4 400G', productivity: 84.3, plan: 50, cumm: 33, delta: -17, status: getStatusLevel(84.3), hourlyData: generateHourlyData(), machines: generateMachines('bay-211-btm'), overallWip: 350, pendingWip: 38, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[1] },
  { id: 'bay-212-top', name: 'Bay 212 AOI_TOP', workcellId: 'marin', model: 'DR4 400G', productivity: 63.8, plan: 50, cumm: 25, delta: -25, status: getStatusLevel(63.8), hourlyData: generateHourlyData(), machines: generateMachines('bay-212-top'), overallWip: 290, pendingWip: 35, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[2] },
  { id: 'bay-212-bot', name: 'Bay 212 AOI_BOT', workcellId: 'marin', model: 'DR4 400G', productivity: 46.4, plan: 33, cumm: 12, delta: -21, status: getStatusLevel(46.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-212-bot'), overallWip: 180, pendingWip: 20, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[3] },
  { id: 'bay-213-bot', name: 'Bay 213 AOI_BOT', workcellId: 'eldridge', model: 'DR4 400G', productivity: 85.1, plan: 33, cumm: 22, delta: -11, status: getStatusLevel(85.1), hourlyData: generateHourlyData(), machines: generateMachines('bay-213-bot'), overallWip: 120, pendingWip: 15, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[0] },
  { id: 'bay-213-top', name: 'Bay 213 AOI_TOP', workcellId: 'eldridge', model: 'DR4 400G', productivity: 16.4, plan: 78, cumm: 10, delta: -68, status: getStatusLevel(16.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-213-top'), overallWip: 50, pendingWip: 8, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[1] },
  { id: 'bay-215-bot', name: 'Bay 215 AOI_BOT', workcellId: 'woodpecker', model: 'DR4 400G', productivity: 44.4, plan: 135, cumm: 47, delta: -88, status: getStatusLevel(44.4), hourlyData: generateHourlyData(), machines: generateMachines('bay-215-bot'), overallWip: 30, pendingWip: 5, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[2] },
  { id: 'bay-215-top', name: 'Bay 215 AOI_TOP', workcellId: 'woodpecker', model: 'DR4 400G', productivity: 27.1, plan: 113, cumm: 24, delta: -89, status: getStatusLevel(27.1), hourlyData: generateHourlyData(), machines: generateMachines('bay-215-top'), overallWip: 22, pendingWip: 4, downtimeLog: generateDowntimeLog(), operatorOnDuty: operators[3] },
];

export const workcells: Workcell[] = [
  { id: 'gardena', name: 'Gardena', bayIds: ['bay-211-top', 'bay-211-btm'], status: getStatusLevel(86.85) },
  { id: 'marin', name: 'Marin', bayIds: ['bay-212-top', 'bay-212-bot'], status: getStatusLevel(55.1) },
  { id: 'eldridge', name: 'Eldridge', bayIds: ['bay-213-bot', 'bay-213-top'], status: getStatusLevel(50.75) },
  { id: 'woodpecker', name: 'Woodpecker', bayIds: ['bay-215-bot', 'bay-215-top'], status: getStatusLevel(35.75) },
];

export const currentUser: User = {
  id: 'u1',
  name: 'Alex Rivera',
  role: 'supervisor',
};

export const totalWip = 1422;
export const pendingWip = 167;
