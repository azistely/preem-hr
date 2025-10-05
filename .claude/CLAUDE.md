# Claude Code Instructions for Preem HR

> This file contains project-specific instructions that Claude Code will automatically read at the start of every session.

## 🎯 Project Mission

Build an enterprise HR/payroll system for French-speaking West Africa that is:
- **Simple enough** for users with low digital literacy and zero HR knowledge
- **Powerful enough** to handle complex multi-country payroll regulations
- **Modern and elegant** in design and user experience

## 📚 Required Reading (ALWAYS)

Before implementing ANY feature, you MUST read:

1. **`docs/01-CONSTRAINTS-AND-RULES.md`** - Hard constraints that can NEVER be violated
2. **`docs/HCI-DESIGN-PRINCIPLES.md`** - UX principles for low digital literacy
3. Relevant EPIC document (e.g., `docs/05-EPIC-PAYROLL.md`)

## 🎨 UI/UX Non-Negotiables

### Core Philosophy
> "If a user needs documentation to use a feature, we failed."

Every UI feature MUST pass this checklist:
- [ ] Can a user with **no HR knowledge** complete this task?
- [ ] Can it be done on a **slow 3G connection**?
- [ ] Are there **fewer than 3 steps** to complete the primary action?
- [ ] Is the primary action **obvious within 3 seconds**?
- [ ] Can it be used **with one hand** on a 5" phone screen?
- [ ] Does it work **without any help text** or documentation?

### HCI Principles (MANDATORY)

1. **Zero Learning Curve** - Instant understanding, no training required
2. **Task-Oriented Design** - Design around user goals ("Pay my employees"), not system operations
3. **Error Prevention** - Make it impossible to make mistakes (disable invalid actions)
4. **Cognitive Load Minimization** - Show only what's needed for the current step
5. **Immediate Feedback** - Every action gets instant, clear visual confirmation
6. **Graceful Degradation** - Works perfectly on slow networks and old devices

### Design Patterns to Always Use

#### ✅ Wizards for Complex Tasks
```tsx
// Break complex tasks into 3-5 simple steps
<Wizard>
  <WizardStep title="Quelle période?" icon={Calendar}>
    <MonthPicker />
  </WizardStep>
  <WizardStep title="Vérifiez les employés" icon={Users}>
    <EmployeeList />
  </WizardStep>
  <WizardStep title="Confirmation" icon={Check}>
    <ReviewSummary />
  </WizardStep>
</Wizard>
```

#### ✅ Progressive Disclosure
```tsx
// Show essential info, hide complexity behind "Voir les détails"
<Card>
  <div className="text-3xl font-bold">{netSalary} FCFA</div>
  <Collapsible>
    <CollapsibleTrigger>Voir les détails</CollapsibleTrigger>
    <CollapsibleContent>
      <DetailedBreakdown />
    </CollapsibleContent>
  </Collapsible>
</Card>
```

#### ✅ Smart Defaults
```tsx
// Pre-fill with 95% probable value
<DatePicker
  defaultValue={getNextPaymentDate()} // Auto-calculated
  helperText="Habituellement le 5 du mois suivant"
/>
```

### Design Patterns to NEVER Use

#### ❌ Information Overload
```tsx
// DON'T show everything at once
<div>
  <p>Gross Salary: {gross}</p>
  <p>CNPS Employee: {cnpsEmp}</p>
  <p>CNPS Employer: {cnpsEr}</p>
  <p>Taxable Income: {taxable}</p>
  <p>ITS Bracket 1: {br1}</p>
  {/* ... 20 more lines */}
</div>
```

#### ❌ Technical Jargon
```tsx
// DON'T expose system internals
<label>Tax System ID:</label>
<input name="taxSystemId" />

// DO use business language
<label>Pays:</label>
<select>
  <option value="CI">🇨🇮 Côte d'Ivoire</option>
</select>
```

## 🔧 Technical Requirements

### UI Library: shadcn/ui (Radix UI + Tailwind)
- **Buttons:** min-h-[44px] for touch targets
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React (always with text, never icon-only)
- **Language:** 100% French (no English in UI)

### Spacing & Typography
```tsx
// Touch targets
Button: min-h-[44px] min-w-[44px]
Input: min-h-[48px]
Primary CTA: min-h-[56px]

// Text sizes
Primary: text-3xl font-bold (outcomes)
Secondary: text-lg (actions, labels)
Tertiary: text-sm text-muted-foreground (hints)

// Spacing
gap-4  // Default between fields
gap-6  // Between sections
gap-8  // Between major page sections
```

### Colors (Semantic)
- `primary` - Main actions, key results
- `success` - Completed, approved, paid
- `destructive` - Errors, warnings, delete
- `muted` - Secondary info, disabled states

## 🚫 Common Mistakes to Avoid

1. **Don't assume users understand HR terms** - Explain or hide complexity
2. **Don't use small touch targets** - Always min 44×44px
3. **Don't show all fields at once** - Use wizards and progressive disclosure
4. **Don't use English** - Everything in French (business language)
5. **Don't forget mobile** - Design for 5" screens first
6. **Don't skip loading states** - Show feedback for operations > 300ms

## 📋 Implementation Checklist

When implementing a new UI feature:

1. [ ] Read `docs/HCI-DESIGN-PRINCIPLES.md`
2. [ ] Design with wizard/progressive disclosure pattern
3. [ ] All text in French (use `lib/i18n/fr.ts`)
4. [ ] Touch targets ≥ 44×44px
5. [ ] Smart defaults implemented
6. [ ] Loading states added
7. [ ] Error prevention (not just handling)
8. [ ] Test on mobile viewport (375×667)
9. [ ] Verify with HCI checklist above

## 🎯 Success Metrics

Every feature should optimize for:
- **Task completion rate** > 90% (without help)
- **Time to complete** < 3 minutes (for payroll run)
- **Error rate** < 5%
- **Help requests** < 10% of tasks

---

**Remember:** The goal is not to build a feature-complete system. The goal is to build a system that **anyone can use effortlessly**, even with zero training.
