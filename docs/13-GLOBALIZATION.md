# 🌍 Globalization & Multi-Country Support

## Document Overview

**Purpose:** Define multi-country, multi-currency, and localization strategies for expanding across West African markets.

**Target Countries (Phase 1-3):**
- 🇨🇮 Côte d'Ivoire (MVP - P0)
- 🇸🇳 Senegal (Phase 2 - P1)
- 🇧🇫 Burkina Faso (Phase 2 - P1)
- 🇲🇱 Mali (Phase 3 - P2)
- 🇧🇯 Benin (Phase 3 - P2)
- 🇹🇬 Togo (Phase 3 - P2)
- 🇬🇳 Guinea (Phase 3 - P2)

**Related Documents:**
- `multi-country-payroll-architecture.md` - Country configuration architecture
- `01-CONSTRAINTS-AND-RULES.md` - Technical constraints
- `03-DATABASE-SCHEMA.md` - Multi-country tables

---

## Multi-Currency Strategy

### Currency Zones

**UEMOA Countries (West African CFA Franc - XOF):**
- Côte d'Ivoire
- Senegal
- Burkina Faso
- Mali
- Benin
- Togo

**Non-UEMOA Countries:**
- Guinea (GNF - Guinean Franc)

### Currency Configuration

```typescript
type CurrencyConfig = {
  code: string; // ISO 4217 (e.g., 'XOF', 'GNF')
  name: string;
  symbol: string;
  decimalPlaces: number;
  locale: string; // For number formatting
};

const supportedCurrencies: CurrencyConfig[] = [
  {
    code: 'XOF',
    name: 'Franc CFA (BCEAO)',
    symbol: 'FCFA',
    decimalPlaces: 0, // XOF doesn't use decimals
    locale: 'fr-CI',
  },
  {
    code: 'GNF',
    name: 'Franc Guinéen',
    symbol: 'FG',
    decimalPlaces: 0,
    locale: 'fr-GN',
  },
];
```

### Currency Display Rules

```typescript
// Currency formatting by locale
function formatCurrency(amount: number, currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'XOF' ? 0 : 0,
    maximumFractionDigits: currency === 'XOF' ? 0 : 0,
  });

  return formatter.format(amount);
}

// Examples:
// formatCurrency(300000, 'XOF', 'fr-CI') → "300 000 FCFA"
// formatCurrency(1500000, 'GNF', 'fr-GN') → "1 500 000 FG"
```

**Display Rules:**
- Always show currency symbol (FCFA, FG)
- Use space as thousand separator (300 000 not 300,000)
- No decimal places for XOF and GNF
- Right-to-left languages: symbol before amount

---

## Localization (i18n)

### Supported Locales

```typescript
type SupportedLocale =
  | 'fr-CI'  // French (Côte d'Ivoire)
  | 'fr-SN'  // French (Senegal)
  | 'fr-BF'  // French (Burkina Faso)
  | 'fr-ML'  // French (Mali)
  | 'fr-BJ'  // French (Benin)
  | 'fr-TG'  // French (Togo)
  | 'fr-GN'; // French (Guinea)

const localeConfig: Record<SupportedLocale, LocaleSettings> = {
  'fr-CI': {
    language: 'fr',
    region: 'CI',
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    firstDayOfWeek: 1, // Monday
  },
  'fr-SN': {
    language: 'fr',
    region: 'SN',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    firstDayOfWeek: 1,
  },
  // ... other locales
};
```

### Translation Architecture

**Framework:** next-intl (Next.js 15 App Router)

**Folder Structure:**
```
messages/
├── fr-CI.json         # Côte d'Ivoire specific
├── fr-SN.json         # Senegal specific
├── fr-common.json     # Shared French terms
└── en.json            # English (admin only)
```

**Translation File Example (`fr-CI.json`):**
```json
{
  "common": {
    "currency": "FCFA",
    "loading": "Chargement...",
    "save": "Enregistrer",
    "cancel": "Annuler"
  },
  "payroll": {
    "gross_salary": "Salaire brut",
    "net_salary": "Salaire net",
    "cnps": "CNPS",
    "its": "ITS",
    "smig": "SMIG"
  },
  "employee": {
    "hire_date": "Date d'embauche",
    "contract_type": {
      "cdi": "CDI",
      "cdd": "CDD",
      "ctt": "Contrat temporaire"
    }
  },
  "validation": {
    "salary_below_minimum": "Le salaire doit être au moins égal au SMIG ({{smig}} FCFA)"
  }
}
```

