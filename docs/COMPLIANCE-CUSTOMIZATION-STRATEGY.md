# Compliance-First Customization Strategy

**Challenge:** How do we let tenants customize their HR system while maintaining legal compliance with Convention Collective?

**Status:** 🎯 **STRATEGY DEFINED**

---

## Core Principle

> **"Compliance is non-negotiable. Customization lives within safe boundaries."**

We use a **3-tier system**:
1. 🔒 **Locked** - Cannot be changed (legal minimums)
2. ⚙️ **Configurable** - Can customize within legal bounds
3. 🎨 **Freeform** - Fully customizable (non-regulated areas)

---

## Tier 1: 🔒 Locked (Legal Minimums)

**What:** Legal requirements from Convention Collective that **cannot** be disabled or reduced.

**Examples:**
- ✅ SMIG minimum wage (75,000 FCFA for CI)
- ✅ Seniority bonus (2-12%, Article 16)
- ✅ Notice periods (8 days - 3 months by category, Article 35)
- ✅ Severance rates (30%/35%/40%, Article 37)
- ✅ Annual leave minimums (24 days, Article 28)
- ✅ Maternity leave (14 weeks, Article 30)
- ✅ Overtime rates (15-100%, Article 23)

**Implementation:**
```typescript
// Database: compliance_rules table
interface ComplianceRule {
  id: string;
  country_code: string;
  rule_type: 'minimum_wage' | 'seniority_bonus' | 'notice_period' | 'severance' | 'leave' | 'overtime';
  is_mandatory: true; // Always true for Tier 1
  can_exceed: boolean; // Can pay MORE, but not less
  legal_reference: string; // "Convention Collective Article 16"
  validation_logic: JSONLogic; // Validation rules
}

// Validation at runtime
export function validateSalary(salary: number, employee: Employee): ValidationResult {
  const smig = await getMinimumWage(employee.tenant.countryCode);
  const categoryMinimum = smig * (employee.coefficient / 100);

  if (salary < categoryMinimum) {
    return {
      valid: false,
      error: `Salaire inférieur au minimum légal (${categoryMinimum} FCFA) pour la catégorie ${employee.category} (coefficient ${employee.coefficient})`,
      legalReference: 'Convention Collective Article 11',
      cannotOverride: true, // 🔒 LOCKED
    };
  }

  return { valid: true };
}
```

**UI Treatment:**
```tsx
{/* Locked fields show lock icon + explanation */}
<FormField disabled>
  <Label>
    Prime d'ancienneté
    <Lock className="h-3 w-3 ml-1" />
    <Tooltip>
      Obligatoire selon la Convention Collective (Article 16).
      2% par an, maximum 12% après 26 ans.
    </Tooltip>
  </Label>
  <Input value="2% par an" disabled />
</FormField>
```

**Tenant Cannot:**
- ❌ Disable seniority bonus
- ❌ Reduce annual leave below 24 days
- ❌ Pay below SMIG
- ❌ Reduce severance rates

**Tenant Can:**
- ✅ Add EXTRA allowances (on top of mandatory ones)
- ✅ Increase leave beyond minimum (e.g., 30 days instead of 24)
- ✅ Pay MORE than SMIG
- ✅ Add discretionary bonuses

---

## Tier 2: ⚙️ Configurable (Within Legal Bounds)

**What:** Legal requirements that have **ranges** or **optional configurations**.

**Examples:**
- ⚙️ Housing allowance: 20-30% (tenant chooses percentage)
- ⚙️ Transport allowance: Tax-exempt up to 30,000 FCFA (tenant chooses amount ≤ cap)
- ⚙️ Cashier allowance: 10-15% (tenant chooses percentage)
- ⚙️ Hazard pay: 15-25% (tenant chooses based on risk level)
- ⚙️ Representation allowance: 20-40% (tenant chooses for executives)
- ⚙️ Leave carryover: 0-6 months (tenant chooses policy)

