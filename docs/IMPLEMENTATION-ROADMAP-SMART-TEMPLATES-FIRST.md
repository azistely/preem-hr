# Implementation Roadmap: Smart Templates First, Then Compliance

**Strategy:** Build Smart Templates (Phase 4-Alternative) with compliance baked in from day 1, then tackle critical compliance EPICs.

**Timeline:** 7 weeks total
**Status:** 📋 **READY TO BEGIN**

---

## Why This Order?

### Smart Templates First (3 weeks)
1. ✅ **Foundation for compliance** - Templates ARE the compliance delivery mechanism
2. ✅ **Immediate user value** - 10× faster component creation
3. ✅ **Low risk** - Uses existing formula types (fixed, percentage, auto-calculated)
4. ✅ **Enables self-service** - Tenants add compliant components without training

### Compliance EPICs Second (4 weeks)
1. ✅ **Built on templates** - Termination uses template-based salary calculations
2. ✅ **Proven foundation** - Smart templates already tested
3. ✅ **Faster development** - Reuse template infrastructure

**Total:** 7 weeks to full compliance + great UX

---

## Phase 1: Smart Templates with Compliance (Weeks 1-3)

### Implementation: EPIC-05 Enhancement

**New Feature: FEATURE 10 - Smart Component Library**

```
EPIC-05: Payroll
├── FEATURE 1-7: ✅ Already implemented (calculations, multi-country)
├── FEATURE 8: ✅ Event-driven payroll
└── FEATURE 10: 🆕 Smart Component Library (NEW)
    ├── Story 10.1: Template Management System
    ├── Story 10.2: Quick-Add UI with Compliance Badges
    ├── Story 10.3: Compliance Validator
    ├── Story 10.4: Customization Dialog (Configurable Templates)
    └── Story 10.5: Multi-Country Template Seeding
```

### Week 1: Backend Infrastructure

#### Story 10.1: Template Management System
**Tasks:**
- [ ] Enhance `salary_component_templates` table
  ```sql
  ALTER TABLE salary_component_templates
  ADD COLUMN compliance_level TEXT DEFAULT 'freeform'
    CHECK (compliance_level IN ('locked', 'configurable', 'freeform')),
  ADD COLUMN legal_reference TEXT,
  ADD COLUMN customizable_fields JSONB DEFAULT '[]',
  ADD COLUMN can_deactivate BOOLEAN DEFAULT true,
  ADD COLUMN can_modify BOOLEAN DEFAULT true;

  -- Add min/max to calculation rules (JSONB)
  -- Example metadata:
  -- {
  --   "calculationRule": {
  --     "type": "percentage",
  --     "rate": 0.20,
  --     "minRate": 0.20,
  --     "maxRate": 0.30
  --   }
  -- }
  ```

- [ ] Create `compliance_rules` table
  ```sql
  CREATE TABLE compliance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL REFERENCES countries(code),
    rule_type TEXT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    can_exceed BOOLEAN DEFAULT false,
    legal_reference TEXT NOT NULL,
    validation_logic JSONB NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Example: SMIG minimum for CI
  INSERT INTO compliance_rules VALUES (
    gen_random_uuid(),
    'CI',
    'minimum_wage',
    true,  -- mandatory
    true,  -- can pay MORE
    'Convention Collective Article 11',
    '{"minimum": 75000, "applies_to": "all_employees"}',
    '2025-01-01',
    NULL
  );
  ```

- [ ] Implement `ComplianceValidator` service
  ```typescript
  // lib/compliance/compliance-validator.ts
  export class ComplianceValidator {
    async validateComponent(
      template: SalaryComponentTemplate,
      customization: Partial<ComponentMetadata>,
      tenant: Tenant
    ): Promise<ValidationResult> {
      const rules = await this.getApplicableRules(tenant.countryCode, template);
      const violations = [];

      for (const rule of rules) {
        const result = await this.checkRule(rule, template, customization);
        if (!result.compliant) {
          violations.push({
            ruleType: rule.ruleType,
            legalReference: rule.legalReference,
            violation: result.error,
            severity: rule.isMandatory ? 'critical' : 'warning',
          });
        }
      }

      return {
        compliant: violations.filter(v => v.severity === 'critical').length === 0,
        violations,
      };
    }
  }
  ```

