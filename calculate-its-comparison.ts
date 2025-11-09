/**
 * Comparaison du calcul ITS pour un journalier
 *
 * Données:
 * - Salaire catégoriel (brut de base): 20,600 FCFA
 * - Prime de gratification: 1,288 FCFA
 * - Provision congés payés: 2,222 FCFA
 * - Indemnité de précarité: 723 FCFA
 * - Prime de transport: 5,770 FCFA
 * - Parts fiscales: 1
 */

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  CALCUL ITS JOURNALIER - COMPARAISON');
console.log('═══════════════════════════════════════════════════════════\n');

// Données
const brutBase = 20_600; // Salaire de base (avant CDDTI components)
const gratification = 1_288;
const congesPayes = 2_222;
const precarite = 723;
const transport = 5_770;
const fiscalParts = 1.0;

console.log('DONNÉES:');
console.log(`  Salaire catégoriel (base): ${brutBase.toLocaleString()} FCFA`);
console.log(`  Gratification:             ${gratification.toLocaleString()} FCFA`);
console.log(`  Congés payés:              ${congesPayes.toLocaleString()} FCFA`);
console.log(`  Indemnité de précarité:    ${precarite.toLocaleString()} FCFA`);
console.log(`  Transport:                 ${transport.toLocaleString()} FCFA`);
console.log(`  Parts fiscales:            ${fiscalParts}\n`);

// Calcul du nombre de jours travaillés (à partir du transport)
// Transport Abidjan = 1,154 FCFA/jour
const transportDailyRate = 1_154;
const daysWorked = Math.round(transport / transportDailyRate);

console.log('NOMBRE DE JOURS TRAVAILLÉS:');
console.log(`  Transport journalier: ${transportDailyRate.toLocaleString()} FCFA/jour`);
console.log(`  Jours travaillés: ${transport.toLocaleString()} ÷ ${transportDailyRate.toLocaleString()} = ${daysWorked} jours\n`);

// Barème journalier ITS (mensuel ÷ 30)
const dailyBrackets = [
  { min: 0, max: 2_500, rate: 0 },
  { min: 2_501, max: 8_000, rate: 0.16 },
  { min: 8_001, max: 26_667, rate: 0.21 },
  { min: 26_668, max: 80_000, rate: 0.24 },
  { min: 80_001, max: 266_667, rate: 0.28 },
  { min: 266_668, max: Infinity, rate: 0.32 },
];

// Réduction familiale mensuelle
const monthlyFamilyDeductions: Record<number, number> = {
  1: 0,
  1.5: 5_500,
  2: 11_000,
  2.5: 16_500,
  3: 22_000,
  3.5: 27_500,
  4: 33_000,
  4.5: 38_500,
  5: 44_000,
};

const monthlyDeduction = monthlyFamilyDeductions[fiscalParts] || 0;
const dailyDeduction = Math.round(monthlyDeduction / 30);

console.log('═══════════════════════════════════════════════════════════');
console.log('MÉTHODE 1: NOTRE IMPLÉMENTATION (payroll-calculation-v2.ts)');
console.log('═══════════════════════════════════════════════════════════\n');

// Notre implémentation:
// Base imposable = brutBase (salaire de base AVANT CDDTI components)
// Équivalent days = jours travaillés
const taxBase1 = brutBase;
const equivalentDays1 = daysWorked;
const dailyGross1 = taxBase1 / equivalentDays1;

console.log('ÉTAPE 1: Base imposable');
console.log(`  Base imposable: ${taxBase1.toLocaleString()} FCFA (brutBase uniquement)`);
console.log(`  Équivalent days: ${equivalentDays1} jours`);
console.log(`  Salaire journalier: ${taxBase1.toLocaleString()} ÷ ${equivalentDays1} = ${dailyGross1.toLocaleString('fr-FR', {maximumFractionDigits: 2})} FCFA/jour\n`);

console.log('ÉTAPE 2: Calcul impôt par tranche journalière');
let dailyTax1 = 0;
let remainingIncome1 = dailyGross1;