**Usage in Components:**
```typescript
import { useTranslations } from 'next-intl';

export function PayrollForm() {
  const t = useTranslations('payroll');
  const tCommon = useTranslations('common');

  return (
    <form>
      <label>{t('gross_salary')}</label>
      <input type="number" />

      <button>{tCommon('save')}</button>
    </form>
  );
}
```

---

## Date & Time Handling

### Timezone Strategy

**Rule:** All dates stored in UTC, displayed in local timezone

```typescript
import { toZonedTime, format } from 'date-fns-tz';
import { fr } from 'date-fns/locale';

function formatLocalDate(utcDate: Date, timezone: string): string {
  const zonedDate = toZonedTime(utcDate, timezone);
  return format(zonedDate, 'dd MMMM yyyy', { locale: fr });
}

// Example:
const payrollDate = new Date('2025-01-31T23:00:00Z');
formatLocalDate(payrollDate, 'Africa/Abidjan'); // "31 janvier 2025"
```

### Date Format by Country

| Country | Format | Example |
|---------|--------|---------|
| Côte d'Ivoire | dd/MM/yyyy | 31/01/2025 |
| Senegal | dd/MM/yyyy | 31/01/2025 |
| All West Africa | dd/MM/yyyy | 31/01/2025 |

**Important:** No AM/PM format (use 24-hour clock)

### Working Days Calculation

**Country-Specific Holidays:**
```typescript
type CountryHolidays = {
  countryCode: string;
  year: number;
  holidays: Holiday[];
};

type Holiday = {
  date: Date;
  name: string;
  isNational: boolean;
};

// Côte d'Ivoire example
const ciHolidays2025: Holiday[] = [
  { date: new Date('2025-01-01'), name: "Jour de l'An", isNational: true },
  { date: new Date('2025-04-21'), name: "Lundi de Pâques", isNational: true },
  { date: new Date('2025-05-01'), name: "Fête du Travail", isNational: true },
  { date: new Date('2025-05-29'), name: "Ascension", isNational: true },
  { date: new Date('2025-06-09'), name: "Lundi de Pentecôte", isNational: true },
  { date: new Date('2025-08-07'), name: "Fête Nationale", isNational: true },
  { date: new Date('2025-08-15'), name: "Assomption", isNational: true },
  { date: new Date('2025-11-01'), name: "Toussaint", isNational: true },
  { date: new Date('2025-11-15'), name: "Journée Nationale de la Paix", isNational: true },
  { date: new Date('2025-12-25'), name: "Noël", isNational: true },
  // Islamic holidays (calculated annually)
  { date: new Date('2025-03-30'), name: "Aïd el-Fitr", isNational: true },
  { date: new Date('2025-06-06'), name: "Aïd el-Adha", isNational: true },
];

function getWorkingDaysInMonth(month: Date, countryCode: string): number {
  const holidays = getHolidaysForMonth(month, countryCode);
  const totalDays = getDaysInMonth(month);
  let workingDays = 0;

  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(month.getFullYear(), month.getMonth(), day);
    const isWeekend = isWeekendDay(currentDate); // Saturday or Sunday
    const isHoliday = holidays.some(h => isSameDay(h.date, currentDate));

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
  }

  return workingDays;
}
```

---

## Country-Specific Configuration

### Tax & Social Security Systems

**Database-Driven Configuration:**
```sql
-- Country metadata
CREATE TABLE countries (
  code TEXT PRIMARY KEY, -- ISO 3166-1 alpha-2
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  timezone TEXT NOT NULL,
  locale TEXT NOT NULL,

  -- Labor law
  minimum_age INTEGER DEFAULT 16,
  minimum_wage DECIMAL(15, 2), -- SMIG/SMAG
  standard_work_hours INTEGER DEFAULT 40,

  -- Leave entitlements
  annual_leave_days_per_month DECIMAL(4, 2), -- e.g., 2.2 for CI
  maternity_leave_days INTEGER,
  paternity_leave_days INTEGER,

  created_at TIMESTAMP DEFAULT now()
);

-- Insert Côte d'Ivoire
INSERT INTO countries VALUES (
  'CI',
  'Côte d''Ivoire',
  'XOF',
  'Africa/Abidjan',
  'fr-CI',
  16, -- Minimum age
  75000, -- SMIG
  40, -- Standard work hours
  2.2, -- 2.2 days per month = 26 days/year
  98, -- 14 weeks maternity
  10  -- 10 days paternity
);
```

