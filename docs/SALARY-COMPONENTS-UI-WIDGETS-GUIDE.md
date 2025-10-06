# Salary Components UI Widgets Guide

**Date:** 2025-10-06
**Status:** 📋 **COMPREHENSIVE SPECIFICATION**
**Purpose:** Define the correct widget for each salary component configuration case

---

## Executive Summary

This document defines **all possible salary component configuration cases** and specifies the **correct UI widget** for each case. This ensures:

1. ✅ **Legal compliance** - Users cannot violate tax/labor law
2. ✅ **Appropriate UX** - Right widget for the right data type
3. ✅ **Consistency** - Same patterns across all components
4. ✅ **Accessibility** - Touch-friendly, mobile-first widgets

---

## Compliance Level Framework

Every salary component has a **compliance level** that determines UI behavior:

| Level | Badge | Can Modify? | Can Deactivate? | UI Behavior |
|-------|-------|-------------|-----------------|-------------|
| **🔒 Locked** | Verrouillé | ❌ No | ❌ No | All fields read-only |
| **⚙️ Configurable** | Configurable | ✅ Within legal bounds | ✅ Yes (if optional) | Slider with min/max |
| **🎨 Freeform** | Libre | ✅ Unrestricted | ✅ Yes | Input number |

---

## Widget Decision Tree

```
Is the component locked (🔒)?
├─ YES → Use ReadOnlyField for ALL parameters
└─ NO → Is it configurable (⚙️) or freeform (🎨)?
    ├─ CONFIGURABLE (⚙️)
    │   └─ Does it have legal bounds?
    │       ├─ YES → Use appropriate bounded widget:
    │       │   ├─ Percentage (0-100%) → RateSlider
    │       │   ├─ Amount (FCFA) → AmountSlider
    │       │   └─ Enum (fixed options) → Select/RadioGroup
    │       └─ NO → ERROR (configurable must have bounds)
    └─ FREEFORM (🎨)
        └─ What data type?
            ├─ Percentage → Input (type="number", step=0.01)
            ├─ Amount → Input (type="number", step=1000)
            ├─ Text → Input (type="text")
            └─ Boolean → Checkbox
```

---

## Widget Catalog

### 1. ReadOnlyField (🔒 Locked Components)

**Use when:** Component is locked or field is defined by law

**Example:** Tax treatment, CNPS treatment, seniority bonus rate

**Component:**
```tsx
import { ReadOnlyField } from '@/components/salary-components/read-only-field';

<ReadOnlyField
  label="Imposable (ITS)"
  value={component.metadata?.taxTreatment?.isTaxable ? 'Oui' : 'Non'}
  description="Soumis à l'impôt sur les traitements et salaires"
  reason="Code Général des Impôts"
/>
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ Imposable (ITS)        🔒 Code Général  │
│ ┌─────────────────────────────────────┐ │
│ │ Oui                                 │ │
│ └─────────────────────────────────────┘ │
│ Soumis à l'impôt sur les traitements    │
└─────────────────────────────────────────┘
```

---

### 2. RateSlider (⚙️ Percentage with Legal Bounds)

**Use when:**
- Component is configurable
- Field type is percentage
- Has legal min/max bounds

**Example:** Housing allowance (20-30%), hazard pay (15-25%)

**Component:**
```tsx
import { Slider } from '@/components/ui/slider';

<FormField
  control={form.control}
  name="rate"
  render={({ field }) => {
    const minRate = 0.20; // From template.legalRanges
    const maxRate = 0.30;
    const recommendedRate = 0.25;
    const currentRate = field.value || recommendedRate;

    return (
      <FormItem>
        <FormLabel className="flex items-center justify-between">
          <span>Taux</span>
          <span className="text-2xl font-bold text-primary">
            {Math.round(currentRate * 100)}%
          </span>
        </FormLabel>
        <FormControl>
          <div className="space-y-4 pt-2">
            <Slider
              min={minRate * 100}
              max={maxRate * 100}
              step={1}
              value={[currentRate * 100]}
              onValueChange={(values) => field.onChange(values[0] / 100)}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: {minRate * 100}%</span>
              <span className="text-primary font-medium">
                Recommandé: {recommendedRate * 100}%
              </span>
              <span>Max: {maxRate * 100}%</span>
            </div>
          </div>
        </FormControl>
        <FormDescription>
          Taux appliqué au salaire de base (Convention Collective Article 20)
        </FormDescription>
        <FormMessage />
      </FormItem>
    );
  }}
/>
```

