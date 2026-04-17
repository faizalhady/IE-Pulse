// Auto-generated from Plant_1.pptx (new — with rotation correction)
// DO NOT EDIT manually

export type BayStatus = "occupied" | "reserve" | "special"

export interface BayDef {
  id: string
  area: string
  // label: string
  // bayName: string
  bayNumber: string
  customer: string
  description: string
  position: { left: number; top: number; width: number; height: number }
  status: BayStatus
}

export const ALL_BAYS: BayDef[] = [
  {
    "id": "p1a_000_aop-olfs",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "AOP",
    "description": "OLFS",
    "position": {
      "left": 53.43,
      "top": 3.83,
      "width": 25.76,
      "height": 8.26
    },
    "status": "occupied"
  },
  {
    "id": "p1a_001_danaher",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "DANAHER",
    "description": "",
    "position": {
      "left": 37.03,
      "top": 4.22,
      "width": 4.39,
      "height": 3.5
    },
    "status": "occupied"
  },
  {
    "id": "p1a_002_surplus",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Surplus",
    "position": {
      "left": 37.03,
      "top": 7.52,
      "width": 4.39,
      "height": 4.4
    },
    "status": "special"
  },
  {
    "id": "p1a_003_wabtec-chamber-room",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "WABTEC",
    "description": "chamber room",
    "position": {
      "left": 14.63,
      "top": 4.28,
      "width": 6.74,
      "height": 7.83
    },
    "status": "occupied"
  },
  {
    "id": "p1a_004_wabtec-chamber-room",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "WABTEC",
    "description": "chamber room",
    "position": {
      "left": 8.37,
      "top": 13.04,
      "width": 6.27,
      "height": 19.27
    },
    "status": "occupied"
  },
  {
    "id": "p1a_005_reserve-for-future-setup",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Reserve for Future Setup",
    "position": {
      "left": 8.37,
      "top": 32.31,
      "width": 6.27,
      "height": 17.62
    },
    "status": "reserve"
  },
  {
    "id": "p1a_006_hstd",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "",
    "description": "HSTD",
    "position": {
      "left": 86.97,
      "top": 39.16,
      "width": 8.65,
      "height": 3.55
    },
    "status": "special"
  },
  {
    "id": "p1a_007_lam",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "LAM",
    "description": "",
    "position": {
      "left": 87.05,
      "top": 58.69,
      "width": 6.4,
      "height": 3.73
    },
    "status": "occupied"
  },
  {
    "id": "p1a_008_bay-6-aop",
    "area": "P1A",
    "bayNumber": "BAY 6",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 35.5,
      "width": 68.16,
      "height": 3.74
    },
    "status": "occupied"
  },
  {
    "id": "p1a_009_bay-7a-imed",
    "area": "P1A",
    "bayNumber": "BAY 7A",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 48.19,
      "top": 39.76,
      "width": 36.45,
      "height": 4.67
    },
    "status": "occupied"
  },
  {
    "id": "p1a_010_bay-8a-imed",
    "area": "P1A",
    "bayNumber": "BAY 8A",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 49.42,
      "top": 45.03,
      "width": 35.3,
      "height": 3.67
    },
    "status": "occupied"
  },
  {
    "id": "p1a_011_bay-15a-aop",
    "area": "P1A",
    "bayNumber": "BAY 15A",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 49.37,
      "top": 74.25,
      "width": 35.3,
      "height": 3.16
    },
    "status": "occupied"
  },
  {
    "id": "p1a_012_bay-16a-aop",
    "area": "P1A",
    "bayNumber": "BAY 16A",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 49.34,
      "top": 78.15,
      "width": 35.44,
      "height": 3.16
    },
    "status": "occupied"
  },
  {
    "id": "p1a_013_bay-17a-reserve-for-future-s",
    "area": "P1A",
    "bayNumber": "BAY 17A",
    "customer": "",
    "description": "Reserve For Future Setup 3k SQFT",
    "position": {
      "left": 49.34,
      "top": 82.03,
      "width": 35.44,
      "height": 2.98
    },
    "status": "reserve"
  },
  {
    "id": "p1a_014_bay-18a-aop",
    "area": "P1A",
    "bayNumber": "BAY 18A",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 49.34,
      "top": 85.92,
      "width": 35.44,
      "height": 3.29
    },
    "status": "occupied"
  },
  {
    "id": "p1a_015_bay-19a-keysight",
    "area": "P1A",
    "bayNumber": "BAY 19A",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 49.34,
      "top": 89.66,
      "width": 35.44,
      "height": 3.96
    },
    "status": "occupied"
  },
  {
    "id": "p1a_016_bay-15b-aop",
    "area": "P1A",
    "bayNumber": "BAY 15B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 20.43,
      "top": 74.22,
      "width": 28.03,
      "height": 3.07
    },
    "status": "occupied"
  },
  {
    "id": "p1a_017_bay-16b-aop",
    "area": "P1A",
    "bayNumber": "BAY 16B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 31.24,
      "top": 78.14,
      "width": 17.22,
      "height": 3.31
    },
    "status": "occupied"
  },
  {
    "id": "p1a_018_bay-17b-aop",
    "area": "P1A",
    "bayNumber": "BAY 17B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 24.11,
      "top": 82.0,
      "width": 20.53,
      "height": 3.12
    },
    "status": "occupied"
  },
  {
    "id": "p1a_019_bay-18b-aop",
    "area": "P1A",
    "bayNumber": "BAY 18B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 24.11,
      "top": 85.95,
      "width": 24.42,
      "height": 3.57
    },
    "status": "occupied"
  },
  {
    "id": "p1a_020_bay-19b-keysight",
    "area": "P1A",
    "bayNumber": "BAY 19B",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 24.11,
      "top": 90.03,
      "width": 17.31,
      "height": 3.57
    },
    "status": "occupied"
  },
  {
    "id": "p1a_021_bay-13b-aop",
    "area": "P1A",
    "bayNumber": "BAY 13B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 11.47,
      "top": 66.67,
      "width": 29.79,
      "height": 3.28
    },
    "status": "occupied"
  },
  {
    "id": "p1a_022_bay-14b-danaher",
    "area": "P1A",
    "bayNumber": "BAY 14B",
    "customer": "DANAHER",
    "description": "",
    "position": {
      "left": 11.47,
      "top": 70.26,
      "width": 19.77,
      "height": 3.39
    },
    "status": "occupied"
  },
  {
    "id": "p1a_023_bay-13a-lam",
    "area": "P1A",
    "bayNumber": "BAY 13A",
    "customer": "LAM",
    "description": "",
    "position": {
      "left": 49.39,
      "top": 66.61,
      "width": 35.3,
      "height": 3.15
    },
    "status": "occupied"
  },
  {
    "id": "p1a_024_bay10a-lam",
    "area": "P1A",
    "bayNumber": "BAY 10A",
    "customer": "LAM",
    "description": "",
    "position": {
      "left": 49.42,
      "top": 53.07,
      "width": 11.45,
      "height": 4.14
    },
    "status": "occupied"
  },
  {
    "id": "p1a_025_bay-10a-lam",
    "area": "P1A",
    "bayNumber": "BAY 10A",
    "customer": "LAM",
    "description": "",
    "position": {
      "left": 72.19,
      "top": 53.08,
      "width": 12.46,
      "height": 4.15
    },
    "status": "occupied"
  },
  {
    "id": "p1a_026_bay-1oa-aop",
    "area": "P1A",
    "bayNumber": "BAY 1OA",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 60.96,
      "top": 53.11,
      "width": 11.19,
      "height": 4.1
    },
    "status": "occupied"
  },
  {
    "id": "p1a_027_bay-10b-aop",
    "area": "P1A",
    "bayNumber": "BAY 10B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 20.43,
      "top": 53.1,
      "width": 28.03,
      "height": 3.62
    },
    "status": "occupied"
  },
  {
    "id": "p1a_028_bay-8b-resmed",
    "area": "P1A",
    "bayNumber": "BAY 8B",
    "customer": "RESMED",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 46.31,
      "width": 16.99,
      "height": 3.39
    },
    "status": "occupied"
  },
  {
    "id": "p1a_029_bay-9b-medtronic",
    "area": "P1A",
    "bayNumber": "BAY 9B",
    "customer": "MEDTRONIC",
    "description": "",
    "position": {
      "left": 33.48,
      "top": 49.65,
      "width": 14.98,
      "height": 3.06
    },
    "status": "occupied"
  },
  {
    "id": "p1a_030_bay-12a-medtronic",
    "area": "P1A",
    "bayNumber": "BAY 12A",
    "customer": "MEDTRONIC",
    "description": "",
    "position": {
      "left": 49.53,
      "top": 62.42,
      "width": 35.25,
      "height": 3.56
    },
    "status": "occupied"
  },
  {
    "id": "p1a_031_bay-12b-aop",
    "area": "P1A",
    "bayNumber": "BAY 12B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 11.47,
      "top": 61.77,
      "width": 36.99,
      "height": 4.22
    },
    "status": "occupied"
  },
  {
    "id": "p1a_032_bay-5-aop",
    "area": "P1A",
    "bayNumber": "BAY 5",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 30.97,
      "width": 68.16,
      "height": 4.2
    },
    "status": "occupied"
  },
  {
    "id": "p1a_033_bay-7b-resmed",
    "area": "P1A",
    "bayNumber": "BAY 7B",
    "customer": "RESMED",
    "description": "",
    "position": {
      "left": 36.72,
      "top": 39.74,
      "width": 11.82,
      "height": 6.05
    },
    "status": "occupied"
  },
  {
    "id": "p1a_034_bay-7b-resmed",
    "area": "P1A",
    "bayNumber": "BAY 7B",
    "customer": "RESMED",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 39.74,
      "width": 8.63,
      "height": 6.02
    },
    "status": "occupied"
  },
  {
    "id": "p1a_035_bay-7b-imed",
    "area": "P1A",
    "bayNumber": "BAY 7B",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 25.16,
      "top": 39.79,
      "width": 11.56,
      "height": 5.98
    },
    "status": "occupied"
  },
  {
    "id": "p1a_036_bay-8b-imed",
    "area": "P1A",
    "bayNumber": "BAY 8B",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 33.39,
      "top": 46.35,
      "width": 15.07,
      "height": 3.3
    },
    "status": "occupied"
  },
  {
    "id": "p1a_037_imed",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 26.86,
      "top": 49.65,
      "width": 6.63,
      "height": 3.15
    },
    "status": "occupied"
  },
  {
    "id": "p1a_038_bay-9b-medtronic",
    "area": "P1A",
    "bayNumber": "BAY 9B",
    "customer": "MEDTRONIC",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 49.7,
      "width": 10.28,
      "height": 3.01
    },
    "status": "occupied"
  },
  {
    "id": "p1a_039_bay-9a-imed",
    "area": "P1A",
    "bayNumber": "BAY 9A",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 48.46,
      "top": 49.16,
      "width": 23.72,
      "height": 3.59
    },
    "status": "occupied"
  },
  {
    "id": "p1a_040_medtronic",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "MEDTRONIC",
    "description": "",
    "position": {
      "left": 79.19,
      "top": 49.16,
      "width": 5.46,
      "height": 3.3
    },
    "status": "occupied"
  },
  {
    "id": "p1a_041_resmed",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "RESMED",
    "description": "",
    "position": {
      "left": 72.15,
      "top": 49.16,
      "width": 7.09,
      "height": 3.3
    },
    "status": "occupied"
  },
  {
    "id": "p1a_042_tmo",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "TMO",
    "description": "",
    "position": {
      "left": 41.29,
      "top": 66.75,
      "width": 7.17,
      "height": 3.12
    },
    "status": "occupied"
  },
  {
    "id": "p1a_043_bay-16b-keysight",
    "area": "P1A",
    "bayNumber": "BAY 16B",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 11.47,
      "top": 78.14,
      "width": 12.17,
      "height": 3.4
    },
    "status": "occupied"
  },
  {
    "id": "p1a_044_bay-17b-keysight",
    "area": "P1A",
    "bayNumber": "BAY 17B",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 11.44,
      "top": 82.03,
      "width": 12.17,
      "height": 3.37
    },
    "status": "occupied"
  },
  {
    "id": "p1a_045_bay-18b-keysight",
    "area": "P1A",
    "bayNumber": "BAY 18B",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 11.42,
      "top": 85.95,
      "width": 12.17,
      "height": 3.57
    },
    "status": "occupied"
  },
  {
    "id": "p1a_046_bay-19b-keysight",
    "area": "P1A",
    "bayNumber": "BAY 19B",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 11.38,
      "top": 89.78,
      "width": 12.17,
      "height": 3.84
    },
    "status": "occupied"
  },
  {
    "id": "p1a_047_bay-14a-aop",
    "area": "P1A",
    "bayNumber": "BAY 14A",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 65.02,
      "top": 70.15,
      "width": 19.77,
      "height": 3.5
    },
    "status": "occupied"
  },
  {
    "id": "p1a_048_bay-14b-aop",
    "area": "P1A",
    "bayNumber": "BAY 14B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 31.26,
      "top": 70.36,
      "width": 17.2,
      "height": 3.28
    },
    "status": "occupied"
  },
  {
    "id": "p1a_049_bay-15b-keysight",
    "area": "P1A",
    "bayNumber": "BAY 15B",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 11.38,
      "top": 74.14,
      "width": 9.06,
      "height": 3.27
    },
    "status": "occupied"
  },
  {
    "id": "p1a_050_keysight",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 24.11,
      "top": 78.05,
      "width": 7.1,
      "height": 3.4
    },
    "status": "occupied"
  },
  {
    "id": "p1a_051_aop",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 41.41,
      "top": 90.03,
      "width": 7.17,
      "height": 3.5
    },
    "status": "occupied"
  },
  {
    "id": "p1a_052_bay-14a-reserve-for-future-s",
    "area": "P1A",
    "bayNumber": "BAY 14A",
    "customer": "",
    "description": "Reserve For Future Setup 1.3k SQFT",
    "position": {
      "left": 49.34,
      "top": 70.1,
      "width": 15.68,
      "height": 3.54
    },
    "status": "reserve"
  },
  {
    "id": "p1a_053_medical-ofls",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "MEDICAL",
    "description": "OFLS",
    "position": {
      "left": 90.25,
      "top": 90.09,
      "width": 7.17,
      "height": 9.91
    },
    "status": "special"
  },
  {
    "id": "p1a_054_bay-3b-resmed",
    "area": "P1A",
    "bayNumber": "BAY 3B",
    "customer": "RESMED",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 22.21,
      "width": 14.72,
      "height": 3.73
    },
    "status": "occupied"
  },
  {
    "id": "p1a_055_bay-4b-resmed",
    "area": "P1A",
    "bayNumber": "BAY 4B",
    "customer": "RESMED",
    "description": "",
    "position": {
      "left": 16.53,
      "top": 26.55,
      "width": 31.93,
      "height": 3.91
    },
    "status": "occupied"
  },
  {
    "id": "p1a_056_bay-1b-cohu",
    "area": "P1A",
    "bayNumber": "BAY 1B",
    "customer": "COHU",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 13.57,
      "width": 32.04,
      "height": 3.74
    },
    "status": "occupied"
  },
  {
    "id": "p1a_057_bay-2b-cohu",
    "area": "P1A",
    "bayNumber": "BAY 2B",
    "customer": "COHU",
    "description": "",
    "position": {
      "left": 16.49,
      "top": 17.89,
      "width": 32.04,
      "height": 3.75
    },
    "status": "occupied"
  },
  {
    "id": "p1a_058_bay-1a-cohu",
    "area": "P1A",
    "bayNumber": "BAY 1A",
    "customer": "COHU",
    "description": "",
    "position": {
      "left": 49.34,
      "top": 13.54,
      "width": 35.33,
      "height": 3.81
    },
    "status": "occupied"
  },
  {
    "id": "p1a_059_bay-2a-reserve-for-future-se",
    "area": "P1A",
    "bayNumber": "BAY 2A",
    "customer": "",
    "description": "Reserve for Future Setup 3k SQFT",
    "position": {
      "left": 49.34,
      "top": 17.95,
      "width": 35.33,
      "height": 3.64
    },
    "status": "reserve"
  },
  {
    "id": "p1a_060_bay-3a-reserve-for-future-se",
    "area": "P1A",
    "bayNumber": "BAY 3A",
    "customer": "",
    "description": "Reserve For Future Setup 3k SQFT",
    "position": {
      "left": 49.34,
      "top": 22.18,
      "width": 35.33,
      "height": 3.73
    },
    "status": "reserve"
  },
  {
    "id": "p1a_061_bay-4a-imed",
    "area": "P1A",
    "bayNumber": "BAY 4A",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 48.46,
      "top": 26.58,
      "width": 36.21,
      "height": 3.92
    },
    "status": "occupied"
  },
  {
    "id": "p1a_062_bay",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "",
    "description": "BAY",
    "position": {
      "left": 83.34,
      "top": 9.82,
      "width": 6.27,
      "height": 3.59
    },
    "status": "occupied"
  },
  {
    "id": "p1a_063_bay-11b-masimo",
    "area": "P1A",
    "bayNumber": "BAY 11B",
    "customer": "MASIMO",
    "description": "",
    "position": {
      "left": 17.63,
      "top": 57.32,
      "width": 30.83,
      "height": 4.37
    },
    "status": "occupied"
  },
  {
    "id": "p1a_064_bay-11a-aop",
    "area": "P1A",
    "bayNumber": "BAY 11A",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 69.1,
      "top": 57.35,
      "width": 15.72,
      "height": 4.73
    },
    "status": "occupied"
  },
  {
    "id": "p1a_065_imed",
    "area": "P1A",
    "bayNumber": "BAY",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 11.47,
      "top": 57.29,
      "width": 6.17,
      "height": 4.4
    },
    "status": "occupied"
  },
  {
    "id": "p1a_066_bay-11b-aop",
    "area": "P1A",
    "bayNumber": "BAY 11B",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 38.28,
      "top": 57.4,
      "width": 10.18,
      "height": 4.25
    },
    "status": "occupied"
  },
  {
    "id": "p1a_067_bay-11a-aop",
    "area": "P1A",
    "bayNumber": "BAY 11A",
    "customer": "AOP",
    "description": "",
    "position": {
      "left": 49.49,
      "top": 57.32,
      "width": 7.7,
      "height": 4.76
    },
    "status": "occupied"
  },
  {
    "id": "p1a_068_bay-11a-imed",
    "area": "P1A",
    "bayNumber": "BAY 11A",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 57.18,
      "top": 57.32,
      "width": 11.93,
      "height": 4.75
    },
    "status": "occupied"
  },
  {
    "id": "p1a_069_bay-3b-imed",
    "area": "P1A",
    "bayNumber": "BAY 3B",
    "customer": "IMED",
    "description": "",
    "position": {
      "left": 31.21,
      "top": 22.19,
      "width": 17.32,
      "height": 3.74
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_070_bay-2-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY 2",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 16.2,
      "top": 23.06,
      "width": 78.59,
      "height": 8.68
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_071_bay-1-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY 1",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 16.2,
      "top": 11.07,
      "width": 78.59,
      "height": 11.22
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_072_cell-1-keysight-plwn",
    "area": "P1B-G",
    "bayNumber": "BAY 1",
    "customer": "KEYSIGHT",
    "description": "PLWN",
    "position": {
      "left": 23.07,
      "top": 33.25,
      "width": 15.54,
      "height": 27.01
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_073_cell-2-keysight-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY 2",
    "customer": "KEYSIGHT",
    "description": "PLSP",
    "position": {
      "left": 39.12,
      "top": 33.3,
      "width": 15.19,
      "height": 26.85
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_074_cell-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "KEYSIGHT",
    "description": "Cell",
    "position": {
      "left": 12.05,
      "top": 33.83,
      "width": 9.19,
      "height": 16.17
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_075_cell-4-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY 4",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 24.47,
      "top": 61.82,
      "width": 15.19,
      "height": 26.04
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_076_cell-5b-keysight-opd",
    "area": "P1B-G",
    "bayNumber": "BAY 5B",
    "customer": "KEYSIGHT",
    "description": "OPD",
    "position": {
      "left": 41.21,
      "top": 61.82,
      "width": 5.27,
      "height": 14.96
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_077_cell-7b-keysight-opd",
    "area": "P1B-G",
    "bayNumber": "BAY 7B",
    "customer": "KEYSIGHT",
    "description": "OPD",
    "position": {
      "left": 77.05,
      "top": 62.06,
      "width": 11.95,
      "height": 26.04
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_078_cell-7c-keysight-ctec",
    "area": "P1B-G",
    "bayNumber": "BAY 7C",
    "customer": "KEYSIGHT",
    "description": "CTEC",
    "position": {
      "left": 89.23,
      "top": 62.06,
      "width": 4.36,
      "height": 26.04
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_079_cell-3b-keysight-pl1h",
    "area": "P1B-G",
    "bayNumber": "BAY 3B",
    "customer": "KEYSIGHT",
    "description": "PL1H",
    "position": {
      "left": 61.2,
      "top": 33.49,
      "width": 5.9,
      "height": 26.85
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_080_cell-3a-keysight-plwn-dpt-la",
    "area": "P1B-G",
    "bayNumber": "BAY 3A",
    "customer": "KEYSIGHT",
    "description": "PLWN DPT-LAPA",
    "position": {
      "left": 55.4,
      "top": 33.52,
      "width": 5.61,
      "height": 26.85
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_081_cell-3c-keysight-plwn-dpt-la",
    "area": "P1B-G",
    "bayNumber": "BAY 3C",
    "customer": "KEYSIGHT",
    "description": "PLWN DPT-LAPA",
    "position": {
      "left": 66.91,
      "top": 33.48,
      "width": 10.14,
      "height": 26.85
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_082_cell-3d-keysight-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY 3D",
    "customer": "KEYSIGHT",
    "description": "PLSP",
    "position": {
      "left": 77.05,
      "top": 33.46,
      "width": 3.49,
      "height": 26.94
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_083_cell-3g-keysight-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY 3G",
    "customer": "KEYSIGHT",
    "description": "PLSP",
    "position": {
      "left": 87.69,
      "top": 33.52,
      "width": 5.9,
      "height": 9.29
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_084_cell-3e-keysight-nas-ams",
    "area": "P1B-G",
    "bayNumber": "BAY 3E",
    "customer": "KEYSIGHT",
    "description": "NAS AMS",
    "position": {
      "left": 80.55,
      "top": 33.52,
      "width": 7.14,
      "height": 26.83
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_085_cell-3f-keysight-ctec",
    "area": "P1B-G",
    "bayNumber": "BAY 3F",
    "customer": "KEYSIGHT",
    "description": "CTEC",
    "position": {
      "left": 87.76,
      "top": 42.81,
      "width": 5.83,
      "height": 17.59
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_086_cell-5a-keysight-ctec",
    "area": "P1B-G",
    "bayNumber": "BAY 5A",
    "customer": "KEYSIGHT",
    "description": "CTEC",
    "position": {
      "left": 41.21,
      "top": 76.78,
      "width": 5.27,
      "height": 11.08
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_087_cell-5c-keysight-plwn",
    "area": "P1B-G",
    "bayNumber": "BAY 5C",
    "customer": "KEYSIGHT",
    "description": "PLWN",
    "position": {
      "left": 46.32,
      "top": 62.04,
      "width": 5.27,
      "height": 25.8
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_088_cell-5e-keysight-pl1h",
    "area": "P1B-G",
    "bayNumber": "BAY 5E",
    "customer": "KEYSIGHT",
    "description": "PL1H",
    "position": {
      "left": 55.48,
      "top": 62.06,
      "width": 3.34,
      "height": 25.8
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_089_cell-5d-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY 5D",
    "customer": "KEYSIGHT",
    "description": "",
    "position": {
      "left": 51.59,
      "top": 61.93,
      "width": 3.83,
      "height": 25.8
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_090_cell-6-keysight-pl1h",
    "area": "P1B-G",
    "bayNumber": "BAY 6",
    "customer": "KEYSIGHT",
    "description": "PL1H",
    "position": {
      "left": 58.87,
      "top": 62.06,
      "width": 8.23,
      "height": 25.8
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_091_cell-7a-keysight-pl1h",
    "area": "P1B-G",
    "bayNumber": "BAY 7A",
    "customer": "KEYSIGHT",
    "description": "PL1H",
    "position": {
      "left": 67.1,
      "top": 62.06,
      "width": 10.14,
      "height": 25.8
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_092_cell-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "KEYSIGHT",
    "description": "Cell",
    "position": {
      "left": 8.03,
      "top": 1.31,
      "width": 6.53,
      "height": 29.83
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_093_cell-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "KEYSIGHT",
    "description": "Cell",
    "position": {
      "left": 0.43,
      "top": 9.41,
      "width": 6.53,
      "height": 25.29
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_094_cell-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "KEYSIGHT",
    "description": "Cell",
    "position": {
      "left": 25.12,
      "top": 88.1,
      "width": 6.97,
      "height": 4.77
    },
    "status": "occupied"
  },
  {
    "id": "p1b_g_095_cag-e-1-aging-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Cag e 1 Aging PLSP",
    "position": {
      "left": 95.7,
      "top": 22.76,
      "width": 3.49,
      "height": 11.64
    },
    "status": "special"
  },
  {
    "id": "p1b_g_096_fa-lab",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "",
    "description": "FA Lab",
    "position": {
      "left": 95.63,
      "top": 87.05,
      "width": 3.49,
      "height": 4.96
    },
    "status": "special"
  },
  {
    "id": "p1b_g_097_cag-e-3-aging-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Cag e 3 Aging PLSP",
    "position": {
      "left": 95.59,
      "top": 40.83,
      "width": 3.37,
      "height": 7.76
    },
    "status": "special"
  },
  {
    "id": "p1b_g_098_cag-e-2-aging-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Cag e 2 Aging PLSP",
    "position": {
      "left": 95.57,
      "top": 34.4,
      "width": 3.37,
      "height": 7.76
    },
    "status": "special"
  },
  {
    "id": "p1b_g_099_cag-e-4-aging-plsp",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Cag e 4 Aging PLSP",
    "position": {
      "left": 95.71,
      "top": 78.44,
      "width": 3.37,
      "height": 7.76
    },
    "status": "special"
  },
  {
    "id": "p1b_g_100_cell-keysight",
    "area": "P1B-G",
    "bayNumber": "BAY",
    "customer": "KEYSIGHT",
    "description": "Cell",
    "position": {
      "left": 77.05,
      "top": 90.03,
      "width": 14.95,
      "height": 3.49
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_101_bay-1a-danaher",
    "area": "P1B-L2",
    "bayNumber": "BAY 1A",
    "customer": "DANAHER",
    "description": "",
    "position": {
      "left": 45.91,
      "top": 82.95,
      "width": 35.84,
      "height": 4.02
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_102_bay-6-reserve-for-future-set",
    "area": "P1B-L2",
    "bayNumber": "BAY 6",
    "customer": "",
    "description": "Reserve for Future Setup 3.9k SQFT",
    "position": {
      "left": 7.98,
      "top": 53.3,
      "width": 73.72,
      "height": 5.96
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l2_103_bay-5-wabtec",
    "area": "P1B-L2",
    "bayNumber": "BAY 5",
    "customer": "WABTEC",
    "description": "",
    "position": {
      "left": 7.98,
      "top": 60.15,
      "width": 73.77,
      "height": 3.98
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_104_bay-4b-wabtec",
    "area": "P1B-L2",
    "bayNumber": "BAY 4B",
    "customer": "WABTEC",
    "description": "",
    "position": {
      "left": 7.98,
      "top": 65.27,
      "width": 33.05,
      "height": 4.3
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_105_bay-1b-collins",
    "area": "P1B-L2",
    "bayNumber": "BAY 1B",
    "customer": "COLLINS",
    "description": "",
    "position": {
      "left": 8.2,
      "top": 82.47,
      "width": 32.83,
      "height": 4.5
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_106_cell-10-bd",
    "area": "P1B-L2",
    "bayNumber": "BAY 10",
    "customer": "BD",
    "description": "",
    "position": {
      "left": 14.92,
      "top": 21.1,
      "width": 6.72,
      "height": 19.26
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_107_cell-11a-bd",
    "area": "P1B-L2",
    "bayNumber": "BAY 11A",
    "customer": "BD",
    "description": "",
    "position": {
      "left": 10.87,
      "top": 21.1,
      "width": 3.77,
      "height": 19.26
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_108_bay-7-reserve-for-future-set",
    "area": "P1B-L2",
    "bayNumber": "BAY 7",
    "customer": "",
    "description": "Reserve for Future Setup 3.2k SQFT",
    "position": {
      "left": 7.91,
      "top": 47.08,
      "width": 73.92,
      "height": 5.1
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l2_109_cell-6-toshiba",
    "area": "P1B-L2",
    "bayNumber": "BAY 6",
    "customer": "TOSHIBA",
    "description": "",
    "position": {
      "left": 43.18,
      "top": 21.1,
      "width": 6.65,
      "height": 19.27
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_110_cell-7-asp",
    "area": "P1B-L2",
    "bayNumber": "BAY 7",
    "customer": "ASP",
    "description": "",
    "position": {
      "left": 36.53,
      "top": 21.1,
      "width": 5.67,
      "height": 19.13
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_111_cell-8-asp",
    "area": "P1B-L2",
    "bayNumber": "BAY 8",
    "customer": "ASP",
    "description": "",
    "position": {
      "left": 28.86,
      "top": 21.0,
      "width": 6.44,
      "height": 19.37
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_112_cell-12-bd",
    "area": "P1B-L2",
    "bayNumber": "BAY 12",
    "customer": "BD",
    "description": "",
    "position": {
      "left": 1.14,
      "top": 18.77,
      "width": 5.14,
      "height": 9.21
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_113_bay-2b-reserve-for-future-se",
    "area": "P1B-L2",
    "bayNumber": "BAY 2B",
    "customer": "",
    "description": "Reserve for Future Setup 1k SQFT",
    "position": {
      "left": 8.2,
      "top": 76.02,
      "width": 32.83,
      "height": 5.39
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l2_114_cell-13-288-sqft",
    "area": "P1B-L2",
    "bayNumber": "BAY 13",
    "customer": "",
    "description": "288 SQFT",
    "position": {
      "left": 0.83,
      "top": 39.08,
      "width": 5.42,
      "height": 7.27
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_115_bay-8a-tmo",
    "area": "P1B-L2",
    "bayNumber": "BAY 8A",
    "customer": "TMO",
    "description": "",
    "position": {
      "left": 45.91,
      "top": 41.17,
      "width": 35.91,
      "height": 5.02
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_116_daneher",
    "area": "P1B-L2",
    "bayNumber": "BAY",
    "customer": "",
    "description": "DANEHER",
    "position": {
      "left": 86.02,
      "top": 46.61,
      "width": 13.01,
      "height": 6.69
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_117_cell-5-shinkawa",
    "area": "P1B-L2",
    "bayNumber": "BAY 5",
    "customer": "SHINKAWA / NK",
    "description": "",
    "position": {
      "left": 51.14,
      "top": 21.1,
      "width": 7.92,
      "height": 19.13
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_118_cell-16-asp",
    "area": "P1B-L2",
    "bayNumber": "BAY 16",
    "customer": "ASP",
    "description": "",
    "position": {
      "left": 1.29,
      "top": 66.74,
      "width": 4.76,
      "height": 7.71
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_119_collins",
    "area": "P1B-L2",
    "bayNumber": "BAY",
    "customer": "COLLINS",
    "description": "",
    "position": {
      "left": 85.98,
      "top": 70.63,
      "width": 12.96,
      "height": 7.6
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_120_collins",
    "area": "P1B-L2",
    "bayNumber": "BAY",
    "customer": "COLLINS",
    "description": "",
    "position": {
      "left": 86.11,
      "top": 53.3,
      "width": 12.98,
      "height": 7.25
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_121_wabtec",
    "area": "P1B-L2",
    "bayNumber": "BAY",
    "customer": "WABTEC",
    "description": "",
    "position": {
      "left": 85.66,
      "top": 78.21,
      "width": 13.37,
      "height": 4.25
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_122_wabtec",
    "area": "P1B-L2",
    "bayNumber": "BAY",
    "customer": "WABTEC",
    "description": "",
    "position": {
      "left": 85.92,
      "top": 60.68,
      "width": 13.16,
      "height": 9.72
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_123_bay-2a-danaher",
    "area": "P1B-L2",
    "bayNumber": "BAY 2A",
    "customer": "DANAHER",
    "description": "",
    "position": {
      "left": 45.91,
      "top": 78.12,
      "width": 35.84,
      "height": 4.02
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_124_bay-3a-danaher",
    "area": "P1B-L2",
    "bayNumber": "BAY 3A",
    "customer": "DANAHER",
    "description": "",
    "position": {
      "left": 45.91,
      "top": 69.57,
      "width": 35.84,
      "height": 7.72
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_125_bay-3b-collins",
    "area": "P1B-L2",
    "bayNumber": "BAY 3B",
    "customer": "COLLINS",
    "description": "",
    "position": {
      "left": 7.98,
      "top": 70.63,
      "width": 16.77,
      "height": 4.5
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_126_bay-3b-reserve-for-future-se",
    "area": "P1B-L2",
    "bayNumber": "BAY 3B",
    "customer": "",
    "description": "Reserve for Future Setup 479 SQFT",
    "position": {
      "left": 24.75,
      "top": 70.63,
      "width": 16.06,
      "height": 4.5
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l2_127_bay-8b-tmo",
    "area": "P1B-L2",
    "bayNumber": "BAY 8B",
    "customer": "TMO",
    "description": "",
    "position": {
      "left": 8.2,
      "top": 41.17,
      "width": 35.91,
      "height": 5.02
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_128_cell-1-tmo",
    "area": "P1B-L2",
    "bayNumber": "BAY 1",
    "customer": "TMO",
    "description": "",
    "position": {
      "left": 77.21,
      "top": 21.14,
      "width": 4.61,
      "height": 19.13
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_129_cell-2-tmo",
    "area": "P1B-L2",
    "bayNumber": "BAY 2",
    "customer": "TMO",
    "description": "",
    "position": {
      "left": 71.87,
      "top": 21.14,
      "width": 4.61,
      "height": 19.13
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_130_cell-3-reserve-for-future-se",
    "area": "P1B-L2",
    "bayNumber": "BAY 3",
    "customer": "",
    "description": "Reserve for Future Setup 1.1k SQFT",
    "position": {
      "left": 61.79,
      "top": 21.0,
      "width": 9.37,
      "height": 19.24
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l2_131_cell-4-tmo",
    "area": "P1B-L2",
    "bayNumber": "BAY 4",
    "customer": "TMO",
    "description": "",
    "position": {
      "left": 59.22,
      "top": 21.14,
      "width": 2.0,
      "height": 19.13
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_132_daneher",
    "area": "P1B-L2",
    "bayNumber": "BAY",
    "customer": "",
    "description": "DANEHER",
    "position": {
      "left": 86.02,
      "top": 40.35,
      "width": 13.01,
      "height": 6.43
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_133_cell-9-asp",
    "area": "P1B-L2",
    "bayNumber": "BAY 9",
    "customer": "ASP",
    "description": "",
    "position": {
      "left": 22.31,
      "top": 21.0,
      "width": 6.44,
      "height": 19.37
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_134_cell-11b-nk",
    "area": "P1B-L2",
    "bayNumber": "BAY 11B",
    "customer": "NK",
    "description": "",
    "position": {
      "left": 7.54,
      "top": 21.1,
      "width": 3.77,
      "height": 19.26
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_135_cell-14-nk",
    "area": "P1B-L2",
    "bayNumber": "BAY 14",
    "customer": "NK",
    "description": "",
    "position": {
      "left": 1.29,
      "top": 47.74,
      "width": 4.76,
      "height": 3.56
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_136_cell-16-wabtec",
    "area": "P1B-L2",
    "bayNumber": "BAY 16",
    "customer": "WABTEC",
    "description": "",
    "position": {
      "left": 1.29,
      "top": 51.53,
      "width": 4.74,
      "height": 15.13
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l2_137_bay-4a-reserve-for-future-se",
    "area": "P1B-L2",
    "bayNumber": "BAY 4A",
    "customer": "",
    "description": "Reserve for Future Setup 1.3k SQFT",
    "position": {
      "left": 45.91,
      "top": 65.02,
      "width": 35.84,
      "height": 4.55
    },
    "status": "reserve"
  },
  {
    "id": "p1c_138_cell-3-advantest",
    "area": "P1C",
    "bayNumber": "BAY 3",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 26.11,
      "top": 43.49,
      "width": 7.42,
      "height": 30.44
    },
    "status": "occupied"
  },
  {
    "id": "p1c_139_advantest",
    "area": "P1C",
    "bayNumber": "BAY",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 20.31,
      "top": 20.15,
      "width": 24.19,
      "height": 20.09
    },
    "status": "occupied"
  },
  {
    "id": "p1c_140_efem-cleanroom-for-future-ex",
    "area": "P1C",
    "bayNumber": "BAY",
    "customer": "",
    "description": "EFEM Cleanroom for future expansion",
    "position": {
      "left": 2.14,
      "top": 76.73,
      "width": 22.85,
      "height": 9.72
    },
    "status": "reserve"
  },
  {
    "id": "p1c_141_amat-cleanroom",
    "area": "P1C",
    "bayNumber": "BAY",
    "customer": "AMAT",
    "description": "Cleanroom",
    "position": {
      "left": 6.22,
      "top": 86.45,
      "width": 18.77,
      "height": 12.39
    },
    "status": "occupied"
  },
  {
    "id": "p1c_142_efem-cleanroom-for-future-ex",
    "area": "P1C",
    "bayNumber": "BAY",
    "customer": "",
    "description": "EFEM Cleanroom for future expansion 6.7k SQFT (NBV $207k)",
    "position": {
      "left": 24.99,
      "top": 76.73,
      "width": 17.54,
      "height": 22.11
    },
    "status": "reserve"
  },
  {
    "id": "p1c_143_cell-4a-advantest",
    "area": "P1C",
    "bayNumber": "BAY 4A",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 34.57,
      "top": 43.28,
      "width": 8.56,
      "height": 12.68
    },
    "status": "occupied"
  },
  {
    "id": "p1c_144_cell-4b-advantest",
    "area": "P1C",
    "bayNumber": "BAY 4B",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 34.57,
      "top": 57.8,
      "width": 9.69,
      "height": 16.13
    },
    "status": "occupied"
  },
  {
    "id": "p1c_145_cell-5a-advantest",
    "area": "P1C",
    "bayNumber": "BAY 5A",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 43.39,
      "top": 43.28,
      "width": 9.69,
      "height": 12.68
    },
    "status": "occupied"
  },
  {
    "id": "p1c_146_cell-6a-advantest",
    "area": "P1C",
    "bayNumber": "BAY 6A",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 53.33,
      "top": 43.28,
      "width": 19.33,
      "height": 12.68
    },
    "status": "occupied"
  },
  {
    "id": "p1c_147_cell-5b-advantest",
    "area": "P1C",
    "bayNumber": "BAY 5B",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 45.3,
      "top": 57.8,
      "width": 6.65,
      "height": 16.13
    },
    "status": "occupied"
  },
  {
    "id": "p1c_148_cell-6b-advantest",
    "area": "P1C",
    "bayNumber": "BAY 6B",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 53.08,
      "top": 57.8,
      "width": 6.65,
      "height": 16.13
    },
    "status": "occupied"
  },
  {
    "id": "p1c_149_cell-6c-advantest",
    "area": "P1C",
    "bayNumber": "BAY 6C",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 60.54,
      "top": 57.8,
      "width": 6.65,
      "height": 16.13
    },
    "status": "occupied"
  },
  {
    "id": "p1c_150_cell-6d-advantest",
    "area": "P1C",
    "bayNumber": "BAY 6D",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 68.38,
      "top": 57.62,
      "width": 4.28,
      "height": 16.31
    },
    "status": "occupied"
  },
  {
    "id": "p1c_151_cell-7c-advantest",
    "area": "P1C",
    "bayNumber": "BAY 7C",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 72.66,
      "top": 57.62,
      "width": 5.31,
      "height": 16.31
    },
    "status": "occupied"
  },
  {
    "id": "p1c_152_cell-7d-advantest",
    "area": "P1C",
    "bayNumber": "BAY 7D",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 77.97,
      "top": 57.62,
      "width": 5.31,
      "height": 16.31
    },
    "status": "occupied"
  },
  {
    "id": "p1c_153_cell-7e-advantest",
    "area": "P1C",
    "bayNumber": "BAY 7E",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 83.29,
      "top": 57.62,
      "width": 5.91,
      "height": 16.31
    },
    "status": "occupied"
  },
  {
    "id": "p1c_154_cell-7a-advantest",
    "area": "P1C",
    "bayNumber": "BAY 7A",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 73.14,
      "top": 43.06,
      "width": 15.93,
      "height": 3.12
    },
    "status": "occupied"
  },
  {
    "id": "p1c_155_cell-7b-advantest",
    "area": "P1C",
    "bayNumber": "BAY 7B",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 73.14,
      "top": 47.22,
      "width": 15.93,
      "height": 8.74
    },
    "status": "occupied"
  },
  {
    "id": "p1c_156_medical",
    "area": "P1C",
    "bayNumber": "BAY",
    "customer": "MEDICAL",
    "description": "",
    "position": {
      "left": 6.2,
      "top": 0.01,
      "width": 9.46,
      "height": 16.53
    },
    "status": "occupied"
  },
  {
    "id": "p1c_157_cell-2a-advantest",
    "area": "P1C",
    "bayNumber": "BAY 2A",
    "customer": "ADVANTEST",
    "description": "",
    "position": {
      "left": 24.25,
      "top": 43.49,
      "width": 1.86,
      "height": 30.44
    },
    "status": "occupied"
  },
  {
    "id": "p1c_158_reserve-for-advantest-expans",
    "area": "P1C",
    "bayNumber": "BAY",
    "customer": "ADVANTEST",
    "description": "Reserve for expansion",
    "position": {
      "left": 3.13,
      "top": 43.49,
      "width": 21.12,
      "height": 30.44
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l3_159_fa-lab",
    "area": "P1B-L3",
    "bayNumber": "BAY",
    "customer": "",
    "description": "FA Lab",
    "position": {
      "left": 49.3,
      "top": 4.37,
      "width": 28.97,
      "height": 13.87
    },
    "status": "special"
  },
  {
    "id": "p1b_l3_160_cell-1-lamres",
    "area": "P1B-L3",
    "bayNumber": "BAY 1",
    "customer": "LAM / LAMRES",
    "description": "",
    "position": {
      "left": 78.27,
      "top": 4.37,
      "width": 11.47,
      "height": 13.87
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_161_bay-1a-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 1A",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 52.86,
      "top": 20.55,
      "width": 33.75,
      "height": 4.54
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_162_bay-1b-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 1B",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 20.16,
      "top": 20.49,
      "width": 30.87,
      "height": 4.56
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_163_bay-2a-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 2A",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 52.86,
      "top": 25.94,
      "width": 33.75,
      "height": 5.0
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_164_bay-2b-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 2B",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 20.16,
      "top": 25.9,
      "width": 30.87,
      "height": 5.0
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_165_bay-3a-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 3A",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 52.86,
      "top": 32.07,
      "width": 33.75,
      "height": 4.72
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_166_bay-3b-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 3B",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 20.16,
      "top": 31.86,
      "width": 30.87,
      "height": 4.9
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_167_bay-4a-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 4A",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 52.82,
      "top": 37.65,
      "width": 33.75,
      "height": 4.98
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_168_bay-4b-illumina",
    "area": "P1B-L3",
    "bayNumber": "BAY 4B",
    "customer": "ILLUMINA",
    "description": "",
    "position": {
      "left": 20.16,
      "top": 37.7,
      "width": 30.87,
      "height": 4.93
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_169_bay-5-lamres",
    "area": "P1B-L3",
    "bayNumber": "BAY 5",
    "customer": "LAM / LAMRES",
    "description": "",
    "position": {
      "left": 20.16,
      "top": 46.18,
      "width": 67.42,
      "height": 5.0
    },
    "status": "occupied"
  },
  {
    "id": "p1b_l3_170_reserve-for-future-setup-3-1",
    "area": "P1B-L3",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Reserve for Future Setup 3,152 SQFT",
    "position": {
      "left": 20.16,
      "top": 52.03,
      "width": 67.42,
      "height": 5.0
    },
    "status": "reserve"
  },
  {
    "id": "p1b_l3_171_reserve-for-future-setup-9-6",
    "area": "P1B-L3",
    "bayNumber": "BAY",
    "customer": "",
    "description": "Reserve for Future Setup 9,668 SQFT",
    "position": {
      "left": 18.53,
      "top": 57.03,
      "width": 69.05,
      "height": 15.29
    },
    "status": "reserve"
  }
]

export const AREAS = ['P1A', 'P1B-G', 'P1B-L2', 'P1B-L3', 'P1C'] as const
export type Area = typeof AREAS[number]

export const BAY_IMAGES: Record<string, string> = {
  'P1A': '/floor-maps/P1A.png',
  'P1B-G': '/floor-maps/P1B.png',
  'P1B-L2': '/floor-maps/P1B L2.png',
  'P1B-L3': '/floor-maps/P1B L3.png',
  'P1C': '/floor-maps/P1C.png',
}