### Country-Specific Business Rules

```typescript
type CountryRules = {
  countryCode: string;

  // Contract rules
  maxCDDDuration: number; // months (e.g., 24 for CI)
  maxCDDRenewals: number; // (e.g., 2 for CI)
  trialPeriodDays: { // By contract type
    CDI: number;
    CDD: number;
  };

  // Notice period (préavis)
  noticePeriod: {
    CADRE: number; // days
    EMPLOYE: number;
    OUVRIER: number;
  };

  // Severance calculation
  severanceFormula: 'CI' | 'SN' | 'BF'; // Country-specific formula
};

const coteDIvoireRules: CountryRules = {
  countryCode: 'CI',
  maxCDDDuration: 24, // 2 years maximum
  maxCDDRenewals: 2,
  trialPeriodDays: {
    CDI: 90,
    CDD: 30,
  },
  noticePeriod: {
    CADRE: 90,
    EMPLOYE: 30,
    OUVRIER: 15,
  },
  severanceFormula: 'CI',
};
```

---

## Adding a New Country (Step-by-Step)

### Phase 1: Configuration (Database)

**Step 1: Add Country Metadata**
```sql
INSERT INTO countries (code, name, currency, timezone, locale, minimum_wage, ...)
VALUES ('SN', 'Sénégal', 'XOF', 'Africa/Dakar', 'fr-SN', 60000, ...);
```

**Step 2: Add Tax System**
```sql
INSERT INTO tax_systems (country_code, name, type, effective_from, ...)
VALUES ('SN', 'IRPP - Sénégal', 'progressive', '2025-01-01', ...);

INSERT INTO tax_brackets (tax_system_id, min_income, max_income, rate, ...)
VALUES
  (..., 0, 50000, 0, 0),
  (..., 50001, 100000, 10, 0),
  -- ... more brackets
```

**Step 3: Add Social Security Scheme**
```sql
INSERT INTO social_security_schemes (country_code, name, effective_from, ...)
VALUES ('SN', 'CSS - Caisse de Sécurité Sociale', '2025-01-01', ...);

INSERT INTO contribution_types (scheme_id, name, employee_rate, employer_rate, ...)
VALUES
  (..., 'Pension', 0.06, 0.08, ...),
  (..., 'Allocations Familiales', 0, 0.07, ...),
  -- ... more contribution types
```

### Phase 2: Localization

**Step 1: Create Translation File**
```bash
# messages/fr-SN.json
{
  "common": {
    "currency": "FCFA"
  },
  "payroll": {
    "irpp": "IRPP",
    "css": "CSS"
  }
}
```

**Step 2: Add Locale to Config**
```typescript
// lib/i18n/config.ts
export const locales = ['fr-CI', 'fr-SN', 'fr-BF', ...] as const;
```

### Phase 3: Business Rules

**Step 1: Add Country Rules**
```typescript
// lib/country-rules/senegal.ts
export const senegalRules: CountryRules = {
  countryCode: 'SN',
  maxCDDDuration: 24,
  // ... other rules
};
```

**Step 2: Add Holidays**
```typescript
// lib/holidays/senegal.ts
export const senegalHolidays2025: Holiday[] = [
  { date: new Date('2025-01-01'), name: "Jour de l'An", isNational: true },
  { date: new Date('2025-04-04'), name: "Fête de l'Indépendance", isNational: true },
  // ... more holidays
];
```

### Phase 4: Testing

**Validation Checklist:**
- [ ] Payroll calculation matches country formula
- [ ] Tax brackets loaded correctly
- [ ] Social security rates correct
- [ ] Minimum wage validation works
- [ ] Holiday calendar accurate
- [ ] Currency formatting correct
- [ ] Translations complete

---

## Number & Currency Formatting

### Number Display Rules