**Visual:**
```
┌─────────────────────────────────────────────┐
│ Taux                               25%      │
│ ━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Min: 20%    Recommandé: 25%      Max: 30%  │
│ Taux appliqué au salaire de base (Conv...  │
└─────────────────────────────────────────────┘
```

**Touch-friendly:**
- Slider thumb: 44×44px minimum
- Padding around slider: py-4 (16px)
- Step: 1% (granular control)

---

### 3. AmountSlider (⚙️ Fixed Amount with Legal Bounds)

**Use when:**
- Component is configurable
- Field type is amount (FCFA)
- Has legal min/max bounds

**Example:** Transport allowance (0-30,000 FCFA), meal allowance (10,000-25,000 FCFA)

**Component:**
```tsx
<FormField
  control={form.control}
  name="baseAmount"
  render={({ field }) => {
    const minAmount = 0;
    const maxAmount = 30000; // From template.legalRanges
    const recommendedAmount = 25000;
    const currentAmount = field.value || recommendedAmount;

    return (
      <FormItem>
        <FormLabel className="flex items-center justify-between">
          <span>Montant</span>
          <span className="text-2xl font-bold text-primary">
            {currentAmount.toLocaleString('fr-FR')} FCFA
          </span>
        </FormLabel>
        <FormControl>
          <div className="space-y-4 pt-2">
            <Slider
              min={minAmount}
              max={maxAmount}
              step={5000} // 5k FCFA steps
              value={[currentAmount]}
              onValueChange={(values) => field.onChange(values[0])}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min: {minAmount.toLocaleString()} FCFA</span>
              <span className="text-primary font-medium">
                Recommandé: {recommendedAmount.toLocaleString()} FCFA
              </span>
              <span>Max: {maxAmount.toLocaleString()} FCFA (exempt)</span>
            </div>
          </div>
        </FormControl>
        <FormDescription>
          Maximum 30,000 FCFA exempt d'impôt (Code Général des Impôts)
        </FormDescription>
        <FormMessage />
      </FormItem>
    );
  }}
/>
```

**Visual:**
```
┌─────────────────────────────────────────────┐
│ Montant                        25 000 FCFA │
│ ━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━ │
│ Min: 0     Recommandé: 25,000  Max: 30,000 │
│ Maximum 30,000 FCFA exempt d'impôt (Code... │
└─────────────────────────────────────────────┘
```

**Step calculation:**
- For 0-50k: step = 5,000 FCFA
- For 50k-200k: step = 10,000 FCFA
- For >200k: step = 25,000 FCFA

---

### 4. InputNumber (🎨 Freeform - No Legal Bounds)

**Use when:**
- Component is freeform
- No legal constraints

**Example:** Custom bonuses, end-year bonus, performance bonus

**Component:**
```tsx
<FormField
  control={form.control}
  name="amount"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Montant (FCFA)</FormLabel>
      <FormControl>
        <Input
          {...field}
          type="number"
          min={0}
          step={1000}
          placeholder="Ex: 100000"
          className="min-h-[48px]"
          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
          value={field.value || ''}
        />
      </FormControl>
      <FormDescription>
        Montant libre selon votre politique d'entreprise
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ Montant (FCFA)                          │
│ ┌─────────────────────────────────────┐ │
│ │ 100000                 [▲][▼]       │ │
│ └─────────────────────────────────────┘ │
│ Montant libre selon votre politique     │
└─────────────────────────────────────────┘
```

**Note:** NO slider because there are no legal bounds to enforce.

---

### 5. InputPercentage (🎨 Freeform Rate)

**Use when:**
- Component is freeform
- Field is percentage
- No legal bounds

**Example:** Performance bonus rate, representation allowance

**Component:**
```tsx
<FormField
  control={form.control}
  name="rate"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Taux (%)</FormLabel>
      <FormControl>
        <Input
          {...field}
          type="number"
          min={0}
          max={100}
          step={0.1}
          placeholder="Ex: 15 (pour 15%)"
          className="min-h-[48px]"
          onChange={(e) => field.onChange(parseFloat(e.target.value) / 100 || undefined)}
          value={field.value ? (field.value * 100).toString() : ''}
        />
      </FormControl>
      <FormDescription>
        Taux appliqué au salaire de base
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

### 6. Select (Enum with Fixed Options)

**Use when:**
- Field has fixed set of legal options
- Example: Frequency (monthly/quarterly/yearly), category selection

**Component:**
```tsx
<FormField
  control={form.control}
  name="frequency"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Fréquence</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger className="min-h-[48px]">
            <SelectValue placeholder="Sélectionnez la fréquence" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="monthly">Mensuelle</SelectItem>
          <SelectItem value="quarterly">Trimestrielle</SelectItem>
          <SelectItem value="yearly">Annuelle</SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>
        Fréquence de versement de la prime
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Complete Configuration Cases

