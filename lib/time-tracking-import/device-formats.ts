/**
 * Device Format Definitions for Biometric Time Tracking Import
 *
 * Defines column mappings and parsing rules for different biometric device brands:
 * - ZKTeco (most common in Africa)
 * - Anviz
 * - Generic CSV (user-configurable)
 */

export type DeviceType = 'zkteco' | 'anviz' | 'generic';
export type DirectionValue = 'in' | 'out' | 'IN' | 'OUT' | 'In' | 'Out' | 'Check In' | 'Check Out' | 'Entry' | 'Exit' | '0' | '1' | 'C/In' | 'C/Out' | 'Entrée' | 'E' | 'Sortie' | 'S' | '2';

/**
 * Column mapping for device exports
 */
export interface DeviceColumnMapping {
  employeeId?: string;        // Column name for employee ID/number
  employeeName?: string;       // Column name for employee name
  timestamp?: string;          // Column name for punch timestamp
  direction?: string;          // Column name for In/Out direction
  deviceId?: string;           // Column name for device identifier
  location?: string;           // Column name for location/site
}

/**
 * Device format configuration
 */
export interface DeviceFormat {
  type: DeviceType;
  name: string;
  description: string;
  columnMapping: DeviceColumnMapping;

  /**
   * Expected column names (for auto-detection)
   * Regular expressions to match column headers
   */
  columnPatterns: {
    employeeId: RegExp[];
    employeeName: RegExp[];
    timestamp: RegExp[];
    direction: RegExp[];
    deviceId?: RegExp[];
    location?: RegExp[];
  };

  /**
   * Direction value mappings (how device represents In/Out)
   */
  directionValues: {
    in: DirectionValue[];
    out: DirectionValue[];
  };

  /**
   * Timestamp format(s) used by this device
   * Using date-fns format strings
   */
  timestampFormats: string[];

  /**
   * Timezone info (if device exports in local time)
   */
  usesLocalTime: boolean;
}

/**
 * ZKTeco device format
 * Common exports: Employee ID, Name, DateTime, In/Out, Device
 */
export const ZKTecoFormat: DeviceFormat = {
  type: 'zkteco',
  name: 'ZKTeco',
  description: 'Appareils biométriques ZKTeco (format CSV/Excel standard)',

  columnMapping: {
    employeeId: 'AC-No.',
    employeeName: 'Name',
    timestamp: 'Date/Time',
    direction: 'State',
    deviceId: 'Device Name',
  },

  columnPatterns: {
    employeeId: [
      /^(AC[-\s]?No\.?|Employee\s*ID|Emp\s*ID|Badge\s*ID|ID)$/i,
      /^No\.?$/i,
    ],
    employeeName: [
      /^(Name|Employee\s*Name|Emp\s*Name|Full\s*Name)$/i,
    ],
    timestamp: [
      /^(Date[\s\/]?Time|DateTime|Time|Punch\s*Time|Date)$/i,
    ],
    direction: [
      /^(State|Status|Direction|In[\s\/]?Out|Type|Check\s*Type)$/i,
    ],
    deviceId: [
      /^(Device(\s*Name)?|Terminal|Machine|Reader)$/i,
    ],
    location: [
      /^(Location|Site|Place|Area)$/i,
    ],
  },

  directionValues: {
    in: ['in', 'IN', 'In', 'Check In', 'Entry', '0', 'C/In'],
    out: ['out', 'OUT', 'Out', 'Check Out', 'Exit', '1', 'C/Out'],
  },

  timestampFormats: [
    'yyyy-MM-dd HH:mm:ss',      // 2024-11-08 08:30:00
    'dd/MM/yyyy HH:mm:ss',      // 08/11/2024 08:30:00
    'MM/dd/yyyy HH:mm:ss',      // 11/08/2024 08:30:00
    'yyyy-MM-dd HH:mm',         // 2024-11-08 08:30
    'dd/MM/yyyy HH:mm',         // 08/11/2024 08:30
  ],

  usesLocalTime: true,
};

/**
 * Anviz device format
 * Similar to ZKTeco but with slight column name variations
 */
