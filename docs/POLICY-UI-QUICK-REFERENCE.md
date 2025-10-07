# Policy Configuration UI - Quick Reference

**Quick guide for developers working with the policy configuration system**

---

## 🚀 Quick Start

### Access the UI

```
http://localhost:3000/admin/policies/time-off
http://localhost:3000/admin/policies/overtime
http://localhost:3000/admin/policies/accrual
```

### Import Components

```typescript
import {
  ComplianceBadge,
  EffectiveDatePicker,
  LegalMinimumDisplay,
  PolicyAuditTrail,
} from '@/features/policies/components';
```

---

## 📦 Component Reference

### ComplianceBadge

```tsx
<ComplianceBadge level="locked" size="lg" showIcon={true} />
```

**Props**:
- `level`: 'locked' | 'convention_collective' | 'configurable' | 'freeform' | 'non_compliant'
- `size`: 'sm' | 'md' | 'lg'
- `showIcon`: boolean (default: true)
- `className`: string

---

### EffectiveDatePicker

```tsx
<EffectiveDatePicker
  value={date}
  onChange={setDate}
  minDate={new Date()}
  label="À partir du"
/>
```

**Props**:
- `value`: Date | undefined
- `onChange`: (date: Date | undefined) => void
- `minDate`: Date (default: today)
- `maxDate`: Date (optional)
- `label`: string (default: "À partir du")
- `description`: string
- `required`: boolean (default: true)
- `disabled`: boolean

---

### LegalMinimumDisplay

```tsx
// Inline variant (badge with tooltip)
<LegalMinimumDisplay
  minimum={2.0}
  unit="jours/mois"
  reference="Convention Collective Article 28"
  variant="inline"
/>

// Block variant (large card)
<LegalMinimumDisplay
  minimum={2.0}
  unit="jours/mois"
  reference="Convention Collective Article 28"
  variant="block"
/>
```

**Props**:
- `minimum`: number | string
- `unit`: string (optional)
- `reference`: string (default: "Convention Collective")
- `variant`: 'inline' | 'block' (default: 'inline')

---

### LegalMinimumAlert

```tsx
<LegalMinimumAlert
  title="Taux inférieur au minimum légal"
  minimum={2.0}
  current={1.5}
  reference="Convention Collective Article 28"
  severity="error"
/>
```

**Props**:
- `title`: string
- `minimum`: number | string
- `current`: number | string
- `reference`: string (optional)
- `severity`: 'error' | 'warning' (default: 'error')

---

### PolicyAuditTrail

```tsx
<PolicyAuditTrail policyId="uuid-here" />
```

**Props**:
- `policyId`: string (UUID)
- `className`: string (optional)

---

## 🔌 tRPC Endpoints

### Time-Off Policies

```typescript
// List all active policies
const { data: policies } = trpc.policies.listTimeOffPolicies.useQuery();

// Get single policy
const { data: policy } = trpc.policies.getTimeOffPolicy.useQuery(policyId);

// Get policy history
const { data: history } = trpc.policies.getPolicyHistory.useQuery(policyId);

// Get templates
const { data: templates } = trpc.policies.getTemplates.useQuery({
  countryCode: 'CI',
});

// Create policy
const createMutation = trpc.policies.createTimeOffPolicy.useMutation({
  onSuccess: () => {
    toast.success('Politique créée');
  },
});

createMutation.mutate({
  name: 'Congés annuels 2025',
  policyType: 'annual_leave',
  accrualMethod: 'accrued_monthly',
  accrualRate: 2.0,
  requiresApproval: true,
  advanceNoticeDays: 15,
  effectiveFrom: new Date(),
});
```

---

### Overtime Rates

```typescript
// Get rates for country
const { data: rates } = trpc.policies.getOvertimeRates.useQuery({
  countryCode: 'CI',
});

// Update rate (super admin only)
const updateMutation = trpc.policies.updateOvertimeRate.useMutation();

updateMutation.mutate({
  countryCode: 'CI',
  periodType: 'sunday',
  rateMultiplier: 1.75,
  effectiveFrom: new Date(),
});
```

---

### Leave Accrual Rules

```typescript
// Get all rules
const { data: rules } = trpc.policies.getAccrualRules.useQuery({
  countryCode: 'CI',
});

// Calculate for specific employee
const { data: accrual } = trpc.policies.calculateAccrualForEmployee.useQuery({
  countryCode: 'CI',
  age: 22,
  seniorityYears: 18,
});

// Returns:
// {
//   daysPerMonth: 2.0,
//   bonusDays: 4,
//   totalAnnual: 28,
//   legalReference: 'Convention Collective Article 28'
// }
```

