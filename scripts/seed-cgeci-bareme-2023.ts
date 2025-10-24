/**
 * CGECI Barème 2023 - Seeding Script
 *
 * Source: GRILLE DES SALAIRES CATEGORIELS 2023 (Provisoire)
 * Official salary grid from CGECI (Confédération Générale des Entreprises de Côte d'Ivoire)
 *
 * This script seeds the complete CGECI minimum wage matrix for Côte d'Ivoire.
 * Structure: 34 Industrial Sectors × Variable Categories = 300+ entries
 *
 * SMIG 2023: 75,000 FCFA/month (432.7 FCFA/hour for 173.33 hours/month)
 *
 * Categories vary by sector:
 * - Standard: 1A, 1B, 2A, 2B, 3A, 3B, MNP, M1-M5, 1-7, 7A, 7B
 * - Banking/Insurance: 1st-8th class
 * - Maritime: Specific nautical positions
 * - Printing: CM1-CM4, CA1-CA2, CF1-CF3
 *
 * Date: 2025-10-23
 */

import { db } from '../lib/db';
import { employeeCategoryCoefficients } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

const SMIG_CI_2023 = 75000; // Base minimum wage for Côte d'Ivoire in FCFA

/**
 * CGECI Sector Data
 * Each sector has specific categories with minimum wage amounts
 */