export const AnvizFormat: DeviceFormat = {
  type: 'anviz',
  name: 'Anviz',
  description: 'Appareils biométriques Anviz (format CSV/Excel standard)',

  columnMapping: {
    employeeId: 'Personnel No',
    employeeName: 'Name',
    timestamp: 'Time',
    direction: 'Verify Mode',
    deviceId: 'Device S/N',
  },

  columnPatterns: {
    employeeId: [
      /^(Personnel\s*No\.?|Employee\s*No\.?|User\s*ID|Badge\s*No\.?)$/i,
      /^(ID|No\.?)$/i,
    ],
    employeeName: [
      /^(Name|Personnel\s*Name|Employee\s*Name)$/i,
    ],
    timestamp: [
      /^(Time|Date[\s\/]?Time|DateTime|Punch\s*Time|Attendance\s*Time)$/i,
    ],
    direction: [
      /^(Verify\s*Mode|Mode|Direction|In[\s\/]?Out|Type)$/i,
    ],
    deviceId: [
      /^(Device(\s*S\/N)?|Serial|Machine\s*ID|Terminal)$/i,
    ],
  },

  directionValues: {
    in: ['in', 'IN', 'In', 'Check In', 'Entry', '0'],
    out: ['out', 'OUT', 'Out', 'Check Out', 'Exit', '1'],
  },

  timestampFormats: [
    'yyyy-MM-dd HH:mm:ss',
    'dd/MM/yyyy HH:mm:ss',
    'yyyy/MM/dd HH:mm:ss',
    'dd-MM-yyyy HH:mm:ss',
  ],

  usesLocalTime: true,
};

/**
 * Generic CSV format (user must map columns)
 */
export const GenericFormat: DeviceFormat = {
  type: 'generic',
  name: 'CSV Générique',
  description: 'Format CSV personnalisé avec mapping manuel des colonnes',

  columnMapping: {
    // Will be set by user during import
  },

  columnPatterns: {
    employeeId: [
      /^(ID|Employee|Emp|Badge|No|Number|Personnel|User|Worker).*$/i,
    ],
    employeeName: [
      /^(Name|Nom|Prénom|Full.*Name|First.*Name).*$/i,
    ],
    timestamp: [
      /^(Time|Date|DateTime|Punch|Clock|Timestamp|Heure).*$/i,
    ],
    direction: [
      /^(Direction|Type|State|Status|In.*Out|Entrée|Sortie|Sens).*$/i,
    ],
    deviceId: [
      /^(Device|Machine|Terminal|Reader|Appareil).*$/i,
    ],
    location: [
      /^(Location|Site|Place|Area|Lieu|Emplacement).*$/i,
    ],
  },

  directionValues: {
    in: ['in', 'IN', 'In', 'Check In', 'Entry', 'Entrée', 'E', '0', '1'],
    out: ['out', 'OUT', 'Out', 'Check Out', 'Exit', 'Sortie', 'S', '1', '2'],
  },

  timestampFormats: [
    'yyyy-MM-dd HH:mm:ss',
    'dd/MM/yyyy HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss',
    'yyyy/MM/dd HH:mm:ss',
    'dd-MM-yyyy HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'dd/MM/yyyy HH:mm',
  ],

  usesLocalTime: true,
};

/**
 * Get all available device formats
 */
export const DEVICE_FORMATS: Record<DeviceType, DeviceFormat> = {
  zkteco: ZKTecoFormat,
  anviz: AnvizFormat,
  generic: GenericFormat,
};

/**
 * Auto-detect device type from column headers
 */
export function detectDeviceType(columnHeaders: string[]): DeviceType | null {
  const headers = columnHeaders.map(h => h.trim());

  // Check ZKTeco patterns
  const zktecoMatches = headers.filter(header =>
    ZKTecoFormat.columnPatterns.employeeId.some(pattern => pattern.test(header)) ||
    ZKTecoFormat.columnPatterns.timestamp.some(pattern => pattern.test(header))
  );

  // Check Anviz patterns
  const anvizMatches = headers.filter(header =>
    AnvizFormat.columnPatterns.employeeId.some(pattern => pattern.test(header)) ||
    AnvizFormat.columnPatterns.timestamp.some(pattern => pattern.test(header))
  );

  // ZKTeco is detected if we find "AC-No." or "Device Name" specifically
  if (headers.some(h => /^AC[-\s]?No\.?$/i.test(h))) {
    return 'zkteco';
  }

  // Anviz is detected if we find "Personnel No" or "Device S/N" specifically
  if (headers.some(h => /^Personnel\s*No\.?$/i.test(h))) {
    return 'anviz';
  }

  // If we have good matches for either format, return that
  if (zktecoMatches.length >= 2) {
    return 'zkteco';
  }

  if (anvizMatches.length >= 2) {
    return 'anviz';
  }

  // Default to generic if we can't auto-detect
  return 'generic';
}

/**
 * Normalize direction value to 'in' or 'out'
 */
export function normalizeDirection(value: string, format: DeviceFormat): 'in' | 'out' | null {
  const normalized = value.trim();

  if (format.directionValues.in.some(v => v.toLowerCase() === normalized.toLowerCase())) {
    return 'in';
  }

  if (format.directionValues.out.some(v => v.toLowerCase() === normalized.toLowerCase())) {
    return 'out';
  }

  return null;
}