**Implementation:**
```typescript
// Smart Template with configurable range
interface SalaryComponentTemplate {
  code: string;
  name: Record<string, string>;
  category: 'allowance' | 'bonus' | 'deduction';
  metadata: {
    calculationRule: {
      type: 'percentage' | 'fixed';
      // Legal range (enforced)
      minRate?: number;
      maxRate?: number;
      minAmount?: number;
      maxAmount?: number;
      // Tenant's choice (validated against range)
      rate?: number;
      baseAmount?: number;
    };
    taxTreatment: {
      isTaxable: boolean;
      exemptionCap?: number; // e.g., 30,000 FCFA for transport
    };
  };
  legalReference: string;
  customizableFields: string[]; // Which fields tenant can change
}

// Example: Transport allowance template
const transportTemplate: SalaryComponentTemplate = {
  code: 'TPT_TRANSPORT_CI',
  name: { fr: 'Prime de transport' },
  category: 'allowance',
  metadata: {
    calculationRule: {
      type: 'fixed',
      minAmount: 0,
      maxAmount: 30000, // Tax-exempt cap
      baseAmount: 25000, // Default (tenant can change)
    },
    taxTreatment: {
      isTaxable: true,
      exemptionCap: 30000, // Cannot change (legal limit)
    },
  },
  legalReference: 'Convention Collective Article 20',
  customizableFields: ['calculationRule.baseAmount'], // Tenant can change amount
};

// Validation
export function validateComponentCustomization(
  template: SalaryComponentTemplate,
  customization: Partial<ComponentMetadata>
): ValidationResult {
  const rule = template.metadata.calculationRule;
  const customRule = customization.calculationRule;

  if (customRule?.baseAmount) {
    if (rule.maxAmount && customRule.baseAmount > rule.maxAmount) {
      return {
        valid: false,
        error: `Montant maximum: ${rule.maxAmount} FCFA (exonération fiscale)`,
        legalReference: template.legalReference,
      };
    }
  }

  return { valid: true };
}
```

**UI Treatment:**
```tsx
{/* Configurable fields show range + validation */}
<FormField>
  <Label>
    Prime de transport
    <Badge variant="outline">Configurable</Badge>
    <Tooltip>
      Vous pouvez choisir le montant jusqu'à 30,000 FCFA
      (limite d'exonération fiscale).
    </Tooltip>
  </Label>
  <div className="flex items-center gap-2">
    <Input
      type="number"
      min={0}
      max={30000}
      value={amount}
      onChange={(e) => setAmount(Number(e.target.value))}
    />
    <span className="text-sm text-muted-foreground">
      Max: 30,000 FCFA
    </span>
  </div>
  {amount > 30000 && (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Au-delà de 30,000 FCFA, la prime devient imposable.
      </AlertDescription>
    </Alert>
  )}
</FormField>
```

**Tenant Can:**
- ✅ Choose housing allowance: 20%, 25%, or 30%
- ✅ Set transport allowance: 15,000 - 30,000 FCFA
- ✅ Configure hazard pay: 15-25% based on actual risk
- ✅ Adjust leave carryover: 0-6 months

**Tenant Cannot:**
- ❌ Set transport > 30,000 FCFA without tax warning
- ❌ Set housing > 30% (outside legal range)
- ❌ Configure outside validated ranges

---

## Tier 3: 🎨 Freeform (Non-Regulated)

**What:** Company-specific allowances **not** covered by Convention Collective.

**Examples:**
- 🎨 Remote work allowance (new, not in 1977 Convention)
- 🎨 Internet/phone credit (not regulated)
- 🎨 Gym membership
- 🎨 Parking allowance
- 🎨 Performance bonuses (discretionary)
- 🎨 Project completion bonuses
- 🎨 Education/training stipends

**Implementation:**
```typescript
// Fully customizable component
export async function createCustomComponent(input: {
  tenantId: string;
  name: string;
  category: 'allowance' | 'bonus' | 'deduction';
  calculationRule: {
    type: 'fixed' | 'percentage';
    baseAmount?: number;
    rate?: number;
  };
  taxTreatment: ComponentTaxTreatment;
  socialSecurityTreatment: ComponentSocialSecurityTreatment;
}): Promise<CustomSalaryComponent> {
  // NO legal validation (not regulated)
  // Full flexibility

  const component = await db.insert(customSalaryComponents).values({
    tenantId: input.tenantId,
    code: generateUniqueCode(input.tenantId),
    name: input.name,
    category: input.category,
    metadata: {
      calculationRule: input.calculationRule,
      taxTreatment: input.taxTreatment,
      socialSecurityTreatment: input.socialSecurityTreatment,
    },
    isActive: true,
    templateCode: null, // Not based on template
    complianceLevel: 'freeform', // 🎨 Mark as non-regulated
  });

  return component;
}
```

**UI Treatment:**
```tsx
{/* Freeform components show flexibility badge */}
<FormField>
  <Label>
    Allocation télétravail
    <Badge variant="secondary">Personnalisé</Badge>
    <Tooltip>
      Composant personnalisé (non réglementé).
      Vous avez une flexibilité totale.
    </Tooltip>
  </Label>
  <Select value={type} onValueChange={setType}>
    <SelectItem value="fixed">Montant fixe</SelectItem>
    <SelectItem value="percentage">Pourcentage du salaire</SelectItem>
  </Select>

  {type === 'fixed' && (
    <Input
      type="number"
      placeholder="Montant en FCFA"
      // NO max validation (fully flexible)
    />
  )}

  {type === 'percentage' && (
    <Input
      type="number"
      placeholder="Pourcentage (ex: 10 pour 10%)"
      min={0}
      max={100}
      // Reasonable range, but not legal requirement
    />
  )}
</FormField>
```

