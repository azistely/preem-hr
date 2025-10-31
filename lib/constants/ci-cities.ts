/**
 * Côte d'Ivoire Cities and Communes
 *
 * This file contains the list of cities in Côte d'Ivoire and communes within Abidjan
 * for use in location forms and transport allowance calculations.
 */

export interface CICity {
  value: string;
  label: string;
  transportAllowance: number;
}

/**
 * List of major cities in Côte d'Ivoire with their transport allowances
 * - Abidjan: 30,000 FCFA
 * - Bouaké: 24,000 FCFA
 * - All others: 20,000 FCFA
 */
export const CI_CITIES: CICity[] = [
  { value: 'Abidjan', label: 'Abidjan', transportAllowance: 30000 },
  { value: 'Bouaké', label: 'Bouaké', transportAllowance: 24000 },
  { value: 'Yamoussoukro', label: 'Yamoussoukro', transportAllowance: 20000 },
  { value: 'San-Pédro', label: 'San-Pédro', transportAllowance: 20000 },
  { value: 'Daloa', label: 'Daloa', transportAllowance: 20000 },
  { value: 'Korhogo', label: 'Korhogo', transportAllowance: 20000 },
  { value: 'Man', label: 'Man', transportAllowance: 20000 },
  { value: 'Gagnoa', label: 'Gagnoa', transportAllowance: 20000 },
  { value: 'Divo', label: 'Divo', transportAllowance: 20000 },
  { value: 'Abengourou', label: 'Abengourou', transportAllowance: 20000 },
  { value: 'Grand-Bassam', label: 'Grand-Bassam', transportAllowance: 20000 },
  { value: 'Soubré', label: 'Soubré', transportAllowance: 20000 },
  { value: 'Agboville', label: 'Agboville', transportAllowance: 20000 },
  { value: 'Sassandra', label: 'Sassandra', transportAllowance: 20000 },
  { value: 'Bondoukou', label: 'Bondoukou', transportAllowance: 20000 },
  { value: 'Ferkessédougou', label: 'Ferkessédougou', transportAllowance: 20000 },
  { value: 'Séguéla', label: 'Séguéla', transportAllowance: 20000 },
  { value: 'Odienné', label: 'Odienné', transportAllowance: 20000 },
  { value: 'Boundiali', label: 'Boundiali', transportAllowance: 20000 },
  { value: 'Dabou', label: 'Dabou', transportAllowance: 20000 },
  { value: 'Adzopé', label: 'Adzopé', transportAllowance: 20000 },
  { value: 'Daoukro', label: 'Daoukro', transportAllowance: 20000 },
  { value: 'Issia', label: 'Issia', transportAllowance: 20000 },
  { value: 'Bingerville', label: 'Bingerville', transportAllowance: 20000 },
  { value: 'Anyama', label: 'Anyama', transportAllowance: 20000 },
  { value: 'Danané', label: 'Danané', transportAllowance: 20000 },
  { value: 'Vavoua', label: 'Vavoua', transportAllowance: 20000 },
  { value: 'Tiébissou', label: 'Tiébissou', transportAllowance: 20000 },
  { value: 'Toumodi', label: 'Toumodi', transportAllowance: 20000 },
  { value: 'Duékoué', label: 'Duékoué', transportAllowance: 20000 },
  { value: 'Bangolo', label: 'Bangolo', transportAllowance: 20000 },
  { value: 'Lakota', label: 'Lakota', transportAllowance: 20000 },
  { value: 'Bouna', label: 'Bouna', transportAllowance: 20000 },
  { value: 'Tanda', label: 'Tanda', transportAllowance: 20000 },
  { value: 'Katiola', label: 'Katiola', transportAllowance: 20000 },
  { value: 'Touba', label: 'Touba', transportAllowance: 20000 },
  { value: 'Béoumi', label: 'Béoumi', transportAllowance: 20000 },
  { value: 'Mbahiakro', label: 'Mbahiakro', transportAllowance: 20000 },
  { value: 'Biankouma', label: 'Biankouma', transportAllowance: 20000 },
  { value: 'Sinfra', label: 'Sinfra', transportAllowance: 20000 },
  { value: 'Zuénoula', label: 'Zuénoula', transportAllowance: 20000 },
  { value: 'Sakassou', label: 'Sakassou', transportAllowance: 20000 },
  { value: 'Guiglo', label: 'Guiglo', transportAllowance: 20000 },
  { value: 'Tabou', label: 'Tabou', transportAllowance: 20000 },
  { value: 'Bonoua', label: 'Bonoua', transportAllowance: 20000 },
  { value: 'Jacqueville', label: 'Jacqueville', transportAllowance: 20000 },
  { value: 'Tiassalé', label: 'Tiassalé', transportAllowance: 20000 },
  { value: 'Agnibilékrou', label: 'Agnibilékrou', transportAllowance: 20000 },
];

/**
 * List of communes within the city of Abidjan
 * These are the 13 official communes of the Abidjan district
 */
export const ABIDJAN_COMMUNES = [
  { value: 'Abobo', label: 'Abobo' },
  { value: 'Adjamé', label: 'Adjamé' },
  { value: 'Attécoubé', label: 'Attécoubé' },
  { value: 'Cocody', label: 'Cocody' },
  { value: 'Koumassi', label: 'Koumassi' },
  { value: 'Marcory', label: 'Marcory' },
  { value: 'Plateau', label: 'Plateau' },
  { value: 'Port-Bouët', label: 'Port-Bouët' },
  { value: 'Treichville', label: 'Treichville' },
  { value: 'Yopougon', label: 'Yopougon' },
  { value: 'Bingerville', label: 'Bingerville' },
  { value: 'Songon', label: 'Songon' },
  { value: 'Anyama', label: 'Anyama' },
];

/**
 * Helper function to get transport allowance for a city
 */
export function getTransportAllowanceForCity(cityName: string): number {
  const city = CI_CITIES.find(c => c.value === cityName);
  return city?.transportAllowance ?? 20000; // Default to 20k if city not found
}
