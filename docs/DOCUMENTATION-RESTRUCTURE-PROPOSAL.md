# Documentation Restructure Proposal

**Date:** October 5, 2025
**Purpose:** Improve documentation organization for multi-country scalability
**Status:** Proposal (Pending Approval)

---

## Executive Summary

### Current Problems

1. **Country-Specific Mixed with Generic**
   - Côte d'Ivoire rules embedded in core documentation
   - Hard to add new countries without refactoring
   - Regulatory changes affect multiple files

2. **Flat Structure**
   - All docs in single `/docs` folder
   - Hard to navigate (16+ files)
   - No clear grouping by concern

3. **No Version History**
   - Regulatory changes overwrite old documentation
   - Cannot reference historical rates
   - Compliance audits difficult

4. **Source of Truth Ambiguity**
   - Multiple docs claim to be authoritative
   - Conflicts between documents
   - Hard to know which is current

### Proposed Solution

**Hierarchical folder structure:**
```
docs/
├── 00-START-HERE.md (Navigation guide)
├── core/ (Generic, country-agnostic)
├── countries/ (Country-specific regulations)
├── technical/ (Implementation guides)
├── regulatory/ (Versioned compliance docs)
├── decisions/ (Architecture Decision Records)
└── archive/ (Historical versions)
```

**Benefits:**
- ✅ Clear separation of concerns
- ✅ Easy to add new countries
- ✅ Version history preserved
- ✅ Better navigation
- ✅ Reduced duplication

---

## Proposed Structure

### Level 1: Root Navigation

```
docs/
├── 00-START-HERE.md ← MAIN ENTRY POINT
├── GLOSSARY.md
├── CHANGELOG.md
├── README.md (Auto-generated index)
│
├── core/ ← Generic documentation
├── countries/ ← Country-specific rules
├── technical/ ← Implementation guides
├── regulatory/ ← Versioned compliance
├── decisions/ ← ADRs (Architecture Decision Records)
└── archive/ ← Historical versions
```

### Level 2: Core Documentation (Generic)

```
docs/core/
├── 01-ARCHITECTURE.md
│   ├── System design
│   ├── Technology stack
│   ├── Patterns (CQRS, Event-Driven)
│   └── Multi-tenancy
│
├── 02-DATABASE-SCHEMA.md
│   ├── Core tables (tenants, users, employees)
│   ├── Multi-country configuration tables
│   ├── Effective dating pattern
│   └── Indexes and RLS policies
│
├── 03-API-CONTRACTS.md
│   ├── tRPC routers
│   ├── Request/response schemas
│   ├── Event schemas
│   └── Webhooks
│
├── 04-DOMAIN-MODELS.md
│   ├── Business entities
│   ├── Validation rules
│   └── Invariants
│
├── 05-TESTING-STRATEGY.md
│   ├── Unit testing
│   ├── Integration testing
│   ├── E2E testing
│   └── Compliance testing
│
├── 06-SECURITY-COMPLIANCE.md
│   ├── PII handling
│   ├── Encryption
│   ├── RLS policies
│   └── Audit trails
│
└── 07-CONSTRAINTS-RULES.md
    ├── Hard constraints
    ├── Anti-patterns
    └── Code quality rules
```

### Level 3: Country Documentation (Country-Specific)

```
docs/countries/
├── README.md (Country coverage overview)
│
├── CI/ (Côte d'Ivoire)
│   ├── overview.md
│   ├── payroll-rules.md
│   ├── tax-system.md
│   ├── social-security.md
│   ├── examples/
│   │   ├── example-01-basic-employee.md
│   │   ├── example-02-overtime.md
│   │   └── example-03-high-earner.md
│   ├── forms/
│   │   ├── payslip-template.md
│   │   └── tax-declaration.md
│   └── regulations/
│       ├── 2024-its-reform.md
│       ├── cnps-rates.md
│       └── fdfp-requirements.md
│
├── SN/ (Senegal)
│   ├── overview.md
│   ├── payroll-rules.md
│   ├── tax-system.md
│   └── ...
│
├── BF/ (Burkina Faso)
│   └── ...
│
└── _template/ (Template for new countries)
    ├── overview.md
    ├── payroll-rules.md
    ├── tax-system.md
    └── README.md
```

### Level 4: Technical Documentation (Implementation)

```
docs/technical/
├── implementation/
│   ├── payroll-calculation-engine.md
│   ├── configuration-driven-taxes.md
│   ├── effective-dating-implementation.md
│   └── event-sourcing-guide.md
│
├── guides/
│   ├── adding-new-country.md
│   ├── updating-tax-rates.md
│   ├── creating-payroll-run.md
│   └── debugging-calculations.md
│
├── epics/
│   ├── 01-EPIC-PAYROLL.md
│   ├── 02-EPIC-EMPLOYEE-MANAGEMENT.md
│   ├── 03-EPIC-TIME-TRACKING.md
│   └── ...
│
└── reference/
    ├── calculation-formulas.md
    ├── rounding-rules.md
    └── date-handling.md
```