**Tenant Can:**
- ✅ Create ANY custom component
- ✅ Set ANY amount or percentage
- ✅ Define custom tax treatment (within tax law, but not Convention Collective)
- ✅ Delete or disable anytime

---

## Smart Templates: Compliance-Aware Design

**Template Categories:**

### Category A: 🔒 Locked Templates (Pre-configured, tenant can only activate)
```typescript
const lockedTemplates = [
  {
    code: 'TPT_SENIORITY_BONUS',
    name: { fr: 'Prime d\'ancienneté' },
    complianceLevel: 'locked',
    metadata: {
      calculationRule: {
        type: 'auto-calculated',
        rate: 0.02, // 2% per year
        cap: 0.12,  // Max 12%
      },
    },
    legalReference: 'Convention Collective Article 16',
    canDeactivate: false, // Must be active for all employees
    canModify: false,     // Cannot change formula
  },
];
```

### Category B: ⚙️ Configurable Templates (Tenant adjusts within bounds)
```typescript
const configurableTemplates = [
  {
    code: 'TPT_HOUSING_CI',
    name: { fr: 'Indemnité de logement' },
    complianceLevel: 'configurable',
    metadata: {
      calculationRule: {
        type: 'percentage',
        rate: 0.20, // Default 20%
        minRate: 0.20, // Legal minimum
        maxRate: 0.30, // Legal maximum
      },
    },
    legalReference: 'Convention Collective Article 20',
    canDeactivate: true,  // Optional allowance
    canModify: true,      // Can adjust rate (20-30%)
    customizableFields: ['calculationRule.rate'],
  },
  {
    code: 'TPT_TRANSPORT_CI',
    name: { fr: 'Prime de transport' },
    complianceLevel: 'configurable',
    metadata: {
      calculationRule: {
        type: 'fixed',
        baseAmount: 25000,
        maxAmount: 30000, // Tax-exempt cap
      },
      taxTreatment: {
        isTaxable: true,
        exemptionCap: 30000, // Cannot exceed
      },
    },
    legalReference: 'Convention Collective Article 20',
    canDeactivate: true,
    canModify: true,
    customizableFields: ['calculationRule.baseAmount'],
  },
];
```

### Category C: 🎨 Freeform Templates (Suggestions, fully modifiable)
```typescript
const freeformTemplates = [
  {
    code: 'TPT_REMOTE_WORK',
    name: { fr: 'Allocation télétravail' },
    complianceLevel: 'freeform',
    metadata: {
      calculationRule: {
        type: 'fixed',
        baseAmount: 20000, // Suggested amount
      },
    },
    legalReference: null, // Not regulated
    canDeactivate: true,
    canModify: true,
    customizableFields: ['calculationRule.type', 'calculationRule.baseAmount', 'calculationRule.rate'],
  },
];
```

---

## Quick-Add UI with Compliance Levels

```tsx
<Card>
  <CardHeader>
    <CardTitle>Composants populaires</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Locked Templates */}
    <div className="space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Lock className="h-4 w-4" />
        Obligatoires (Convention Collective)
      </h3>
      {lockedTemplates.map((template) => (
        <TemplateCard
          key={template.code}
          template={template}
          badge={<Badge variant="destructive">Obligatoire</Badge>}
          actions={
            <Button size="sm" disabled={alreadyAdded}>
              {alreadyAdded ? 'Déjà ajouté' : 'Ajouter'}
            </Button>
          }
        />
      ))}
    </div>

    {/* Configurable Templates */}
    <div className="space-y-2 mt-6">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Settings className="h-4 w-4" />
        Configurables (dans les limites légales)
      </h3>
      {configurableTemplates.map((template) => (
        <TemplateCard
          key={template.code}
          template={template}
          badge={<Badge variant="outline">Configurable</Badge>}
          actions={
            <Button
              size="sm"
              onClick={() => openCustomizationDialog(template)}
            >
              Ajouter et configurer
            </Button>
          }
        />
      ))}
    </div>

    {/* Freeform Templates */}
    <div className="space-y-2 mt-6">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Personnalisés (exemples)
      </h3>
      {freeformTemplates.map((template) => (
        <TemplateCard
          key={template.code}
          template={template}
          badge={<Badge variant="secondary">Personnalisé</Badge>}
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCustomizationDialog(template)}
            >
              Utiliser comme modèle
            </Button>
          }
        />
      ))}
    </div>

    {/* Create from scratch */}
    <Button variant="ghost" className="w-full mt-6">
      <Plus className="h-4 w-4 mr-2" />
      Créer un composant personnalisé
    </Button>
  </CardContent>
</Card>
```