- [ ] Enhance tRPC endpoint: `quickAddFromTemplate`
  ```typescript
  // server/routers/salary-components.ts
  quickAddFromTemplate: protectedProcedure
    .input(z.object({
      templateCode: z.string(),
      customization: z.object({
        name: z.string().optional(),
        calculationRule: z.object({
          rate: z.number().optional(),
          baseAmount: z.number().optional(),
        }).optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { tenantId, userId } = ctx;
      const { templateCode, customization } = input;

      // 1. Load template
      const template = await getTemplate(templateCode, ctx.tenant.countryCode);

      // 2. Validate customization (COMPLIANCE CHECK)
      const validator = new ComplianceValidator();
      const validation = await validator.validateComponent(
        template,
        customization || {},
        ctx.tenant
      );

      if (!validation.compliant) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.violations[0].violation,
          cause: { legalReference: validation.violations[0].legalReference },
        });
      }

      // 3. Merge template + customization
      const finalMetadata = mergeMetadata(template.metadata, customization);

      // 4. Create component
      const component = await db.insert(customSalaryComponents).values({
        tenantId,
        code: await generateCustomCode(tenantId),
        name: customization?.name || template.name.fr,
        description: template.description,
        countryCode: template.countryCode,
        templateCode: template.code,
        metadata: finalMetadata,
        isActive: true,
        createdBy: userId,
      });

      return component;
    });
  ```

**Effort:** 5 days

---

### Week 2: Frontend UI

#### Story 10.2: Quick-Add UI with Compliance Badges
**Tasks:**
- [ ] Create `QuickAddTemplate` component
  ```tsx
  // components/salary-components/quick-add-template.tsx
  export function QuickAddTemplate() {
    const { data: templates } = useComponentTemplates(
      tenant.countryCode,
      true // popularOnly
    );

    const quickAdd = useQuickAddFromTemplate();

    return (
      <Card>
        <CardHeader>
          <CardTitle>Composants populaires</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Locked Templates */}
          <TemplateSection
            title="Obligatoires (Convention Collective)"
            icon={<Lock />}
            templates={templates?.filter(t => t.complianceLevel === 'locked')}
            badge={<Badge variant="destructive">Obligatoire</Badge>}
          />

          {/* Configurable Templates */}
          <TemplateSection
            title="Configurables (dans les limites légales)"
            icon={<Settings />}
            templates={templates?.filter(t => t.complianceLevel === 'configurable')}
            badge={<Badge variant="outline">Configurable</Badge>}
            onAdd={(template) => openCustomizationDialog(template)}
          />

          {/* Freeform Templates */}
          <TemplateSection
            title="Personnalisés (exemples)"
            icon={<Sparkles />}
            templates={templates?.filter(t => t.complianceLevel === 'freeform')}
            badge={<Badge variant="secondary">Personnalisé</Badge>}
          />
        </CardContent>
      </Card>
    );
  }
  ```

- [ ] Create `TemplateCard` component with badges
  ```tsx
  // components/salary-components/template-card.tsx
  export function TemplateCard({ template, onAdd }: TemplateCardProps) {
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent">
        <div className="flex items-center gap-3">
          <ComplianceBadge level={template.complianceLevel} />
          <div>
            <p className="font-medium">{template.name.fr}</p>
            <p className="text-sm text-muted-foreground">
              {formatFormulaSummary(template.metadata.calculationRule)}
            </p>
            {template.legalReference && (
              <p className="text-xs text-muted-foreground mt-1">
                📜 {template.legalReference}
              </p>
            )}
          </div>
        </div>

        <Button size="sm" onClick={() => onAdd(template)}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>
    );
  }
  ```

**Effort:** 4 days