### Level 5: Regulatory Documentation (Versioned)

```
docs/regulatory/
├── current/
│   ├── CI/
│   │   ├── its-brackets.md (Effective 2024-01-01)
│   │   ├── cnps-rates.md (Effective 2025-01-01)
│   │   └── fdfp-taxes.md
│   └── SN/
│       └── ...
│
├── 2024/
│   ├── CI/
│   │   ├── its-brackets-2024.md
│   │   └── cnps-rates-2024.md
│   └── changelog-2024.md
│
├── 2023/
│   ├── CI/
│   │   └── old-tax-system-2023.md (3 cédules)
│   └── changelog-2023.md
│
└── effective-dates.md (Calendar of all regulatory changes)
```

### Level 6: Architecture Decision Records

```
docs/decisions/
├── README.md (ADR index)
├── 0001-use-trpc-over-rest.md
├── 0002-monthly-vs-annualized-its.md
├── 0003-configuration-driven-taxes.md
├── 0004-effective-dating-pattern.md
├── 0005-multi-country-architecture.md
└── template.md
```

**ADR Template:**
```markdown
# ADR-[NUMBER]: [Title]

**Date:** [Date]
**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Deciders:** [Names]
**Context:** [What problem are we solving?]

## Decision

[What did we decide?]

## Rationale

[Why did we decide this?]

## Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Tradeoff 1]
- [Tradeoff 2]

## Alternatives Considered

### Option 1: [Name]
- Pros: [...]
- Cons: [...]
- Rejected because: [...]

## Implementation Notes

[How to implement this decision]

## References

- [Link to research]
- [Link to regulations]
```

### Level 7: Archive

```
docs/archive/
├── 2023/
│   ├── old-payroll-cote-ivoire.md
│   └── deprecated-tax-system.md
│
├── 2022/
│   └── ...
│
└── README.md (Archive index)
```

---

## Migration Plan

### Phase 1: Create New Structure (Week 1)

**Day 1-2: Create Folders**
```bash
mkdir -p docs/{core,countries,technical,regulatory,decisions,archive}
mkdir -p docs/countries/{CI,SN,BF,_template}
mkdir -p docs/technical/{implementation,guides,epics,reference}
mkdir -p docs/regulatory/{current,2024,2023}
```

**Day 3-4: Move Generic Docs to `/core`**
- 02-ARCHITECTURE-OVERVIEW.md → core/01-ARCHITECTURE.md
- 03-DATABASE-SCHEMA.md → core/02-DATABASE-SCHEMA.md
- 10-API-CONTRACTS.md → core/03-API-CONTRACTS.md
- 04-DOMAIN-MODELS.md → core/04-DOMAIN-MODELS.md
- 11-TESTING-STRATEGY.md → core/05-TESTING-STRATEGY.md
- 14-SECURITY-AND-COMPLIANCE.md → core/06-SECURITY-COMPLIANCE.md
- 01-CONSTRAINTS-AND-RULES.md → core/07-CONSTRAINTS-RULES.md

**Day 5: Extract Côte d'Ivoire to `/countries/CI`**
- Create: countries/CI/overview.md
- Extract from payroll-cote-d-ivoire.md:
  - countries/CI/tax-system.md (ITS brackets)
  - countries/CI/social-security.md (CNPS, CMU)
  - countries/CI/payroll-rules.md (FDFP, family deductions)
- Extract examples:
  - countries/CI/examples/example-01-basic-employee.md
  - countries/CI/examples/example-02-overtime.md

### Phase 2: Move Technical Docs (Week 2)

**Day 6-7: Reorganize Epics**
- 05-EPIC-PAYROLL.md → technical/epics/01-EPIC-PAYROLL.md
- 06-EPIC-EMPLOYEE-MANAGEMENT.md → technical/epics/02-EPIC-EMPLOYEE-MANAGEMENT.md
- (etc.)

**Day 8: Create Implementation Guides**
- Extract calculation logic → technical/implementation/payroll-calculation-engine.md
- Create: technical/guides/adding-new-country.md
- Create: technical/guides/updating-tax-rates.md

**Day 9: Create Reference Docs**
- Extract formulas → technical/reference/calculation-formulas.md
- Document rounding → technical/reference/rounding-rules.md

**Day 10: Versioned Regulatory**
- Current CI rules → regulatory/current/CI/
- Archive 2023 rules → regulatory/2023/CI/
- Create: regulatory/effective-dates.md

### Phase 3: Update Links & Cleanup (Week 3)