---

## Compliance Validation Engine

```typescript
export class ComplianceValidator {
  /**
   * Validate tenant customization against legal requirements
   */
  async validate(
    tenant: Tenant,
    component: CustomSalaryComponent
  ): Promise<ValidationResult> {
    const rules = await this.getComplianceRules(tenant.countryCode);
    const violations: ComplianceViolation[] = [];

    // Check each applicable rule
    for (const rule of rules) {
      const result = await this.checkRule(rule, component);
      if (!result.compliant) {
        violations.push({
          ruleType: rule.rule_type,
          legalReference: rule.legal_reference,
          violation: result.error,
          severity: rule.is_mandatory ? 'critical' : 'warning',
          canOverride: !rule.is_mandatory,
        });
      }
    }

    return {
      compliant: violations.filter(v => v.severity === 'critical').length === 0,
      violations,
    };
  }

  /**
   * Check specific rule
   */
  private async checkRule(
    rule: ComplianceRule,
    component: CustomSalaryComponent
  ): Promise<RuleCheckResult> {
    switch (rule.rule_type) {
      case 'seniority_bonus':
        return this.checkSeniorityBonus(component);
      case 'minimum_wage':
        return this.checkMinimumWage(component);
      case 'transport_exemption':
        return this.checkTransportExemption(component);
      default:
        return { compliant: true };
    }
  }
}
```

---

## Tenant Customization Workflows

### Workflow 1: Add Locked Component (Mandatory)
```
User: "Ajouter Prime d'ancienneté"
System: ✅ Auto-adds with pre-configured formula (2-12%)
System: Shows "Obligatoire selon Convention Collective"
System: Does NOT allow modification
Result: Component active for all employees
```

### Workflow 2: Add Configurable Component
```
User: "Ajouter Indemnité de logement"
System: Shows customization dialog
System: "Choisissez le pourcentage: 20-30%"
User: Selects 25%
System: ✅ Validates (25% within 20-30%)
System: Adds component with 25% rate
Result: All employees get 25% housing allowance
```

### Workflow 3: Add Freeform Component
```
User: "Créer Allocation télétravail"
System: Shows component builder
User: Chooses "Montant fixe" + 20,000 FCFA
System: No legal validation (not regulated)
System: ✅ Creates custom component
Result: Tenant has full flexibility
```

### Workflow 4: Attempt Invalid Customization
```
User: "Modifier Prime d'ancienneté à 1%"
System: ❌ Shows error
System: "Cette prime est obligatoire (2-12%) selon la Convention Collective Article 16"
System: Does NOT save change
Result: Compliance maintained
```

---

## Benefits of This Approach

### For Tenants:
- ✅ **Safe flexibility** - Customize within legal bounds
- ✅ **No compliance risk** - System prevents violations
- ✅ **Clear guidance** - Visual indicators (locked/configurable/freeform)
- ✅ **Fast setup** - Smart templates pre-configured
- ✅ **Audit-ready** - Automatic compliance documentation

### For Us (Preem):
- ✅ **Legal protection** - Cannot be sued for tenant's mistakes
- ✅ **Single codebase** - Same code for all countries
- ✅ **Easy audits** - Compliance rules in database
- ✅ **Competitive edge** - "The only compliant HR system"

### For Auditors:
- ✅ **Traceable** - Every component has legal reference
- ✅ **Verifiable** - Compliance rules match Convention Collective
- ✅ **Audit trail** - All changes logged with reasons

---

## Implementation Checklist

### Database Schema:
- [ ] Add `compliance_level` to salary_component_templates ('locked', 'configurable', 'freeform')
- [ ] Add `legal_reference` field
- [ ] Add `customizable_fields` JSONB array
- [ ] Add `min_rate`, `max_rate`, `min_amount`, `max_amount` to calculation rules
- [ ] Create `compliance_rules` table

### Backend:
- [ ] Implement ComplianceValidator service
- [ ] Add validation to quickAddFromTemplate endpoint
- [ ] Add validation to updateCustomComponent endpoint
- [ ] Create compliance audit log

### Frontend:
- [ ] Badge system (locked/configurable/freeform)
- [ ] Customization dialog with range validation
- [ ] Legal reference tooltips
- [ ] Error messages with legal citations

---

## Success Criteria

✅ Tenant can add mandatory components (locked)
✅ Tenant can customize within legal ranges (configurable)
✅ Tenant can create custom components (freeform)
❌ Tenant CANNOT violate legal minimums
✅ All customizations have audit trail
✅ Legal references shown in UI
✅ Compliance validator prevents violations

---

**Status:** 🎯 Strategy complete, ready for implementation
**Next Step:** Implement Smart Templates with 3-tier compliance system
**Owner:** Development team + Legal advisor