#### Story 10.3: Customization Dialog
**Tasks:**
- [ ] Create `CustomizationDialog` component
  ```tsx
  // components/salary-components/customization-dialog.tsx
  export function CustomizationDialog({ template, open, onClose }: Props) {
    const [customization, setCustomization] = useState({});
    const { mutate: addComponent } = useQuickAddFromTemplate();

    // Real-time validation
    const validation = useComplianceValidation(template, customization);

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{template.name.fr}</DialogTitle>
            <DialogDescription>
              Personnalisez ce composant dans les limites légales
            </DialogDescription>
          </DialogHeader>

          {/* Customizable fields based on template.customizableFields */}
          {template.customizableFields.includes('calculationRule.rate') && (
            <FormField>
              <Label>Pourcentage</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={template.metadata.calculationRule.minRate * 100}
                  max={template.metadata.calculationRule.maxRate * 100}
                  value={customization.rate * 100}
                  onChange={(e) => setCustomization({
                    ...customization,
                    rate: Number(e.target.value) / 100,
                  })}
                />
                <span className="text-sm text-muted-foreground">
                  {template.metadata.calculationRule.minRate * 100}% -
                  {template.metadata.calculationRule.maxRate * 100}%
                </span>
              </div>
            </FormField>
          )}

          {/* Validation errors */}
          {!validation.compliant && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {validation.violations[0].violation}
                <br />
                <span className="text-xs">
                  📜 {validation.violations[0].legalReference}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              onClick={() => addComponent({
                templateCode: template.code,
                customization,
              })}
              disabled={!validation.compliant}
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  ```

**Effort:** 3 days

---

### Week 3: Multi-Country Seeding + Integration

#### Story 10.4: Multi-Country Template Seeding
**Tasks:**
- [ ] Create seed migration for CI templates
  ```sql
  -- supabase/migrations/20251007_seed_ci_templates.sql

  -- 🔒 Locked Templates (Mandatory)
  INSERT INTO salary_component_templates VALUES
  (
    gen_random_uuid(),
    'TPT_SENIORITY_BONUS_CI',
    '{"fr": "Prime d''ancienneté"}',
    'Obligatoire selon la Convention Collective Article 16',
    'bonus',
    'CI',
    '{
      "calculationRule": {"type": "auto-calculated", "rate": 0.02, "cap": 0.12},
      "taxTreatment": {"isTaxable": true, "includeInBrutImposable": true},
      "socialSecurityTreatment": {"includeInCnpsBase": true}
    }'::jsonb,
    true,  -- isPopular
    1,     -- displayOrder
    'locked',
    'Convention Collective Article 16',
    '[]'::jsonb,
    false, -- canDeactivate
    false  -- canModify
  );

  -- ⚙️ Configurable Templates
  INSERT INTO salary_component_templates VALUES
  (
    gen_random_uuid(),
    'TPT_HOUSING_CI',
    '{"fr": "Indemnité de logement"}',
    'Allocation logement entre 20% et 30% du salaire de base',
    'allowance',
    'CI',
    '{
      "calculationRule": {
        "type": "percentage",
        "rate": 0.20,
        "minRate": 0.20,
        "maxRate": 0.30
      },
      "taxTreatment": {"isTaxable": true, "includeInBrutImposable": true},
      "socialSecurityTreatment": {"includeInCnpsBase": true}
    }'::jsonb,
    true,
    2,
    'configurable',
    'Convention Collective Article 20',
    '["calculationRule.rate"]'::jsonb,
    true,  -- canDeactivate (optional allowance)
    true   -- canModify
  ),
  (
    gen_random_uuid(),
    'TPT_TRANSPORT_CI',
    '{"fr": "Prime de transport"}',
    'Allocation transport (exonérée jusqu''à 30,000 FCFA)',
    'allowance',
    'CI',
    '{
      "calculationRule": {
        "type": "fixed",
        "baseAmount": 25000,
        "maxAmount": 30000
      },
      "taxTreatment": {
        "isTaxable": true,
        "exemptionCap": 30000
      },
      "socialSecurityTreatment": {"includeInCnpsBase": false}
    }'::jsonb,
    true,
    3,
    'configurable',
    'Convention Collective Article 20',
    '["calculationRule.baseAmount"]'::jsonb,
    true,
    true
  );

  -- 🎨 Freeform Templates (Examples)
  INSERT INTO salary_component_templates VALUES
  (
    gen_random_uuid(),
    'TPT_REMOTE_WORK_CI',
    '{"fr": "Allocation télétravail"}',
    'Allocation pour le travail à distance',
    'allowance',
    'CI',
    '{
      "calculationRule": {"type": "fixed", "baseAmount": 20000},
      "taxTreatment": {"isTaxable": true, "includeInBrutImposable": true},
      "socialSecurityTreatment": {"includeInCnpsBase": true}
    }'::jsonb,
    false,  -- Not in popular list
    100,
    'freeform',
    NULL,  -- Not regulated
    '["calculationRule.type", "calculationRule.baseAmount", "calculationRule.rate"]'::jsonb,
    true,
    true
  );
  ```