---

### Validation

```typescript
// Real-time compliance validation
const { data: validation } = trpc.policies.validatePolicyCompliance.useQuery({
  policy: {
    accrualRate: 1.5, // Below legal minimum
    maxBalance: 48,
  },
  countryCode: 'CI',
});

// Returns:
// {
//   isCompliant: false,
//   violations: [
//     {
//       field: 'accrualRate',
//       message: 'Minimum légal: 2.0 jours/mois...',
//       severity: 'critical',
//       legalReference: 'Convention Collective Article 28',
//       suggestedValue: 2.0,
//       currentValue: 1.5,
//     }
//   ],
//   complianceLevel: 'non_compliant',
//   legalReferences: ['Convention Collective Article 28']
// }

// Get legal minimums
const { data: minimums } = trpc.policies.getLegalMinimums.useQuery({
  countryCode: 'CI',
});

// Returns:
// {
//   annualLeave: {
//     accrualRate: 2.0,
//     maxBalance: null,
//     minContinuousDays: 12,
//     carryoverMonths: 6,
//     legalReference: 'Convention Collective Article 28'
//   }
// }
```

---

## 📋 Policy Types

```typescript
type PolicyType =
  | 'annual_leave'    // Congés payés annuels
  | 'sick_leave'      // Congé maladie
  | 'maternity'       // Congé de maternité
  | 'paternity'       // Congé de paternité
  | 'unpaid';         // Congé sans solde

type AccrualMethod =
  | 'accrued_monthly'   // Acquisition mensuelle
  | 'fixed'             // Montant fixe annuel
  | 'accrued_hourly';   // Acquisition horaire

type ComplianceLevel =
  | 'locked'                 // Verrouillée (cannot edit)
  | 'convention_collective'  // Conforme CC (cannot edit)
  | 'configurable'           // Configurable (within limits)
  | 'freeform'               // Personnalisé
  | 'non_compliant';         // Non conforme (blocked)
```

---

## 🎨 Design Patterns

### Wizard Pattern (3 Steps)

```tsx
const [step, setStep] = useState(1);

// Step 1: Essential
if (step === 1) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Type de congé</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Template selector, name, effective date */}
      </CardContent>
    </Card>
  );
}

// Step 2: Helpful
if (step === 2) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Règles d'acquisition</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Accrual method, rate, approval */}
      </CardContent>
    </Card>
  );
}

// Step 3: Expert
if (step === 3) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Options avancées</CardTitle>
      </CardHeader>
      <CardContent>
        <Collapsible>
          <CollapsibleTrigger>Options avancées (facultatif)</CollapsibleTrigger>
          <CollapsibleContent>
            {/* Max balance, blackout periods, etc. */}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
```

---

### Progressive Disclosure Pattern

```tsx
<div className="space-y-6">
  {/* Essential info always visible */}
  <div>
    <p className="text-3xl font-bold">{policy.accrualRate} jours/mois</p>
  </div>

  {/* Details behind collapsible */}
  <Collapsible>
    <CollapsibleTrigger>Voir les détails</CollapsibleTrigger>
    <CollapsibleContent>
      <DetailedBreakdown />
    </CollapsibleContent>
  </Collapsible>
</div>
```

---

### Smart Defaults Pattern

```typescript
const form = useForm({
  defaultValues: {
    accrualRate: 2.0,           // Legal minimum
    requiresApproval: true,      // Best practice
    advanceNoticeDays: 15,       // Common standard
    minDaysPerRequest: 0.5,      // Half-day minimum
    isPaid: true,                // Default to paid
    effectiveFrom: new Date(),   // Today
  },
});
```

---

## 🔒 Compliance Rules

### CI (Côte d'Ivoire)

**Annual Leave**:
- Minimum: 2.0 days/month (24 days/year)
- Max balance: 48 days (2 years)
- Min continuous: 12 days
- Carryover: 6 months

**Youth Bonus** (<21 years):
- 2.5 days/month (30 days/year)

**Seniority Bonuses**:
- 15 years: +2 days (26 total)
- 20 years: +4 days (28 total)
- 25 years: +6 days (30 total)

