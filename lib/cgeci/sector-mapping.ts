/**
 * CGECI Sector Mapping Utilities
 *
 * Maps CGECI sectors (18 detailed sectors) to generic sectors (6 simplified categories)
 * for work accident rate determination.
 *
 * @see CGECI-ARCHITECTURE-ANALYSIS.md
 */

export type CGECISector =
  | 'BANQUES'
  | 'ASSURANCES'
  | 'COMMERCE'
  | 'BTP'
  | 'IND_MECANIQUE'
  | 'IND_TEXTILE'
  | 'IND_BOIS'
  | 'IND_SUCRE'
  | 'IND_THON'
  | 'IND_HOTEL'
  | 'IND_TOURISME'
  | 'IND_IMPRIMERIE'
  | 'IND_POLYGRAPHIQUE'
  | 'AUX_TRANSPORT'
  | 'PETROLE_DISTRIB'
  | 'NETTOYAGE'
  | 'SECURITE'
  | 'GENS_MAISON';

export type GenericSector =
  | 'SERVICES'
  | 'CONSTRUCTION'
  | 'INDUSTRY'
  | 'TRANSPORT'
  | 'AGRICULTURE'
  | 'MINING';

/**
 * Map CGECI sector to generic sector for work accident rate calculation
 */
export const cgeciToGenericSector: Record<CGECISector, GenericSector> = {
  // Financial Services → SERVICES (2% AT)
  BANQUES: 'SERVICES',
  ASSURANCES: 'SERVICES',

  // Commerce & Hospitality → SERVICES (2% AT)
  COMMERCE: 'SERVICES',
  IND_HOTEL: 'SERVICES',
  IND_TOURISME: 'SERVICES',

  // Construction → CONSTRUCTION (5% AT)
  BTP: 'CONSTRUCTION',

  // Manufacturing Industries → INDUSTRY (3% AT)
  IND_MECANIQUE: 'INDUSTRY',
  IND_TEXTILE: 'INDUSTRY',
  IND_BOIS: 'INDUSTRY',
  IND_SUCRE: 'INDUSTRY',
  IND_THON: 'INDUSTRY',
  IND_IMPRIMERIE: 'INDUSTRY',
  IND_POLYGRAPHIQUE: 'INDUSTRY',

  // Transport & Logistics → TRANSPORT (3.5% AT)
  AUX_TRANSPORT: 'TRANSPORT',
  PETROLE_DISTRIB: 'TRANSPORT',

  // Service Workers → SERVICES (2% AT)
  NETTOYAGE: 'SERVICES',
  SECURITE: 'SERVICES',
  GENS_MAISON: 'SERVICES',
};

/**
 * Get generic sector from CGECI sector code
 */
export function getGenericSector(cgeciSector: CGECISector): GenericSector {
  return cgeciToGenericSector[cgeciSector];
}

/**
 * Get work accident rate for a CGECI sector
 */
export function getWorkAccidentRate(cgeciSector: CGECISector): number {
  const genericSector = getGenericSector(cgeciSector);

  const accidentRates: Record<GenericSector, number> = {
    SERVICES: 0.02,       // 2%
    AGRICULTURE: 0.025,   // 2.5%
    INDUSTRY: 0.03,       // 3%
    TRANSPORT: 0.035,     // 3.5%
    CONSTRUCTION: 0.05,   // 5%
    MINING: 0.05,         // 5%
  };

  return accidentRates[genericSector];
}

/**
 * CGECI Sector Metadata for User Selection
 */
export interface CGECISectorInfo {
  code: CGECISector;
  labelFr: string;
  descriptionFr: string;
  icon: string; // Lucide icon name
  category: 'financial' | 'commerce' | 'construction' | 'industry' | 'transport' | 'services';
}