### Case 1: 🔒 LOCKED - Cannot Modify Anything

**Example:** `TPT_SENIORITY_BONUS` (Prime d'ancienneté)

**Legal Basis:** Convention Collective Article 16

**Rules:**
- Rate: 2% per year (LOCKED)
- Cap: 12% maximum (LOCKED)
- Type: Auto-calculated (LOCKED)
- Tax treatment: Taxable (LOCKED)
- CNPS: Included in base (LOCKED)

**UI:**
```tsx
// Name field (ONLY editable field)
<Input name="customName" placeholder={component.name} />

// Warning
<Alert>
  <Lock className="h-4 w-4" />
  <AlertDescription>
    Ce composant ne peut pas être modifié. Tous ses paramètres sont définis par la Convention Collective Article 16.
  </AlertDescription>
</Alert>

// All other fields
<ReadOnlyField label="Taux" value="2% par an" reason="Convention Collective Article 16" />
<ReadOnlyField label="Maximum" value="12%" reason="Convention Collective Article 16" />
<ReadOnlyField label="Type" value="Auto-calculé" reason="Convention Collective Article 16" />
```

**Screenshot:** `.playwright-mcp/option-b-locked-component.png`

---

### Case 2: ⚙️ CONFIGURABLE - Rate with Legal Bounds

**Example:** `TPT_HOUSING_CI` (Indemnité de logement)

**Legal Basis:** Convention Collective Article 20

**Rules:**
- Rate: 20-30% (CONFIGURABLE)
- Recommended: 25%
- Tax treatment: Taxable (LOCKED)
- CNPS: Included in base (LOCKED)

**UI:**
```tsx
// Name field
<Input name="customName" />

// Rate slider (CONFIGURABLE)
<RateSlider
  min={0.20}
  max={0.30}
  recommended={0.25}
  legalReference="Convention Collective Article 20"
/>

// Tax/CNPS (LOCKED)
<ReadOnlyField label="Imposable (ITS)" value="Oui" reason="Code Général des Impôts" />
<ReadOnlyField label="Base CNPS" value="Oui" reason="Décret CNPS" />
```

**Screenshot:** `.playwright-mcp/option-b-slider-ui.png`

---

### Case 3: ⚙️ CONFIGURABLE - Amount with Legal Cap

**Example:** `TPT_TRANSPORT_CI` (Indemnité de transport)

**Legal Basis:** Convention Collective Article 20 + Code Général des Impôts

**Rules:**
- Amount: 0-30,000 FCFA (CONFIGURABLE)
- Above 30k: Taxable
- Recommended: 25,000 FCFA
- Tax treatment: Partially exempt (LOCKED)

**UI:**
```tsx
<AmountSlider
  min={0}
  max={30000}
  step={5000}
  recommended={25000}
  legalReference="Code Général des Impôts - Exempt jusqu'à 30,000 FCFA"
/>

<ReadOnlyField
  label="Traitement fiscal"
  value="Exempt jusqu'à 30,000 FCFA, taxable au-delà"
  reason="Code Général des Impôts Article 82"
/>
```

---

### Case 4: 🎨 FREEFORM - No Legal Constraints

**Example:** `PERFORMANCE` (Prime de performance)

**Rules:**
- Amount/Rate: Unlimited (FREEFORM)
- Tax treatment: Usually taxable (LOCKED)
- Frequency: Company decides (FREEFORM)

**UI:**
```tsx
// Type selection (rate or fixed)
<RadioGroup name="calculationType">
  <RadioGroupItem value="percentage">Pourcentage du salaire</RadioGroupItem>
  <RadioGroupItem value="fixed">Montant fixe</RadioGroupItem>
</RadioGroup>

// If percentage
<InputPercentage name="rate" placeholder="Ex: 10 (pour 10%)" />

// If fixed
<InputNumber name="amount" placeholder="Ex: 50000" />

// Frequency
<Select name="frequency">
  <SelectItem value="monthly">Mensuelle</SelectItem>
  <SelectItem value="quarterly">Trimestrielle</SelectItem>
  <SelectItem value="yearly">Annuelle</SelectItem>
</Select>

// Tax treatment (LOCKED)
<ReadOnlyField label="Imposable" value="Oui" reason="Code Général des Impôts" />
```

---

### Case 5: 🤖 AUTO-CALCULATED - Read-Only Display

**Example:** `TPT_OVERTIME` (Heures supplémentaires)

**Rules:**
- Calculation: Hours × Rate (AUTO)
- Rates: 15-100% depending on day/time (LOCKED)
- Cannot be manually set

**UI:**
```tsx
<Alert>
  <Info className="h-4 w-4" />
  <AlertDescription>
    <strong>Composant auto-calculé</strong> - Le montant est calculé automatiquement selon les heures travaillées et les taux légaux.
  </AlertDescription>
</Alert>

<ReadOnlyField
  label="Taux heures supplémentaires (semaine)"
  value="+15%"
  reason="Convention Collective Article 25"
/>
<ReadOnlyField
  label="Taux samedi"
  value="+50%"
  reason="Convention Collective Article 25"
/>
<ReadOnlyField
  label="Taux dimanche"
  value="+75%"
  reason="Convention Collective Article 25"
/>
<ReadOnlyField
  label="Taux jour férié"
  value="+100%"
  reason="Convention Collective Article 25"
/>
```

---

## Widget Selection Matrix

| Compliance | Data Type | Has Bounds? | Widget | Example |
|-----------|-----------|-------------|--------|---------|
| 🔒 Locked | Any | N/A | `ReadOnlyField` | Seniority bonus rate |
| ⚙️ Configurable | Percentage | Yes (min/max) | `RateSlider` | Housing 20-30% |
| ⚙️ Configurable | Amount | Yes (max) | `AmountSlider` | Transport ≤30k |
| ⚙️ Configurable | Enum | Yes (fixed options) | `Select` | Frequency |
| 🎨 Freeform | Percentage | No | `InputPercentage` | Performance % |
| 🎨 Freeform | Amount | No | `InputNumber` | Custom bonus |
| 🎨 Freeform | Enum | No | `Select` | Category |
| 🤖 Auto | Any | N/A | `ReadOnlyField` + explanation | Overtime |

---

## Widget Implementation Checklist

When implementing a salary component edit form:

- [ ] Determine compliance level (`locked` / `configurable` / `freeform`)
- [ ] Parse `customizableFields[]` from template
- [ ] For each customizable field:
  - [ ] Identify data type (percentage, amount, enum, boolean)
  - [ ] Check if legal bounds exist (`legalRanges` in template)
  - [ ] Select appropriate widget from matrix
  - [ ] Include legal reference in FormDescription
- [ ] For all non-customizable fields:
  - [ ] Use `ReadOnlyField` component
  - [ ] Include legal reference (Code Général des Impôts, Décret CNPS, etc.)
  - [ ] Add 🔒 Lock icon
- [ ] Add compliance notice at bottom:
  ```tsx
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      <strong>Conformité légale garantie</strong> – Les paramètres fiscaux et sociaux sont automatiquement mis à jour selon les évolutions législatives.
    </AlertDescription>
  </Alert>
  ```

---

## Touch-Friendly Requirements

All widgets MUST meet:

- ✅ **Touch targets:** Minimum 44×44px (iOS HIG / Material Design)
- ✅ **Input height:** `min-h-[48px]` (increased from default 36px)
- ✅ **Button height:** `min-h-[56px]` for primary actions
- ✅ **Slider thumb:** 44×44px minimum
- ✅ **Spacing:** `gap-4` minimum between interactive elements
- ✅ **Font size:** Minimum 16px (prevents iOS zoom on focus)

---

## Accessibility Requirements

- ✅ **Labels:** All inputs have visible labels
- ✅ **ARIA:** Proper `aria-label` and `aria-describedby`
- ✅ **Error messages:** Clearly associated with fields
- ✅ **Focus indicators:** Visible focus rings
- ✅ **Keyboard navigation:** Tab order follows visual order
- ✅ **Screen readers:** Legal references announced

---

## Legal References Database

Widgets should pull legal bounds from database:

```typescript
// Future: Load from template.legalRanges
const legalRanges = await getLegalRange(templateCode, countryCode, field);

// Returns:
{
  min: 0.20,
  max: 0.30,
  recommended: 0.25,
  legalReference: "Convention Collective Article 20",
  enforcementLevel: "mandatory" | "recommended"
}
```

Currently hardcoded in component, but architecture allows database-driven future.

---

## Next Steps

1. ✅ **Current:** RateSlider implemented for housing allowance
2. ⏳ **Next:** Implement AmountSlider for transport allowance
3. ⏳ **Future:** Create reusable `<DynamicComponentEditor>` that auto-selects widget
4. ⏳ **Future:** Load legal bounds from database (`template.legalRanges`)
5. ⏳ **Future:** Add sector-specific bounds (e.g., BTP hazard pay 15-25%)

---

**Status:** 📋 Ready for implementation
**Next Action:** Implement AmountSlider + Select widgets
**Dependencies:** None (RateSlider proves approach works)