for (const bracket of dailyBrackets) {
  if (remainingIncome1 <= 0) break;

  const bracketMin = bracket.min;
  const bracketMax = bracket.max === Infinity ? dailyGross1 : Math.min(bracket.max, dailyGross1);

  if (dailyGross1 > bracketMin) {
    const taxableInBracket = Math.min(remainingIncome1, bracketMax - bracketMin);
    const taxInBracket = taxableInBracket * bracket.rate;

    if (taxInBracket > 0) {
      console.log(`  Tranche ${bracketMin.toLocaleString()}-${bracket.max === Infinity ? '∞' : bracketMax.toLocaleString()}: ${taxableInBracket.toLocaleString('fr-FR', {maximumFractionDigits: 2})} × ${(bracket.rate * 100).toFixed(0)}% = ${taxInBracket.toLocaleString('fr-FR', {maximumFractionDigits: 2})} FCFA`);
    }

    dailyTax1 += taxInBracket;
    remainingIncome1 -= taxableInBracket;
  }
}

console.log(`\n  Impôt journalier: ${dailyTax1.toLocaleString('fr-FR', {maximumFractionDigits: 2})} FCFA/jour`);

const grossTax1 = Math.round(dailyTax1 * equivalentDays1);
console.log(`  Impôt brut: ${dailyTax1.toLocaleString('fr-FR', {maximumFractionDigits: 2})} × ${equivalentDays1} jours = ${grossTax1.toLocaleString()} FCFA\n`);

console.log('ÉTAPE 3: Réduction familiale');
console.log(`  Parts fiscales: ${fiscalParts}`);
console.log(`  Réduction mensuelle: ${monthlyDeduction.toLocaleString()} FCFA`);
console.log(`  Réduction journalière: ${monthlyDeduction.toLocaleString()} ÷ 30 = ${dailyDeduction.toLocaleString()} FCFA/jour`);
const totalDeduction1 = dailyDeduction * equivalentDays1;
console.log(`  Réduction totale: ${dailyDeduction.toLocaleString()} × ${equivalentDays1} jours = ${totalDeduction1.toLocaleString()} FCFA\n`);

const netITS1 = Math.max(0, grossTax1 - totalDeduction1);
console.log('ÉTAPE 4: ITS net à payer');
console.log(`  ITS net: ${grossTax1.toLocaleString()} - ${totalDeduction1.toLocaleString()} = ${netITS1.toLocaleString()} FCFA\n`);

console.log('═══════════════════════════════════════════════════════════');
console.log('MÉTHODE 2: SELON LE GUIDE OFFICIEL');
console.log('═══════════════════════════════════════════════════════════\n');

// Selon le document officiel ligne 29:
// SALAIRE BRUT = Base + Gratification + Congés + Précarité (SANS transport)
// Transport est ajouté APRÈS le salaire brut
const totalBrut2 = brutBase + gratification + congesPayes + precarite;
const equivalentDays2 = daysWorked;
const dailyGross2 = totalBrut2 / equivalentDays2;

console.log('ÉTAPE 1: Base imposable');
console.log(`  Salaire brut: ${brutBase.toLocaleString()} + ${gratification.toLocaleString()} + ${congesPayes.toLocaleString()} + ${precarite.toLocaleString()} = ${totalBrut2.toLocaleString()} FCFA`);
console.log(`  Jours travaillés: ${equivalentDays2} jours`);
console.log(`  Salaire journalier: ${totalBrut2.toLocaleString()} ÷ ${equivalentDays2} = ${dailyGross2.toLocaleString('fr-FR', {maximumFractionDigits: 2})} FCFA/jour\n`);

console.log('ÉTAPE 2: Calcul impôt par tranche journalière');
let dailyTax2 = 0;
let remainingIncome2 = dailyGross2;