export const cgeciSectorList: CGECISectorInfo[] = [
  // Financial Services
  {
    code: 'BANQUES',
    labelFr: 'Banques',
    descriptionFr: 'Établissements bancaires et financiers',
    icon: 'Building2',
    category: 'financial',
  },
  {
    code: 'ASSURANCES',
    labelFr: 'Assurances',
    descriptionFr: 'Compagnies d\'assurance',
    icon: 'Shield',
    category: 'financial',
  },

  // Commerce & Retail
  {
    code: 'COMMERCE',
    labelFr: 'Commerce',
    descriptionFr: 'Magasin, distribution, négoce',
    icon: 'ShoppingBag',
    category: 'commerce',
  },
  {
    code: 'IND_HOTEL',
    labelFr: 'Hôtellerie',
    descriptionFr: 'Hôtels et hébergement',
    icon: 'Hotel',
    category: 'commerce',
  },
  {
    code: 'IND_TOURISME',
    labelFr: 'Tourisme',
    descriptionFr: 'Agences de voyage et tourisme',
    icon: 'Plane',
    category: 'commerce',
  },

  // Construction
  {
    code: 'BTP',
    labelFr: 'BTP (Construction)',
    descriptionFr: 'Bâtiment, travaux publics et activités connexes',
    icon: 'Hammer',
    category: 'construction',
  },

  // Manufacturing Industries
  {
    code: 'IND_MECANIQUE',
    labelFr: 'Industrie Mécanique',
    descriptionFr: 'Mécanique générale, extractives, alimentaires, chimiques',
    icon: 'Cog',
    category: 'industry',
  },
  {
    code: 'IND_TEXTILE',
    labelFr: 'Industrie Textile',
    descriptionFr: 'Fabrication de textiles et vêtements',
    icon: 'Shirt',
    category: 'industry',
  },
  {
    code: 'IND_BOIS',
    labelFr: 'Industrie du Bois',
    descriptionFr: 'Transformation du bois et dérivés',
    icon: 'Trees',
    category: 'industry',
  },
  {
    code: 'IND_SUCRE',
    labelFr: 'Industrie Sucrière',
    descriptionFr: 'Production de sucre',
    icon: 'Factory',
    category: 'industry',
  },
  {
    code: 'IND_THON',
    labelFr: 'Industrie du Thon',
    descriptionFr: 'Pêche et transformation du thon',
    icon: 'Fish',
    category: 'industry',
  },
  {
    code: 'IND_IMPRIMERIE',
    labelFr: 'Imprimerie',
    descriptionFr: 'Imprimerie et reproduction',
    icon: 'Printer',
    category: 'industry',
  },
  {
    code: 'IND_POLYGRAPHIQUE',
    labelFr: 'Industrie Polygraphique',
    descriptionFr: 'Arts graphiques et édition',
    icon: 'BookOpen',
    category: 'industry',
  },

  // Transport & Logistics
  {
    code: 'AUX_TRANSPORT',
    labelFr: 'Transport',
    descriptionFr: 'Transport de marchandises et passagers',
    icon: 'Truck',
    category: 'transport',
  },
  {
    code: 'PETROLE_DISTRIB',
    labelFr: 'Distribution de Pétrole',
    descriptionFr: 'Stations-service et distribution pétrolière',
    icon: 'Fuel',
    category: 'transport',
  },

  // Services
  {
    code: 'NETTOYAGE',
    labelFr: 'Nettoyage',
    descriptionFr: 'Services de nettoyage et entretien',
    icon: 'Sparkles',
    category: 'services',
  },
  {
    code: 'SECURITE',
    labelFr: 'Sécurité',
    descriptionFr: 'Services de gardiennage et sécurité',
    icon: 'ShieldCheck',
    category: 'services',
  },
  {
    code: 'GENS_MAISON',
    labelFr: 'Gens de Maison',
    descriptionFr: 'Employés de maison',
    icon: 'Home',
    category: 'services',
  },
];

/**
 * Grouped CGECI sectors for easier user selection (7 visual cards)
 */
export interface SectorGroup {
  id: string;
  labelFr: string;
  descriptionFr: string;
  icon: string;
  sectors: CGECISector[];
}

export const sectorGroups: SectorGroup[] = [
  {
    id: 'financial',
    labelFr: 'Banque & Assurance',
    descriptionFr: 'Établissements financiers',
    icon: 'Building2',
    sectors: ['BANQUES', 'ASSURANCES'],
  },
  {
    id: 'commerce',
    labelFr: 'Commerce & Hôtellerie',
    descriptionFr: 'Magasin, distribution, hôtel, tourisme',
    icon: 'ShoppingBag',
    sectors: ['COMMERCE', 'IND_HOTEL', 'IND_TOURISME'],
  },
  {
    id: 'construction',
    labelFr: 'Construction (BTP)',
    descriptionFr: 'Bâtiment, travaux publics',
    icon: 'Hammer',
    sectors: ['BTP'],
  },
  {
    id: 'industry',
    labelFr: 'Industrie',
    descriptionFr: 'Fabrication, production, transformation',
    icon: 'Factory',
    sectors: [
      'IND_MECANIQUE',
      'IND_TEXTILE',
      'IND_BOIS',
      'IND_SUCRE',
      'IND_THON',
      'IND_IMPRIMERIE',
      'IND_POLYGRAPHIQUE',
    ],
  },
  {
    id: 'transport',
    labelFr: 'Transport & Logistique',
    descriptionFr: 'Transport, livraison, distribution',
    icon: 'Truck',
    sectors: ['AUX_TRANSPORT', 'PETROLE_DISTRIB'],
  },
  {
    id: 'services',
    labelFr: 'Services',
    descriptionFr: 'Nettoyage, sécurité, autres services',
    icon: 'Briefcase',
    sectors: ['NETTOYAGE', 'SECURITE', 'GENS_MAISON'],
  },
];

/**
 * Get sector info by code
 */
export function getSectorInfo(code: CGECISector): CGECISectorInfo | undefined {
  return cgeciSectorList.find((s) => s.code === code);
}

/**
 * Search sectors by query
 */
export function searchSectors(query: string): CGECISectorInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return cgeciSectorList;

  return cgeciSectorList.filter(
    (sector) =>
      sector.labelFr.toLowerCase().includes(q) ||
      sector.descriptionFr.toLowerCase().includes(q)
  );
}