**Day 11-12: Update All Internal Links**
```bash
# Find all broken links
grep -r "\[.*\](\./" docs/

# Update links with new paths
# Example: [Schema](./03-DATABASE-SCHEMA.md) → [Schema](./core/02-DATABASE-SCHEMA.md)
```

**Day 13: Create Navigation**
- Create: docs/00-START-HERE.md (with navigation tree)
- Update: docs/README.md (auto-generated index)
- Create: docs/GLOSSARY.md
- Update: docs/CHANGELOG.md

**Day 14: Testing & Validation**
- Run link checker
- Verify all docs accessible
- Test documentation site build
- Review with stakeholders

**Day 15: Final Cleanup**
- Delete empty old files
- Move deprecated docs to archive/
- Update package.json scripts
- Deploy documentation site

---

## File Naming Conventions

### Folder Names
- ✅ Lowercase with hyphens: `multi-country-rules/`
- ❌ Camel case: `multiCountryRules/`

### File Names

**Core & Technical Docs:**
- Format: `[number]-[TITLE].md`
- Example: `01-ARCHITECTURE.md`
- Reason: Enforces reading order

**Country Docs:**
- Format: `[descriptive-name].md`
- Example: `tax-system.md`, `payroll-rules.md`
- Reason: Self-documenting, searchable

**Examples:**
- Format: `example-[number]-[description].md`
- Example: `example-01-basic-employee.md`
- Reason: Clear ordering, easy to reference

**ADRs:**
- Format: `[number]-[description].md`
- Example: `0001-use-trpc-over-rest.md`
- Reason: Industry standard

---

## Navigation Improvements

### Create 00-START-HERE.md

```markdown
# Documentation Navigation Guide

**Welcome to Preem HR Documentation**

## Quick Links

### 🚀 Getting Started
- [Architecture Overview](./core/01-ARCHITECTURE.md)
- [Database Schema](./core/02-DATABASE-SCHEMA.md)
- [API Contracts](./core/03-API-CONTRACTS.md)

### 🌍 Country-Specific
- [Côte d'Ivoire (CI)](./countries/CI/overview.md)
- [Senegal (SN)](./countries/SN/overview.md)
- [Adding New Country](./technical/guides/adding-new-country.md)

### 💰 Payroll Implementation
- [Payroll Epic](./technical/epics/01-EPIC-PAYROLL.md)
- [Calculation Engine](./technical/implementation/payroll-calculation-engine.md)
- [Tax Configuration](./technical/implementation/configuration-driven-taxes.md)

### 📜 Regulations (Current)
- [CI: ITS Tax Brackets](./regulatory/current/CI/its-brackets.md)
- [CI: CNPS Rates](./regulatory/current/CI/cnps-rates.md)
- [CI: FDFP Taxes](./regulatory/current/CI/fdfp-taxes.md)

### 🔍 Reference
- [Glossary](./GLOSSARY.md)
- [Calculation Formulas](./technical/reference/calculation-formulas.md)
- [Architecture Decisions](./decisions/README.md)

---

## Documentation by Role

### For Developers
1. [Architecture](./core/01-ARCHITECTURE.md)
2. [Database Schema](./core/02-DATABASE-SCHEMA.md)
3. [API Contracts](./core/03-API-CONTRACTS.md)
4. [Payroll Epic](./technical/epics/01-EPIC-PAYROLL.md)
5. [Testing Strategy](./core/05-TESTING-STRATEGY.md)

### For Product Managers
1. [Payroll Epic](./technical/epics/01-EPIC-PAYROLL.md)
2. [Country Coverage](./countries/README.md)
3. [Regulatory Changes](./regulatory/effective-dates.md)

### For Compliance Officers
1. [Current Regulations](./regulatory/current/)
2. [Archived Regulations](./regulatory/)
3. [Audit Documentation](./core/06-SECURITY-COMPLIANCE.md)

---

## Finding Information

**Looking for:**
- **Tax brackets?** → [regulatory/current/CI/its-brackets.md](./regulatory/current/CI/its-brackets.md)
- **Database tables?** → [core/02-DATABASE-SCHEMA.md](./core/02-DATABASE-SCHEMA.md)
- **API endpoints?** → [core/03-API-CONTRACTS.md](./core/03-API-CONTRACTS.md)
- **Calculation examples?** → [countries/CI/examples/](./countries/CI/examples/)
- **Why we made X decision?** → [decisions/](./decisions/)

---

**Last Updated:** October 5, 2025
```

### Auto-Generated Index (README.md)

```typescript
// scripts/generate-docs-index.ts
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const generateIndex = (docsPath: string) => {
  const structure = walkDir(docsPath);
  const markdown = `# Preem HR Documentation

**Auto-Generated Index**
Last Updated: ${new Date().toISOString()}

${renderTree(structure)}

## Document Count: ${countDocs(structure)}

---