for (const bracket of dailyBrackets) {
  if (remainingIncome2 <= 0) break;

  const bracketMin = bracket.min;
  const bracketMax = bracket.max === Infinity ? dailyGross2 : Math.min(bracket.max, dailyGross2);

  if (dailyGross2 > bracketMin) {
    const taxableInBracket = Math.min(remainingIncome2, bracketMax - bracketMin);
    const taxInBracket = taxableInBracket * bracket.rate;

    if (taxInBracket > 0) {
      console.log(`  Tranche ${bracketMin.toLocaleString()}-${bracket.max === Infinity ? '∞' : bracketMax.toLocaleString()}: ${taxableInBracket.toLocaleString('fr-FR', {maximumFractionDigits: 2})} × ${(bracket.rate * 100).toFixed(0)}% = ${taxInBracket.toLocaleString('fr-FR', {maximumFractionDigits: 2})} FCFA`);
    }

    dailyTax2 += taxInBracket;
    remainingIncome2 -= taxableInBracket;
  }
}

console.log(`\n  Impôt journalier: ${dailyTax2.toLocaleString('fr-FR', {maximumFractionDigits: 2})} FCFA/jour`);

const grossTax2 = Math.round(dailyTax2 * equivalentDays2);
console.log(`  Impôt brut: ${dailyTax2.toLocaleString('fr-FR', {maximumFractionDigits: 2})} × ${equivalentDays2} jours = ${grossTax2.toLocaleString()} FCFA\n`);

console.log('ÉTAPE 3: Réduction familiale');
console.log(`  Parts fiscales: ${fiscalParts}`);
console.log(`  Réduction mensuelle: ${monthlyDeduction.toLocaleString()} FCFA`);
console.log(`  Réduction journalière: ${dailyDeduction.toLocaleString()} FCFA/jour`);
const totalDeduction2 = dailyDeduction * equivalentDays2;
console.log(`  Réduction totale: ${dailyDeduction.toLocaleString()} × ${equivalentDays2} jours = ${totalDeduction2.toLocaleString()} FCFA\n`);

const netITS2 = Math.max(0, grossTax2 - totalDeduction2);
console.log('ÉTAPE 4: ITS net à payer');
console.log(`  ITS net: ${grossTax2.toLocaleString()} - ${totalDeduction2.toLocaleString()} = ${netITS2.toLocaleString()} FCFA\n`);

console.log('═══════════════════════════════════════════════════════════');
console.log('COMPARAISON FINALE');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('| Méthode | Base imposable | Salaire/jour | Impôt brut | Réduction | ITS net |');
console.log('|---------|----------------|--------------|------------|-----------|---------|');
console.log(`| Notre implémentation | ${taxBase1.toLocaleString()} FCFA | ${dailyGross1.toFixed(2)} F | ${grossTax1.toLocaleString()} FCFA | ${totalDeduction1.toLocaleString()} FCFA | **${netITS1.toLocaleString()} FCFA** |`);
console.log(`| Guide officiel | ${totalBrut2.toLocaleString()} FCFA | ${dailyGross2.toFixed(2)} F | ${grossTax2.toLocaleString()} FCFA | ${totalDeduction2.toLocaleString()} FCFA | **${netITS2.toLocaleString()} FCFA** |`);
console.log(`| Différence | ${(totalBrut2 - taxBase1).toLocaleString()} FCFA | ${(dailyGross2 - dailyGross1).toFixed(2)} F | ${(grossTax2 - grossTax1).toLocaleString()} FCFA | 0 FCFA | **${(netITS2 - netITS1).toLocaleString()} FCFA** |\n`);

if (netITS1 !== netITS2) {
  console.log('⚠️  PROBLÈME DÉTECTÉ:');
  console.log(`    Notre implémentation calcule l'ITS sur brutBase uniquement (${taxBase1.toLocaleString()} FCFA)`);
  console.log(`    Le guide officiel calcule sur le SALAIRE BRUT incluant TOUS les CDDTI components (${totalBrut2.toLocaleString()} FCFA)`);
  console.log(`    Base imposable correcte = Base + Gratification + Congés + Précarité (SANS transport)`);
  console.log(`    Différence d'ITS: ${Math.abs(netITS2 - netITS1).toLocaleString()} FCFA`);
  console.log(`    ${netITS1 < netITS2 ? 'Sous-taxation' : 'Sur-taxation'} de ${((Math.abs(netITS2 - netITS1) / netITS2) * 100).toFixed(1)}%\n`);
} else {
  console.log('✅ Les deux méthodes donnent le même résultat!\n');
}

console.log('═══════════════════════════════════════════════════════════\n');