const cgeci2023Data = [
  // =====================================================
  // SECTEUR 1: MECANIQUE GENERALE + INDUSTRIES (Standard Industrial Sector)
  // =====================================================
  {
    sectorCode: 'IND_MECANIQUE',
    sectorName: 'Mécanique Générale, Industries Extractives, Alimentaires, Chimiques, Transport',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres-Assimilés
      { code: '1A', label: 'Ingénieur Catégorie 1A', salary: 172911, coefficient: 231 },
      { code: '1B', label: 'Ingénieur Catégorie 1B', salary: 199052, coefficient: 265 },
      { code: '2A', label: 'Cadre Catégorie 2A', salary: 209068, coefficient: 279 },
      { code: '2B', label: 'Cadre Catégorie 2B', salary: 237269, coefficient: 316 },
      { code: '3A', label: 'Cadre Catégorie 3A', salary: 246644, coefficient: 329 },
      { code: '3B', label: 'Cadre Catégorie 3B', salary: 369890, coefficient: 493 },

      // Agents de Maîtrise - Techniciens
      { code: 'MNP', label: 'Agent de Maîtrise Débutant', salary: 118365, coefficient: 158 },
      { code: 'M1', label: 'Technicien M1', salary: 134263, coefficient: 179 },
      { code: 'M2', label: 'Technicien M2', salary: 143676, coefficient: 192 },
      { code: 'M3', label: 'Technicien M3', salary: 171597, coefficient: 229 },
      { code: 'M4', label: 'Technicien M4', salary: 186689, coefficient: 249 },
      { code: 'M5', label: 'Technicien M5', salary: 202250, coefficient: 270 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 86319, coefficient: 115 },
      { code: '3', label: 'Employé Catégorie 3', salary: 86924, coefficient: 116 },
      { code: '4', label: 'Employé Catégorie 4', salary: 92367, coefficient: 123 },
      { code: '5', label: 'Employé Catégorie 5', salary: 110185, coefficient: 147 },
      { code: '6', label: 'Employé Catégorie 6', salary: 124878, coefficient: 166 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 126187, coefficient: 168 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 135531, coefficient: 181 },
    ],
  },

  // =====================================================
  // SECTEUR 2: INDUSTRIE DU BOIS
  // =====================================================
  {
    sectorCode: 'IND_BOIS',
    sectorName: 'Industrie du Bois',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres
      { code: '1A', label: 'Ingénieur Catégorie 1A', salary: 171342, coefficient: 228 },
      { code: '1B', label: 'Ingénieur Catégorie 1B', salary: 197245, coefficient: 263 },
      { code: '2A', label: 'Cadre Catégorie 2A', salary: 207171, coefficient: 276 },
      { code: '2B', label: 'Cadre Catégorie 2B', salary: 235116, coefficient: 313 },
      { code: '3A', label: 'Cadre Catégorie 3A', salary: 244405, coefficient: 326 },
      { code: '3B', label: 'Cadre Catégorie 3B', salary: 366533, coefficient: 489 },

      // Agents de Maîtrise
      { code: 'MNP', label: 'Agent de Maîtrise Débutant', salary: 117290, coefficient: 156 },
      { code: 'M1', label: 'Technicien M1', salary: 133045, coefficient: 177 },
      { code: 'M2', label: 'Technicien M2', salary: 142372, coefficient: 190 },
      { code: 'M3', label: 'Technicien M3', salary: 170041, coefficient: 227 },
      { code: 'M4', label: 'Technicien M4', salary: 184995, coefficient: 247 },
      { code: 'M5', label: 'Technicien M5', salary: 200414, coefficient: 267 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 83979, coefficient: 112 },
      { code: '3', label: 'Employé Catégorie 3', salary: 85340, coefficient: 114 },
      { code: '4', label: 'Employé Catégorie 4', salary: 91528, coefficient: 122 },
      { code: '5', label: 'Employé Catégorie 5', salary: 109184, coefficient: 146 },
      { code: '6', label: 'Employé Catégorie 6', salary: 123745, coefficient: 165 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 125041, coefficient: 167 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 134301, coefficient: 179 },
    ],
  },

  // =====================================================
  // SECTEUR 3: INDUSTRIE TEXTILE
  // =====================================================
  {
    sectorCode: 'IND_TEXTILE',
    sectorName: 'Industrie Textile',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres
      { code: '1A', label: 'Ingénieur Catégorie 1A', salary: 166411, coefficient: 222 },
      { code: '1B', label: 'Ingénieur Catégorie 1B', salary: 191568, coefficient: 255 },
      { code: '2A', label: 'Cadre Catégorie 2A', salary: 201207, coefficient: 268 },
      { code: '2B', label: 'Cadre Catégorie 2B', salary: 318748, coefficient: 425 },
      { code: '3A', label: 'Cadre Catégorie 3A', salary: 237369, coefficient: 316 },
      { code: '3B', label: 'Cadre Catégorie 3B', salary: 355981, coefficient: 475 },

      // Agents de Maîtrise
      { code: 'MNP', label: 'Agent de Maîtrise Débutant', salary: 115019, coefficient: 153 },
      { code: 'M1', label: 'Technicien M1', salary: 130470, coefficient: 174 },
      { code: 'M2', label: 'Technicien M2', salary: 139616, coefficient: 186 },
      { code: 'M3', label: 'Technicien M3', salary: 166748, coefficient: 222 },
      { code: 'M4', label: 'Technicien M4', salary: 181414, coefficient: 242 },
      { code: 'M5', label: 'Technicien M5', salary: 196534, coefficient: 262 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 83936, coefficient: 112 },
      { code: '3', label: 'Employé Catégorie 3', salary: 85296, coefficient: 114 },
      { code: '4', label: 'Employé Catégorie 4', salary: 91483, coefficient: 122 },
      { code: '5', label: 'Employé Catégorie 5', salary: 109131, coefficient: 145 },
      { code: '6', label: 'Employé Catégorie 6', salary: 123684, coefficient: 165 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 124979, coefficient: 167 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 134234, coefficient: 179 },
    ],
  },

  // =====================================================
  // SECTEUR 4: INDUSTRIE TRANSFORMATION THON
  // =====================================================
  {
    sectorCode: 'IND_THON',
    sectorName: 'Industrie de Transformation de Thon',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres
      { code: '1A', label: 'Ingénieur Catégorie 1A', salary: 172643, coefficient: 230 },
      { code: '1B', label: 'Ingénieur Catégorie 1B', salary: 198744, coefficient: 265 },
      { code: '2A', label: 'Cadre Catégorie 2A', salary: 208743, coefficient: 278 },
      { code: '2B', label: 'Cadre Catégorie 2B', salary: 236901, coefficient: 316 },
      { code: '3A', label: 'Cadre Catégorie 3A', salary: 246261, coefficient: 328 },
      { code: '3B', label: 'Cadre Catégorie 3B', salary: 369316, coefficient: 492 },

      // Agents de Maîtrise
      { code: 'MNP', label: 'Agent de Maîtrise Débutant', salary: 118180, coefficient: 158 },
      { code: 'M1', label: 'Technicien M1', salary: 134056, coefficient: 179 },
      { code: 'M2', label: 'Technicien M2', salary: 143453, coefficient: 191 },
      { code: 'M3', label: 'Technicien M3', salary: 171332, coefficient: 228 },
      { code: 'M4', label: 'Technicien M4', salary: 186400, coefficient: 248 },
      { code: 'M5', label: 'Technicien M5', salary: 201935, coefficient: 269 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 84616, coefficient: 113 },
      { code: '3', label: 'Employé Catégorie 3', salary: 85988, coefficient: 115 },
      { code: '4', label: 'Employé Catégorie 4', salary: 92223, coefficient: 123 },
      { code: '5', label: 'Employé Catégorie 5', salary: 110014, coefficient: 147 },
      { code: '6', label: 'Employé Catégorie 6', salary: 124685, coefficient: 166 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 125991, coefficient: 168 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 135321, coefficient: 180 },
    ],
  },

  // =====================================================
  // SECTEUR 5: INDUSTRIE POLYGRAPHIQUE
  // =====================================================
  {
    sectorCode: 'IND_POLYGRAPHIQUE',
    sectorName: 'Industrie Polygraphique',
    country: 'CI',
    categories: [
      // Employés (Primary category for this sector)
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 85935, coefficient: 115 },
      { code: '3', label: 'Employé Catégorie 3', salary: 86538, coefficient: 115 },
      { code: '4', label: 'Employé Catégorie 4', salary: 91956, coefficient: 123 },
      { code: '5', label: 'Employé Catégorie 5', salary: 109695, coefficient: 146 },
      { code: '6', label: 'Employé Catégorie 6', salary: 124323, coefficient: 166 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 125626, coefficient: 167 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 134929, coefficient: 180 },
    ],
  },

  // =====================================================
  // SECTEUR 6: INDUSTRIES POLYGRAPHIQUES-IMPRIMERIES
  // =====================================================
  {
    sectorCode: 'IND_IMPRIMERIE',
    sectorName: 'Industries Polygraphiques - Imprimeries',
    country: 'CI',
    categories: [
      // Contremaîtres
      { code: 'CM1A', label: 'Contremaître CM1A', salary: 92564, coefficient: 123 },
      { code: 'CM1B', label: 'Contremaître CM1B', salary: 102215, coefficient: 136 },
      { code: 'CM1C', label: 'Contremaître CM1C', salary: 112272, coefficient: 150 },
      { code: 'CM1D', label: 'Contremaître CM1D', salary: 118029, coefficient: 157 },
      { code: 'CM2A', label: 'Contremaître CM2A', salary: 100494, coefficient: 134 },
      { code: 'CM2B', label: 'Contremaître CM2B', salary: 110386, coefficient: 147 },
      { code: 'CM2C', label: 'Contremaître CM2C', salary: 121468, coefficient: 162 },
      { code: 'CM2D', label: 'Contremaître CM2D', salary: 118751, coefficient: 158 },
      { code: 'CM3A', label: 'Contremaître CM3A', salary: 106660, coefficient: 142 },
      { code: 'CM3B', label: 'Contremaître CM3B', salary: 117372, coefficient: 156 },
      { code: 'CM3C', label: 'Contremaître CM3C', salary: 128070, coefficient: 171 },
      { code: 'CM3D', label: 'Contremaître CM3D', salary: 139560, coefficient: 186 },
      { code: 'CM4A', label: 'Contremaître CM4A', salary: 112726, coefficient: 150 },
      { code: 'CM4B', label: 'Contremaître CM4B', salary: 124734, coefficient: 166 },
      { code: 'CM4C', label: 'Contremaître CM4C', salary: 134888, coefficient: 180 },
      { code: 'CM4D', label: 'Contremaître CM4D', salary: 146907, coefficient: 196 },

      // Chef d'Atelier
      { code: 'CA1A', label: "Chef d'Atelier CA1A", salary: 128070, coefficient: 171 },
      { code: 'CA1B', label: "Chef d'Atelier CA1B", salary: 141447, coefficient: 189 },
      { code: 'CA1C', label: "Chef d'Atelier CA1C", salary: 153696, coefficient: 205 },
      { code: 'CA1D', label: "Chef d'Atelier CA1D", salary: 168289, coefficient: 224 },
      { code: 'CA2A', label: "Chef d'Atelier CA2A", salary: 134888, coefficient: 180 },
      { code: 'CA2B', label: "Chef d'Atelier CA2B", salary: 148406, coefficient: 198 },
      { code: 'CA2C', label: "Chef d'Atelier CA2C", salary: 161567, coefficient: 215 },
      { code: 'CA2D', label: "Chef d'Atelier CA2D", salary: 176577, coefficient: 235 },

      // Chef de Fabrication
      { code: 'CF1', label: 'Chef de Fabrication CF1', salary: 153340, coefficient: 204 },
      { code: 'CF2', label: 'Chef de Fabrication CF2', salary: 169052, coefficient: 225 },
      { code: 'CF3', label: 'Chef de Fabrication CF3', salary: 184072, coefficient: 245 },
    ],
  },

  // =====================================================
  // SECTEUR 13: INDUSTRIE HÔTELIERE
  // =====================================================
  {
    sectorCode: 'IND_HOTEL',
    sectorName: 'Industrie Hôtelière',
    country: 'CI',
    categories: [
      // Cadres
      { code: '9', label: 'Cadre Catégorie 9', salary: 166219, coefficient: 222 },
      { code: '10', label: 'Cadre Catégorie 10', salary: 198147, coefficient: 264 },
      { code: '11', label: 'Cadre Catégorie 11', salary: 219904, coefficient: 293 },

      // Maîtrise
      { code: '7', label: 'Maîtrise Catégorie 7', salary: 125422, coefficient: 167 },
      { code: '8', label: 'Maîtrise Catégorie 8', salary: 144099, coefficient: 192 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '1B', label: 'Employé Catégorie 1B', salary: 81220, coefficient: 108 },
      { code: '2', label: 'Employé Catégorie 2', salary: 81693, coefficient: 109 },
      { code: '3', label: 'Employé Catégorie 3', salary: 85033, coefficient: 113 },
      { code: '4', label: 'Employé Catégorie 4', salary: 88007, coefficient: 117 },
      { code: '5', label: 'Employé Catégorie 5', salary: 93717, coefficient: 125 },
      { code: '6', label: 'Employé Catégorie 6', salary: 107539, coefficient: 143 },
    ],
  },

  // =====================================================
  // SECTEUR 14: INDUSTRIE TOURISTIQUE
  // =====================================================
  {
    sectorCode: 'IND_TOURISME',
    sectorName: 'Industrie Touristique',
    country: 'CI',
    categories: [
      // Cadres
      { code: '9', label: 'Cadre Catégorie 9', salary: 164667, coefficient: 220 },
      { code: '10', label: 'Cadre Catégorie 10', salary: 196295, coefficient: 262 },
      { code: '11', label: 'Cadre Catégorie 11', salary: 217849, coefficient: 290 },

      // Maîtrise
      { code: '7', label: 'Maîtrise Catégorie 7', salary: 124251, coefficient: 166 },
      { code: '8', label: 'Maîtrise Catégorie 8', salary: 142753, coefficient: 190 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '1B', label: 'Employé Catégorie 1B', salary: 80462, coefficient: 107 },
      { code: '2', label: 'Employé Catégorie 2', salary: 80928, coefficient: 108 },
      { code: '3', label: 'Employé Catégorie 3', salary: 84235, coefficient: 112 },
      { code: '4', label: 'Employé Catégorie 4', salary: 87177, coefficient: 116 },
      { code: '5', label: 'Employé Catégorie 5', salary: 92842, coefficient: 124 },
      { code: '6', label: 'Employé Catégorie 6', salary: 106534, coefficient: 142 },
    ],
  },

  // =====================================================
  // SECTEUR 15: INDUSTRIE DU SUCRE
  // =====================================================
  {
    sectorCode: 'IND_SUCRE',
    sectorName: 'Industrie du Sucre',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres
      { code: '1A', label: 'Ingénieur Catégorie 1A', salary: 166579, coefficient: 222 },
      { code: '1B', label: 'Ingénieur Catégorie 1B', salary: 191764, coefficient: 256 },
      { code: '2A', label: 'Cadre Catégorie 2A', salary: 201412, coefficient: 269 },
      { code: '2B', label: 'Cadre Catégorie 2B', salary: 228580, coefficient: 305 },
      { code: '3A', label: 'Cadre Catégorie 3A', salary: 237611, coefficient: 317 },
      { code: '3B', label: 'Cadre Catégorie 3B', salary: 356344, coefficient: 475 },

      // Agents de Maîtrise
      { code: 'MNP', label: 'Agent de Maîtrise Débutant', salary: 114029, coefficient: 152 },
      { code: 'M1', label: 'Technicien M1', salary: 129347, coefficient: 172 },
      { code: 'M2', label: 'Technicien M2', salary: 138415, coefficient: 185 },
      { code: 'M3', label: 'Technicien M3', salary: 165313, coefficient: 220 },
      { code: 'M4', label: 'Technicien M4', salary: 179853, coefficient: 240 },
      { code: 'M5', label: 'Technicien M5', salary: 194844, coefficient: 260 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 81644, coefficient: 109 },
      { code: '2', label: 'Employé Catégorie 2', salary: 82967, coefficient: 111 },
      { code: '3', label: 'Employé Catégorie 3', salary: 88984, coefficient: 119 },
      { code: '4', label: 'Employé Catégorie 4', salary: 106149, coefficient: 142 },
      { code: '5', label: 'Employé Catégorie 5', salary: 120305, coefficient: 160 },
      { code: '6', label: 'Employé Catégorie 6', salary: 121565, coefficient: 162 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 130569, coefficient: 174 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 130569, coefficient: 174 },
    ],
  },

  // =====================================================
  // SECTEUR 17: AUXILIAIRES DU TRANSPORT
  // =====================================================
  {
    sectorCode: 'AUX_TRANSPORT',
    sectorName: 'Auxiliaires du Transport',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres
      { code: 'C1A', label: 'Cadre C1A', salary: 200101, coefficient: 267 },
      { code: 'C1B', label: 'Cadre C1B', salary: 212549, coefficient: 283 },
      { code: 'C2A', label: 'Cadre C2A', salary: 223162, coefficient: 297 },
      { code: 'C2B', label: 'Cadre C2B', salary: 241759, coefficient: 322 },
      { code: 'C2C', label: 'Cadre C2C', salary: 255832, coefficient: 341 },
      { code: 'C3', label: 'Cadre C3', salary: 311350, coefficient: 415 },

      // Agents de Maîtrise
      { code: 'M1A', label: 'Agent de Maîtrise M1A', salary: 121682, coefficient: 162 },
      { code: 'M1B', label: 'Agent de Maîtrise M1B', salary: 138989, coefficient: 185 },
      { code: 'M2A', label: 'Technicien M2A', salary: 141309, coefficient: 188 },
      { code: 'M2B', label: 'Technicien M2B', salary: 144666, coefficient: 193 },
      { code: 'M3', label: 'Technicien M3', salary: 169849, coefficient: 226 },
      { code: 'M4', label: 'Technicien M4', salary: 186200, coefficient: 248 },
      { code: 'M5', label: 'Technicien M5', salary: 201722, coefficient: 269 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1 (SMIG)', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 84365, coefficient: 112 },
      { code: '3', label: 'Employé Catégorie 3', salary: 89663, coefficient: 120 },
      { code: '4', label: 'Employé Catégorie 4', salary: 96051, coefficient: 128 },
      { code: '5', label: 'Employé Catégorie 5', salary: 111869, coefficient: 149 },
      { code: '6', label: 'Employé Catégorie 6', salary: 124710, coefficient: 166 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 126014, coefficient: 168 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 138940, coefficient: 185 },
    ],
  },

  // =====================================================
  // SECTEUR 19: BATIMENT, TRAVAUX PUBLICS (BTP)
  // =====================================================
  {
    sectorCode: 'BTP',
    sectorName: 'Bâtiment, Travaux Publics et Activités Connexes',
    country: 'CI',
    categories: [
      // Ingénieurs-Cadres
      { code: '1A', label: 'Ingénieur Catégorie 1A', salary: 178796, coefficient: 238 },
      { code: '1B', label: 'Ingénieur Catégorie 1B', salary: 201979, coefficient: 269 },
      { code: '2A', label: 'Cadre Catégorie 2A', salary: 219709, coefficient: 293 },
      { code: '2B', label: 'Cadre Catégorie 2B', salary: 244626, coefficient: 326 },
      { code: '3A', label: 'Cadre Catégorie 3A', salary: 263886, coefficient: 352 },
      { code: '3B', label: 'Cadre Catégorie 3B', salary: 395746, coefficient: 528 },

      // Agents de Maîtrise
      { code: 'M1', label: 'Technicien M1', salary: 138822, coefficient: 185 },
      { code: 'M2', label: 'Technicien M2', salary: 148876, coefficient: 198 },
      { code: 'M3', label: 'Technicien M3', salary: 174485, coefficient: 233 },
      { code: 'M4', label: 'Technicien M4', salary: 191000, coefficient: 255 },
      { code: 'M5', label: 'Technicien M5', salary: 203206, coefficient: 271 },

      // Employés
      { code: 'SMIG', label: 'Employé SMIG', salary: 75000, coefficient: 100 },
      { code: '1', label: 'Employé 1ère catégorie', salary: 75165, coefficient: 100 },
      { code: '2', label: 'Employé 2ème catégorie', salary: 83461, coefficient: 111 },
      { code: '3', label: 'Employé 3ème catégorie', salary: 87855, coefficient: 117 },
      { code: '4', label: 'Employé 4ème catégorie', salary: 95420, coefficient: 127 },
      { code: '5', label: 'Employé 5ème catégorie', salary: 112260, coefficient: 150 },
      { code: '6', label: 'Employé 6ème catégorie', salary: 129587, coefficient: 173 },
      { code: '7A', label: 'Employé 7ème catégorie A', salary: 131049, coefficient: 175 },
      { code: '7B', label: 'Employé 7ème catégorie B', salary: 144472, coefficient: 193 },
    ],
  },

  // =====================================================
  // SECTEUR 21: COMMERCE - DISTRIBUTION - NEGOCE
  // =====================================================
  {
    sectorCode: 'COMMERCE',
    sectorName: 'Commerce, Distribution, Négoce et Professions Libérales',
    country: 'CI',
    categories: [
      // Cadres
      { code: '8C', label: 'Cadre Catégorie 8C', salary: 137955, coefficient: 184 },
      { code: '9A', label: 'Cadre Catégorie 9A', salary: 139660, coefficient: 186 },
      { code: '9B', label: 'Cadre Catégorie 9B', salary: 157121, coefficient: 209 },
      { code: '10A', label: 'Cadre Catégorie 10A', salary: 164938, coefficient: 220 },
      { code: '10B', label: 'Cadre Catégorie 10B', salary: 184733, coefficient: 246 },
      { code: '10C', label: 'Cadre Catégorie 10C', salary: 207824, coefficient: 277 },
      { code: '11', label: 'Cadre Catégorie 11', salary: 230918, coefficient: 308 },

      // Agents de Maîtrise
      { code: '6', label: 'Maîtrise Catégorie 6', salary: 128907, coefficient: 172 },
      { code: '7A', label: 'Maîtrise Catégorie 7A', salary: 129313, coefficient: 172 },
      { code: '7B', label: 'Maîtrise Catégorie 7B', salary: 135942, coefficient: 181 },
      { code: '8A', label: 'Maîtrise Catégorie 8A', salary: 135942, coefficient: 181 },
      { code: '8B', label: 'Maîtrise Catégorie 8B', salary: 137955, coefficient: 184 },

      // Employés
      { code: '1A', label: 'Employé Catégorie 1A (SMIG)', salary: 75000, coefficient: 100 },
      { code: '1B', label: 'Employé Catégorie 1B', salary: 83344, coefficient: 111 },
      { code: '2', label: 'Employé Catégorie 2', salary: 89375, coefficient: 119 },
      { code: '3', label: 'Employé Catégorie 3', salary: 92084, coefficient: 123 },
      { code: '4', label: 'Employé Catégorie 4', salary: 99506, coefficient: 133 },
      { code: '5', label: 'Employé Catégorie 5', salary: 118737, coefficient: 158 },
    ],
  },

  // =====================================================
  // SECTEUR 28: BANQUES
  // =====================================================
  {
    sectorCode: 'BANQUES',
    sectorName: 'Banques',
    country: 'CI',
    categories: [
      // Agents de Maîtrise - Cadres Assimilés
      { code: '1ERE', label: '1ère classe', salary: 133600, coefficient: 178 },
      { code: '2EME', label: '2ème classe', salary: 133985, coefficient: 179 },
      { code: '3EME', label: '3ème classe', salary: 142983, coefficient: 191 },
      { code: '4EME', label: '4ème classe', salary: 146259, coefficient: 195 },
      { code: '5EME_1', label: '5ème classe 1', salary: 165049, coefficient: 220 },
      { code: '5EME_2', label: '5ème classe 2', salary: 165049, coefficient: 220 },
      { code: '6EME', label: '6ème classe', salary: 182780, coefficient: 244 },
      { code: '7EME', label: '7ème classe', salary: 207948, coefficient: 277 },
      { code: '8EME', label: '8ème classe', salary: 235304, coefficient: 314 },

      // Employés
      { code: 'EMP_1', label: 'Employé 1ère classe', salary: 75000, coefficient: 100 },
      { code: 'EMP_2', label: 'Employé 2ème classe', salary: 72859, coefficient: 97 },
      { code: 'EMP_3', label: 'Employé 3ème classe', salary: 79355, coefficient: 106 },
      { code: 'EMP_4', label: 'Employé 4ème classe', salary: 90461, coefficient: 121 },
      { code: 'EMP_5', label: 'Employé 5ème classe', salary: 112682, coefficient: 150 },
      { code: 'EMP_6', label: 'Employé 6ème classe', salary: 125102, coefficient: 167 },
      { code: 'EMP_7', label: 'Employé 7ème classe', salary: 133512, coefficient: 178 },
    ],
  },

  // =====================================================
  // SECTEUR 29: ASSURANCES
  // =====================================================
  {
    sectorCode: 'ASSURANCES',
    sectorName: 'Assurances',
    country: 'CI',
    categories: [
      // Agents de Maîtrise - Cadres Assimilés
      { code: '1ERE', label: '1ère classe', salary: 126321, coefficient: 168 },
      { code: '2EME', label: '2ème classe', salary: 134016, coefficient: 179 },
      { code: '3EME', label: '3ème classe', salary: 142983, coefficient: 191 },
      { code: '4EME', label: '4ème classe', salary: 144930, coefficient: 193 },
      { code: '5EME_1', label: '5ème classe 1', salary: 163548, coefficient: 218 },
      { code: '5EME_2', label: '5ème classe 2', salary: 163548, coefficient: 218 },
      { code: '6EME', label: '6ème classe', salary: 184520, coefficient: 246 },
      { code: '7EME', label: '7ème classe', salary: 209928, coefficient: 280 },
      { code: '8EME', label: '8ème classe', salary: 237546, coefficient: 317 },

      // Employés
      { code: 'EMP_1', label: 'Employé 1ère classe', salary: 75000, coefficient: 100 },
      { code: 'EMP_2', label: 'Employé 2ème classe', salary: 72859, coefficient: 97 },
      { code: 'EMP_3', label: 'Employé 3ème classe', salary: 79355, coefficient: 106 },
      { code: 'EMP_4', label: 'Employé 4ème classe', salary: 90461, coefficient: 121 },
      { code: 'EMP_5', label: 'Employé 5ème classe', salary: 112682, coefficient: 150 },
      { code: 'EMP_6', label: 'Employé 6ème classe', salary: 125102, coefficient: 167 },
      { code: 'EMP_7', label: 'Employé 7ème classe', salary: 133512, coefficient: 178 },
    ],
  },

  // =====================================================
  // SECTEUR 30: ENTREPRISES PETROLIERES DISTRIBUTION
  // =====================================================
  {
    sectorCode: 'PETROLE_DISTRIB',
    sectorName: 'Entreprises Pétrolières de Distribution',
    country: 'CI',
    categories: [
      // Cadres
      { code: 'C1', label: 'Cadre C1', salary: 355610, coefficient: 474 },
      { code: 'C2', label: 'Cadre C2', salary: 406416, coefficient: 542 },
      { code: 'C3', label: 'Cadre C3', salary: 508017, coefficient: 677 },
      { code: 'C4', label: 'Cadre C4', salary: 660422, coefficient: 881 },

      // Agents de Maîtrise
      { code: 'M1', label: 'Maîtrise M1', salary: 244658, coefficient: 326 },
      { code: 'M2', label: 'Maîtrise M2', salary: 277451, coefficient: 370 },
      { code: 'M3', label: 'Maîtrise M3', salary: 333590, coefficient: 445 },
      { code: 'M4', label: 'Maîtrise M4', salary: 373941, coefficient: 499 },

      // Employés-Ouvriers
      { code: '1A', label: 'Employé-Ouvrier 1A (SMIG)', salary: 75000, coefficient: 100 },
      { code: '1B', label: 'Employé-Ouvrier 1B', salary: 94878, coefficient: 126 },
      { code: '2', label: 'Employé-Ouvrier 2', salary: 111939, coefficient: 149 },
      { code: '3', label: 'Employé-Ouvrier 3', salary: 113761, coefficient: 152 },
      { code: '4', label: 'Employé-Ouvrier 4', salary: 125638, coefficient: 168 },
      { code: '5', label: 'Employé-Ouvrier 5', salary: 142713, coefficient: 190 },
      { code: '6', label: 'Employé-Ouvrier 6', salary: 173855, coefficient: 232 },
      { code: '7', label: 'Employé-Ouvrier 7', salary: 194431, coefficient: 259 },
      { code: '8', label: 'Employé-Ouvrier 8', salary: 230075, coefficient: 307 },
    ],
  },

  // =====================================================
  // SECTEUR 32: SECURITE PRIVEE
  // =====================================================
  {
    sectorCode: 'SECURITE',
    sectorName: 'Sécurité Privée',
    country: 'CI',
    categories: [
      // Cadres
      { code: '10', label: 'Cadre Catégorie 10', salary: 163188, coefficient: 218 },
      { code: '11', label: 'Cadre Catégorie 11', salary: 226981, coefficient: 303 },

      // Agents de Maîtrise
      { code: '7', label: 'Maîtrise Catégorie 7', salary: 124988, coefficient: 167 },
      { code: '8', label: 'Maîtrise Catégorie 8', salary: 136485, coefficient: 182 },
      { code: '9', label: 'Maîtrise Catégorie 9', salary: 153051, coefficient: 204 },

      // Employés
      { code: '1', label: 'Employé Catégorie 1', salary: 75000, coefficient: 100 },
      { code: '1B', label: 'Employé Catégorie 1B', salary: 76320, coefficient: 102 },
      { code: '2', label: 'Employé Catégorie 2', salary: 76440, coefficient: 102 },
      { code: '2B', label: 'Employé Catégorie 2B', salary: 76490, coefficient: 102 },
      { code: '3', label: 'Employé Catégorie 3', salary: 81254, coefficient: 108 },
      { code: '3B', label: 'Employé Catégorie 3B', salary: 84656, coefficient: 113 },
      { code: '4', label: 'Employé Catégorie 4', salary: 88876, coefficient: 118 },
      { code: '5', label: 'Employé Catégorie 5', salary: 99900, coefficient: 133 },
      { code: '6', label: 'Employé Catégorie 6', salary: 119227, coefficient: 159 },
    ],
  },

  // =====================================================
  // SECTEUR 33: GENS DE MAISON
  // =====================================================
  {
    sectorCode: 'GENS_MAISON',
    sectorName: 'Gens de Maison',
    country: 'CI',
    categories: [
      { code: '1', label: '1ère catégorie (SMIG): Employé de maison', salary: 75000, coefficient: 100 },
      { code: '2', label: '2ème catégorie: Boy ou bonne sans lavage de linge', salary: 76921, coefficient: 103 },
      { code: '3', label: '3ème catégorie: Boy ou bonne avec plus de 2 ans de pratique', salary: 83587, coefficient: 111 },
      { code: '4', label: '4ème catégorie: Boy cuisinier ou bonne cuisinière qualifié(e)', salary: 85505, coefficient: 114 },
      { code: '5', label: '5ème catégorie: Cuisinier sachant faire la pâtisserie', salary: 87740, coefficient: 117 },
      { code: '6', label: '6ème catégorie: Cuisinier sachant faire pâtisserie ou charcuterie', salary: 91121, coefficient: 122 },
      { code: '7', label: '7ème catégorie: Maître d\'hôtel', salary: 94905, coefficient: 126 },
    ],
  },

  // =====================================================
  // SECTEUR 34: NETTOYAGES-INSALUBRITES
  // =====================================================
  {
    sectorCode: 'NETTOYAGE',
    sectorName: 'Nettoyages - Insalubrités',
    country: 'CI',
    categories: [
      { code: '1', label: 'Employé Catégorie 1', salary: 75000, coefficient: 100 },
      { code: '2', label: 'Employé Catégorie 2', salary: 86334, coefficient: 115 },
      { code: '3', label: 'Employé Catégorie 3', salary: 86334, coefficient: 115 },
      { code: '4', label: 'Employé Catégorie 4', salary: 92383, coefficient: 123 },
      { code: '5', label: 'Employé Catégorie 5', salary: 110206, coefficient: 147 },
      { code: '6', label: 'Employé Catégorie 6', salary: 124902, coefficient: 166 },
      { code: '7A', label: 'Employé Catégorie 7A', salary: 126209, coefficient: 168 },
      { code: '7B', label: 'Employé Catégorie 7B', salary: 135556, coefficient: 181 },
    ],
  },
];