See [00-START-HERE.md](./00-START-HERE.md) for navigation guide.
  `;

  fs.writeFileSync(join(docsPath, 'README.md'), markdown);
};

// Run on pre-commit
generateIndex('./docs');
```

---

## Search & Discovery Improvements

### 1. Add Metadata to Each Doc

```markdown
---
title: "ITS Tax System - Côte d'Ivoire"
country: "CI"
category: "Regulatory"
effective_date: "2024-01-01"
last_updated: "2025-10-05"
tags: ["tax", "its", "ivory-coast", "progressive"]
related:
  - "countries/CI/payroll-rules.md"
  - "technical/implementation/payroll-calculation-engine.md"
---

# ITS Tax System - Côte d'Ivoire

[Content...]
```

### 2. Full-Text Search

```bash
# Install search tool
npm install --save-dev lunr

# Build search index
npm run docs:build-search

# Use in documentation site
```

### 3. Tag System

**Common Tags:**
- Country: `ci`, `sn`, `bf`
- Feature: `payroll`, `tax`, `social-security`, `time-tracking`
- Type: `regulatory`, `technical`, `guide`, `example`
- Audience: `developer`, `pm`, `compliance`

---

## Automation Scripts

### Auto-Update Links

```bash
#!/bin/bash
# scripts/update-doc-links.sh

# After moving files, update all references
old_path="03-DATABASE-SCHEMA.md"
new_path="core/02-DATABASE-SCHEMA.md"

# Find and replace in all .md files
find docs -name "*.md" -exec sed -i '' "s|$old_path|$new_path|g" {} +

echo "✅ Updated all links from $old_path to $new_path"
```

### Link Validation

```bash
#!/bin/bash
# scripts/validate-links.sh

echo "🔍 Checking for broken links..."

# Find all markdown files
find docs -name "*.md" | while read file; do
  # Extract links
  grep -o "\[.*\](\.\/[^)]*)" "$file" | while read link; do
    path=$(echo "$link" | sed 's/.*](\.\/\([^)]*\)).*/\1/')
    full_path="docs/$path"

    if [ ! -f "$full_path" ]; then
      echo "❌ Broken link in $file: $path"
    fi
  done
done

echo "✅ Link validation complete"
```

### Regulatory Version Management

```bash
#!/bin/bash
# scripts/archive-regulations.sh

year=$1
country=$2

# Archive current regulations
cp -r "docs/regulatory/current/$country" "docs/regulatory/$year/$country"

echo "📦 Archived $country regulations for $year"
echo "⚠️  Remember to update docs/regulatory/effective-dates.md"
```

---

## Benefits Summary

### For Developers
- ✅ Clear separation of concerns
- ✅ Easier to find relevant documentation
- ✅ Less noise when searching
- ✅ Better IDE navigation

### For Product/Compliance
- ✅ Country-specific docs in one place
- ✅ Version history preserved
- ✅ Easy to compare regulations
- ✅ Clear effective dates

### For Maintenance
- ✅ Add new countries without touching core docs
- ✅ Update tax rates in single location
- ✅ Archive old versions systematically
- ✅ Automated link validation

### For Scaling
- ✅ Template for new countries
- ✅ Clear process for adding regulations
- ✅ Separation allows team specialization
- ✅ Documentation as code

---

## Risks & Mitigation

### Risk 1: Breaking Existing Links
**Mitigation:**
- Create link redirect map
- Run automated link updater
- Keep old files as symlinks temporarily
- Test all links before deployment

### Risk 2: Team Confusion During Transition
**Mitigation:**
- Clear communication plan
- Update README first
- Gradual migration (1 week)
- Keep 00-START-HERE.md updated

### Risk 3: Increased Complexity
**Mitigation:**
- Auto-generated index
- Clear navigation guide
- Search functionality
- Well-documented structure

---

## Success Criteria

- [ ] All documentation accessible within 2 clicks from 00-START-HERE.md
- [ ] No broken internal links
- [ ] Country-specific docs fully separated
- [ ] Regulatory versions archived
- [ ] Search finds relevant docs in < 5 seconds
- [ ] New country added using template in < 1 day
- [ ] Team feedback positive (survey)

---

## Timeline

**Week 1:** Create structure, move core docs
**Week 2:** Extract country docs, reorganize technical
**Week 3:** Update links, testing, cleanup
**Total:** 3 weeks (1 developer, part-time)

---

## Approval & Next Steps

**Status:** 🟡 Proposal (Awaiting Approval)

**Stakeholder Review:**
- [ ] Engineering Lead
- [ ] Product Manager
- [ ] Documentation Lead
- [ ] Compliance Officer

**Post-Approval:**
1. Create restructure task in project board
2. Assign developer
3. Begin Phase 1 migration
4. Weekly progress updates
5. Final review and deployment

---

**Proposal Author:** Claude AI Assistant
**Date:** October 5, 2025
**Version:** 1.0