- [ ] Seed SN, BF, ML templates (similar structure, different values)
- [ ] Add templates to `/app/settings/salary-components` page
  ```tsx
  // app/settings/salary-components/page.tsx
  export default function SalaryComponentsPage() {
    return (
      <div className="space-y-6">
        {/* Quick-Add Section */}
        <QuickAddTemplate />

        {/* Existing custom components */}
        <Card>
          <CardHeader>
            <CardTitle>Vos composants personnalisés</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomComponentsList />
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

**Effort:** 5 days

---

## Phase 2: Critical Compliance EPICs (Weeks 4-7)

### Week 4: EPIC-10 Story 1-2 (Termination Wizard + Notice Period)
- [ ] Create `employee_terminations` table
- [ ] Implement notice period calculator
- [ ] Build termination wizard UI
- [ ] Integrate with employee management

### Week 5: EPIC-10 Story 3 (Severance Calculator)
- [ ] Implement severance calculation service
- [ ] Average salary calculator (last 12 months)
- [ ] Tiered rate calculation (30%/35%/40%)
- [ ] Tax treatment logic

### Week 6: EPIC-10 Story 4 (Document Generation)
- [ ] Work certificate PDF generator
- [ ] Final payslip generator
- [ ] CNPS attestation generator
- [ ] Document storage integration

### Week 7: EPIC-07 Enhancement (Overtime)
- [ ] Add overtime rates to database
- [ ] Implement overtime calculation
- [ ] Integrate with payroll
- [ ] Add overtime UI to time tracking

---

## Success Metrics

### End of Week 3 (Smart Templates):
- [ ] Tenants can add 30+ pre-configured components in < 30 seconds
- [ ] Compliance badges visible on all templates
- [ ] Customization validated against legal ranges
- [ ] Support tickets for "how to add X" reduced by 80%

### End of Week 7 (Full Compliance):
- [ ] Can legally terminate employees (with all documents)
- [ ] Severance calculated correctly for all tenure scenarios
- [ ] Overtime tracked and paid correctly
- [ ] System passes labor inspection audit

---

## Implementation Order Justification

**Why Smart Templates First:**

1. **User Value First** - Immediate 10× productivity gain
2. **Foundation for Compliance** - Templates ARE how we deliver compliance
3. **Low Risk** - Uses existing formula system
4. **Enables Self-Service** - Tenants learn system faster
5. **Validates Approach** - Proves 3-tier compliance model works

**Why Compliance Second:**

1. **Built on Templates** - Termination reuses template-based calculations
2. **Less Urgent** - Most clients not terminating employees daily
3. **Needs Testing** - More complex, needs thorough validation
4. **Legal Review** - Documents need lawyer approval

---

## Risk Mitigation

### Risks:
1. **Legal validation delays** - Wait for lawyer review
2. **Multi-country complexity** - Start with CI, expand later
3. **User adoption** - Templates might confuse users

### Mitigations:
1. **Parallel legal review** - Start during Week 1-2
2. **Country-by-country rollout** - CI → SN → BF
3. **Progressive disclosure** - Show locked first, freeform later

---

**Status:** 📋 Ready to begin implementation
**Start Date:** Next sprint (after approval)
**Owner:** Development team + Legal advisor
**Dependencies:** None (all prerequisites met)
