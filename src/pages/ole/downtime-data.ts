export interface DtCode { code: string; label: string; }
export interface DtDept { dept: string; color: string; codes: DtCode[]; }
export interface DtLog {
  id: string; date: string; shift: string; dept: string; code: string;
  bay: string; dl: number; minutes: number; commentary: string;
}

export const DT_CATEGORIES: DtDept[] = [
  { dept: 'Manufacturing (MFG)', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', codes: [
    { code: '101', label: 'New Operator' }, { code: '102', label: 'Rework' },
    { code: '103', label: 'Yield Loss' }, { code: '104', label: '5S / LPA' },
    { code: '105', label: 'Operator Training / Meeting' }, { code: '106', label: 'First Article Inspection' },
    { code: '107', label: 'No Material From Previous Process' }, { code: '109', label: 'Absenteeism' },
    { code: '110', label: 'Change Over Time' }, { code: '111', label: 'SMT Line Consumables Change' },
  ]},
  { dept: 'Manufacturing Engineering (ME)', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', codes: [
    { code: '201', label: 'Equipment / Tool Down - Front End' }, { code: '202', label: 'No Tool / Defective Tool - Front End' },
    { code: '203', label: 'No / Wrong VA / WI - Front End' }, { code: '204', label: 'Preventive Maintenance' },
    { code: '205', label: 'MES Route / EPS Issue' },
  ]},
  { dept: 'Industrial Engineering (IE)', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', codes: [
    { code: '301', label: 'Equipment Down / Defective - Box Build' }, { code: '302', label: 'No Tool / Defective Tool - Box Build' },
    { code: '303', label: 'No / Wrong VA / WI - Front End' }, { code: '305', label: 'Preventive Maintenance - Box Build Line' },
    { code: '306', label: 'MES Route / EPS Issue' }, { code: '307', label: 'Wrong Cycletimes / Different Runrate' },
  ]},
  { dept: 'Test Engineering (TE)', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', codes: [
    { code: '401', label: 'Tester / Fixture Down' }, { code: '402', label: 'Preventive Maintenance Of Testers' },
    { code: '403', label: 'No Tester / Defective Or Test Fixture' }, { code: '404', label: 'Excess Debug WIP' },
  ]},
  { dept: 'Quality', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', codes: [
    { code: '501', label: 'Line Stop Due To High Defect / ESD Non Com' },
    { code: '502', label: 'Misunderstood Quality Specs' }, { code: '503', label: 'Quality Headcount Issue' },
  ]},
  { dept: 'Materials', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', codes: [
    { code: '601', label: 'No Plan' }, { code: '602', label: 'Delay In Material Issue' },
    { code: '603', label: 'Defective Raw Material' }, { code: '604', label: 'Inventory Count / Stock Take' },
    { code: '605', label: 'Wrong Kit Issue' }, { code: '606', label: 'Material Shortage' },
    { code: '607', label: 'Cycle Out / Cycle In' }, { code: '608', label: 'Planned Maintenance' },
    { code: '609', label: 'NPI / Controlled Build' }, { code: '610', label: 'High WIP / Trolley Shortage - Planning' },
    { code: '611', label: 'Unplanned Change-Over / Change In Plan' },
  ]},
  { dept: 'Facilities', color: 'bg-red-500/15 text-red-400 border-red-500/30', codes: [
    { code: '701', label: 'Power Failure / Utility Down' },
  ]},
  { dept: 'IT', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', codes: [
    { code: '801', label: 'Network Down' }, { code: '802', label: 'PC / Printer Down' },
    { code: '803', label: 'Customer Systems' },
  ]},
  { dept: 'Other / HR', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30', codes: [
    { code: '901', label: 'Bus Late / Canteen Issue' }, { code: '902', label: 'Less Headcount' },
    { code: '903', label: 'Evacuation' },
  ]},
];

export const MOCK_LOGS: DtLog[] = [
  { id: '1', date: '2026-04-22', shift: 'Shift A', dept: 'Manufacturing Engineering (ME)', code: '201 Equipment / Tool Down - Front End', bay: 'B-12', dl: 8, minutes: 45, commentary: 'SMT machine nozzle clogged. Replaced and validated.' },
  { id: '2', date: '2026-04-22', shift: 'Shift B', dept: 'Materials', code: '606 Material Shortage', bay: 'B-07', dl: 12, minutes: 90, commentary: 'Waiting for PCBs from warehouse. Expedited.' },
  { id: '3', date: '2026-04-21', shift: 'Shift A', dept: 'Test Engineering (TE)', code: '401 Tester / Fixture Down', bay: 'B-03', dl: 6, minutes: 120, commentary: 'ICT fixture pins bent. Maintenance replaced fixture.' },
  { id: '4', date: '2026-04-21', shift: 'Shift C', dept: 'Quality', code: '501 Line Stop Due To High Defect / ESD Non Com', bay: 'B-15', dl: 20, minutes: 60, commentary: 'High solder defect rate on Arista boards. Quality hold raised.' },
  { id: '5', date: '2026-04-20', shift: 'Shift A', dept: 'Manufacturing (MFG)', code: '102 Rework', bay: 'B-09', dl: 5, minutes: 30, commentary: 'Rework on misaligned connectors — 40 units.' },
  { id: '6', date: '2026-04-20', shift: 'Shift B', dept: 'IT', code: '801 Network Down', bay: '—', dl: 30, minutes: 25, commentary: 'Network switch failure in Block B. IT resolved.' },
  { id: '7', date: '2026-04-19', shift: 'Shift A', dept: 'Industrial Engineering (IE)', code: '307 Wrong Cycletimes / Different Runrate', bay: 'B-04', dl: 10, minutes: 50, commentary: 'Cycletime mismatch after model changeover. IE corrected.' },
  { id: '8', date: '2026-04-19', shift: 'Shift B', dept: 'Facilities', code: '701 Power Failure / Utility Down', bay: 'All', dl: 45, minutes: 35, commentary: 'Partial power trip in Block A. Facilities restored.' },
  { id: '9', date: '2026-04-18', shift: 'Shift C', dept: 'Materials', code: '603 Defective Raw Material', bay: 'B-11', dl: 8, minutes: 75, commentary: 'Wrong BGA version shipped. Returned to store.' },
  { id: '10', date: '2026-04-18', shift: 'Shift A', dept: 'Manufacturing (MFG)', code: '110 Change Over Time', bay: 'B-02', dl: 15, minutes: 40, commentary: 'Model changeover from Arista to Keysight build.' },
];

export const WEEKLY_DT = [
  { w: 'W13', events: 8, mins: 320 }, { w: 'W14', events: 11, mins: 480 },
  { w: 'W15', events: 7, mins: 275 }, { w: 'W16', events: 10, mins: 570 },
];