**Overtime Rates**:
- Weekday 41-48h: 115%
- Weekday 48h+: 150%
- Saturday: 150%
- Sunday: 175%
- Holiday: 200%
- Night (21h-5h): 175%

---

## 🎯 Touch Target Sizes

```css
/* Primary CTA */
.primary-action {
  min-height: 56px;  /* Large touch target */
}

/* Secondary actions */
.button, .card-action {
  min-height: 44px;  /* Standard touch target */
}

/* Form inputs */
.input, .select {
  min-height: 48px;  /* Comfortable input */
}

/* Checkboxes */
.checkbox {
  width: 24px;
  height: 24px;
  /* With 44px touch area via padding */
}
```

---

## 🌍 Multi-Country Support

```typescript
const COUNTRIES = [
  { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
];

// Get country-specific data
const { data: rates } = trpc.policies.getOvertimeRates.useQuery({
  countryCode: selectedCountry,
});

// Check if country is locked
const isLocked = selectedCountry === 'CI';
```

---

## 📱 Responsive Design

```tsx
{/* Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns */}
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  {policies.map((policy) => (
    <PolicyCard key={policy.id} policy={policy} />
  ))}
</div>

{/* Mobile: stack, Desktop: side-by-side */}
<div className="grid md:grid-cols-2 gap-6">
  <div>Left column</div>
  <div>Right column</div>
</div>
```

---

## 🧪 Testing Examples

### Test Policy Creation

```typescript
// Test creating annual leave policy
const policy = await createPolicy({
  name: 'Congés annuels 2025',
  policyType: 'annual_leave',
  accrualMethod: 'accrued_monthly',
  accrualRate: 2.0,
  requiresApproval: true,
  advanceNoticeDays: 15,
  effectiveFrom: new Date('2025-01-01'),
});

expect(policy.complianceLevel).toBe('convention_collective');
expect(policy.accrualRate).toBe('2.0');
```

### Test Compliance Validation

```typescript
// Test below minimum fails
const result = await validateCompliance({
  policy: { accrualRate: 1.5 },
  countryCode: 'CI',
});

expect(result.isCompliant).toBe(false);
expect(result.violations).toHaveLength(1);
expect(result.violations[0].severity).toBe('critical');
```

### Test Accrual Calculation

```typescript
// Test seniority bonus
const accrual = await calculateAccrual({
  countryCode: 'CI',
  age: 30,
  seniorityYears: 18,
});

expect(accrual.daysPerMonth).toBe(2.0);
expect(accrual.bonusDays).toBe(4); // 15-year bonus
expect(accrual.totalAnnual).toBe(28);
```

---

## 🚨 Common Pitfalls

### ❌ Don't Do This

```tsx
// Don't hardcode legal minimums
<Input type="number" min={2.0} />

// Don't use English
<Button>Create Policy</Button>

// Don't skip compliance validation
createMutation.mutate(data); // No validation!

// Don't use relative dates
effectiveFrom: new Date('2024-01-01') // In the past!
```

### ✅ Do This Instead

```tsx
// Load legal minimums from database
const { data: minimums } = trpc.policies.getLegalMinimums.useQuery();
<Input type="number" min={minimums?.annualLeave.accrualRate || 2.0} />

// Use French everywhere
<Button>Créer la politique</Button>

// Validate before submission
const validation = await validatePolicyCompliance(data);
if (!validation.isCompliant) {
  showErrors(validation.violations);
  return;
}

// Use EffectiveDatePicker (prevents backdating)
<EffectiveDatePicker minDate={new Date()} />
```

---

## 📚 Related Documentation

- **Backend**: `/server/routers/policies.ts` (15+ tRPC endpoints)
- **Validation**: `/features/policies/services/compliance-validator.ts`
- **Database**: `time_off_policies`, `overtime_rates`, `leave_accrual_rules` tables
- **HCI Principles**: `/docs/HCI-DESIGN-PRINCIPLES.md`
- **Convention Collective**: `/docs/05-EPIC-PAYROLL.md`

---

## 🆘 Troubleshooting

### Policies not loading?
1. Check tRPC connection
2. Verify user has tenantId
3. Check database migrations

### Validation always fails?
1. Verify countryCode is 'CI'
2. Check legal minimums are seeded
3. Inspect `time_off_policy_templates` table

### Effective date picker not working?
1. Ensure `date-fns` is installed
2. Check locale import (`fr` from `date-fns/locale`)
3. Verify minDate is set correctly

---

**Last Updated**: 2025-10-07