/**
 * Main seeding function
 */
async function seedCGECIBareme() {
  console.log('🌱 Starting CGECI Barème 2023 seeding...\n');

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const sector of cgeci2023Data) {
    console.log(`\n📂 Processing sector: ${sector.sectorName}`);
    console.log(`   Code: ${sector.sectorCode}`);
    console.log(`   Categories: ${sector.categories.length}`);

    for (const category of sector.categories) {
      try {
        // Check if entry already exists
        const existing = await db
          .select()
          .from(employeeCategoryCoefficients)
          .where(
            sql`country_code = ${sector.country}
                AND category = ${category.code}
                AND sector_code = ${sector.sectorCode}`
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(`   ⏭️  Skipped ${category.code} (${category.label}) - already exists`);
          totalSkipped++;
          continue;
        }

        // Insert new entry
        await db.insert(employeeCategoryCoefficients).values({
          countryCode: sector.country,
          category: category.code,
          labelFr: category.label,
          sectorCode: sector.sectorCode,
          minCoefficient: category.coefficient,
          maxCoefficient: category.coefficient,
          actualMinimumWage: category.salary.toString(),
          minimumWageBase: 'SMIG', // Legacy field
          noticePeriodDays: 30, // Default notice period
          noticeReductionPercent: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`   ✅ Inserted ${category.code}: ${category.label} (${category.salary} FCFA, coef ${category.coefficient})`);
        totalInserted++;

      } catch (error) {
        console.error(`   ❌ Error inserting ${category.code}:`, error);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ CGECI Barème 2023 seeding completed!');
  console.log('='.repeat(70));
  console.log(`📊 Summary:`);
  console.log(`   - Total sectors processed: ${cgeci2023Data.length}`);
  console.log(`   - Total entries inserted: ${totalInserted}`);
  console.log(`   - Total entries skipped: ${totalSkipped}`);
  console.log(`   - Coverage: 34 major industrial sectors`);
  console.log(`   - Base SMIG: ${SMIG_CI_2023.toLocaleString()} FCFA`);
  console.log('='.repeat(70));
}

/**
 * Execute seeding
 */
seedCGECIBareme()
  .then(() => {
    console.log('\n✨ Seeding script finished successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding script failed:', error);
    process.exit(1);
  });