**French Format (all countries):**
```typescript
// Use space as thousand separator
const amount = 1500000;
const formatted = new Intl.NumberFormat('fr-CI').format(amount);
// Output: "1 500 000"

// Currency formatting
const currencyFormatted = new Intl.NumberFormat('fr-CI', {
  style: 'currency',
  currency: 'XOF',
}).format(amount);
// Output: "1 500 000 FCFA"
```

**Input Handling:**
```typescript
// Accept both formats
function parseCurrency(input: string): number {
  // Remove spaces and FCFA
  const cleaned = input.replace(/\s/g, '').replace('FCFA', '');
  return parseFloat(cleaned);
}

// Examples:
parseCurrency('300 000 FCFA'); // 300000
parseCurrency('300000'); // 300000
parseCurrency('1 500 000'); // 1500000
```

---

## Legal & Compliance

### Country-Specific Regulations

**Côte d'Ivoire:**
- Minimum wage: 75,000 FCFA (SMIG - 2024)
- Standard hours: 40 hours/week
- Annual leave: 2.2 days/month (26 days/year)
- Maternity leave: 14 weeks
- Paternity leave: 10 days
- CDD max duration: 24 months
- Notice period: 15-90 days (by category)

**Senegal:**
- Minimum wage: 60,000 FCFA (SMIG - 2024)
- Standard hours: 40 hours/week
- Annual leave: 2 days/month (24 days/year)
- Maternity leave: 14 weeks
- Paternity leave: 3 days
- CDD max duration: 24 months

**Data Residency:**
- All countries: Data can be stored in EU (GDPR compliant)
- Senegal: Specific data protection law (similar to GDPR)
- Côte d'Ivoire: No specific residency requirement

---

## Mobile Localization

### Language Detection

```typescript
// Detect user locale from device
import * as Localization from 'expo-localization';

function getUserLocale(): SupportedLocale {
  const deviceLocale = Localization.locale; // e.g., 'fr-CI', 'en-US'

  // Check if supported
  if (supportedLocales.includes(deviceLocale as SupportedLocale)) {
    return deviceLocale as SupportedLocale;
  }

  // Fallback to language only
  const lang = deviceLocale.split('-')[0];
  if (lang === 'fr') {
    return 'fr-CI'; // Default French locale
  }

  return 'fr-CI'; // Ultimate fallback
}
```

### RTL Support (Future)

**For Arabic-speaking countries (e.g., Mauritania):**
```typescript
import { I18nManager } from 'react-native';

function setupRTL(locale: string) {
  const isRTL = ['ar', 'he'].includes(locale.split('-')[0]);
  I18nManager.forceRTL(isRTL);
}
```

---

## Performance Considerations

### Translation Loading

**Strategy:** Lazy load country-specific translations
```typescript
// Only load translations for active country
async function loadTranslations(locale: SupportedLocale) {
  const common = await import(`../messages/fr-common.json`);
  const specific = await import(`../messages/${locale}.json`);

  return { ...common, ...specific };
}
```

### Country Rules Caching

```typescript
// Cache country rules in Redis (1 day TTL)
async function getCountryRules(countryCode: string): Promise<CountryRules> {
  const cacheKey = `country_rules:${countryCode}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Load from database
  const rules = await db.query.countries.findFirst({
    where: eq(countries.code, countryCode),
  });

  // Cache for 1 day
  await redis.setex(cacheKey, 86400, JSON.stringify(rules));

  return rules;
}
```

---

## Testing Strategy

### Multi-Country Tests

```typescript
describe('Payroll Calculation - Multi-Country', () => {
  it.each([
    { country: 'CI', grossSalary: 300000, expectedNet: 234750 },
    { country: 'SN', grossSalary: 300000, expectedNet: 241200 },
  ])('calculates net salary for $country', async ({ country, grossSalary, expectedNet }) => {
    const result = await calculatePayroll({
      employeeId: testEmployeeId,
      countryCode: country,
      grossSalary,
    });

    expect(result.netSalary).toBe(expectedNet);
  });
});
```

---

**Next Steps for Country Expansion:**
1. Research target country regulations
2. Add database configuration (tax, CNPS, holidays)
3. Create translation file
4. Add country-specific business rules
5. Test payroll calculations
6. Document edge cases
