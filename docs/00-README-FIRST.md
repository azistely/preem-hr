# 📋 Preem HR Platform - Documentation Guide

## ⚠️ CRITICAL: Read This Before Starting Implementation

This documentation is designed for LLM-assisted development. It acknowledges that AI assistants **will** lose context, **will** hallucinate, and **will** forget. The structure below compensates for these limitations.

## 🎯 Purpose

Build an enterprise-grade multi-tenant payroll and HR platform for French-speaking West Africa with:
- Mobile-first UX for low digital literacy users
- Event-driven architecture (CQRS pattern)
- Country-specific compliance (starting with Côte d'Ivoire)
- Modular design with extensible workflows

## 📚 Documentation Structure

### Phase 1: Foundation (READ THESE FIRST)
1. **00-README-FIRST.md** ← You are here
2. **01-CONSTRAINTS-AND-RULES.md** - Hard constraints, anti-patterns, source of truth
3. **02-ARCHITECTURE-OVERVIEW.md** - System design, tech stack, bounded contexts
4. **03-DATABASE-SCHEMA.md** - Complete schema with effective dating and multi-tenancy
5. **04-DOMAIN-MODELS.md** - Business entities, validation rules, invariants

### Phase 2: Core Features (Priority Order)
6. **05-EPIC-PAYROLL.md** - Payroll calculation engine with Côte d'Ivoire rules
7. **06-EPIC-EMPLOYEE-MANAGEMENT.md** - People, positions, assignments
8. **07-EPIC-TIME-AND-ATTENDANCE.md** - Time tracking, leaves, time off
9. **08-EPIC-ONBOARDING-WORKFLOW.md** - Guided setup from signup to first payroll
10. **09-EPIC-WORKFLOW-AUTOMATION.md** - Visual workflow builder

### Phase 3: Integration & Platform
11. **10-API-CONTRACTS.md** - REST/GraphQL endpoints, webhooks, events
12. **11-TESTING-STRATEGY.md** - Unit, integration, E2E test patterns
13. **12-SUPER-ADMIN.md** - Country rules, tax rates, compliance config
14. **13-GLOBALIZATION.md** - Multi-country, currency, locale support
15. **14-SECURITY-AND-COMPLIANCE.md** - PII isolation, audit trails, GDPR

## 🚫 Anti-Hallucination Protocols

### For AI Assistants:
- [ ] **ALWAYS** use TodoWrite tool for multi-step tasks
- [ ] **READ** files before suggesting changes (never assume)
- [ ] **VERIFY** against source of truth documents
- [ ] When uncertain, say: *"Let me verify by reading [file]..."*
- [ ] Mark clearly what you've **READ** vs **ASSUMED**

### For Human Developers:
- Point AI to specific docs when it drifts
- Use phrase *"Reset - read the context"* to refocus AI
- Keep AI on track using todo list
- Remember: AI can't "see" your editor or remember previous sessions

## 🏗️ Implementation Priority

### Sprint 1-2: Foundation
- Multi-tenant database setup
- Authentication & company registration
- Super admin for country rules

### Sprint 3-5: Payroll Core
- Payroll calculation engine (Côte d'Ivoire)
- Employee records with effective dating
- Position management & assignments

### Sprint 6-8: Time & Workflows
- Time tracking with geofencing
- Leave/time-off management
- Guided onboarding questionnaire

### Sprint 9-10: Automation
- Event-driven workflow engine
- Mobile-first UI components
- Document management

## 📝 Epic/Story/Task Hierarchy

Each epic document follows this structure:

```
EPIC → FEATURES → USER STORIES → TASKS → ACCEPTANCE CRITERIA
```

**Example:**
```
EPIC: Payroll Calculation
  ├─ FEATURE: Base Salary Calculation
  │   ├─ STORY: Calculate monthly gross salary
  │   │   ├─ TASK: Validate SMIG minimum
  │   │   ├─ TASK: Apply position-based rates
  │   │   └─ TASK: Generate audit trail
  │   │   └─ ACCEPTANCE: Gross >= SMIG (75,000 FCFA)
```

## 🧪 Testability Principles

1. **Every story must be independently testable**
2. **Each task has clear acceptance criteria**
3. **Use real Côte d'Ivoire examples from payroll-cote-d-ivoire.md**
4. **Include edge cases and error scenarios**

## 🔍 Source of Truth Declarations

| Domain | Source File | Never Assume |
|--------|-------------|--------------|
| Database Schema | `03-DATABASE-SCHEMA.md` | Table names, columns, relationships |
| Payroll Rules (CI) | `payroll-cote-d-ivoire.md` | Tax rates, CNPS rates, SMIG |
| API Contracts | `10-API-CONTRACTS.md` | Endpoint paths, request/response shapes |
| Domain Models | `04-DOMAIN-MODELS.md` | Entity properties, validation rules |
| Architecture | `02-ARCHITECTURE-OVERVIEW.md` | Tech stack, patterns, boundaries |

## 🛠️ Technology Stack (Verified - Updated January 2025)

This is the **actual** stack - do not suggest alternatives without explicit approval:

- **Backend:** Node.js 20 LTS + TypeScript 5.3+
- **API:** tRPC 11.x (end-to-end type safety, NOT Express/REST)
- **Database:** PostgreSQL 15+ with Supabase (row-level security, policies)
- **ORM:** Drizzle ORM (type-safe queries, migrations)
- **Events:** Inngest (durable workflows, step functions)
- **Frontend:** Next.js 15+ (App Router, React Server Components)
- **UI Framework:** React 19 (use hook, Server Components)
- **Mobile:** React Native (Expo)
- **UI Components:** shadcn/ui (Radix UI + Tailwind)
- **Styling:** Tailwind CSS 3.x
- **State:** Zustand 4.x (persist middleware, devtools)
- **Forms:** React Hook Form + Zod validation
- **i18n:** next-intl (French primary)
- **Testing:** Vitest + Playwright (browser mode for components)

## 🎨 UX Design Principles for Low Digital Literacy

1. **No jargon:** Use simple French terms
2. **Large touch targets:** Minimum 44x44px buttons
3. **Progressive disclosure:** Show only what's needed now
4. **Visual hierarchy:** Icons + colors for scanning
5. **Undo/confirm:** Destructive actions need confirmation
6. **Offline-first:** Works with poor connectivity
7. **Voice assistance:** Read-aloud support

## 📱 Mobile-First Responsive Breakpoints

```css
/* Source of truth for breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Wide desktop */
```

## ⚡ Event-Driven Architecture

**Pattern:** Every state change emits an event
**Example:** `employee.hired` → triggers onboarding workflow

Events are defined in `10-API-CONTRACTS.md` - Section 4.

## 🗂️ File Naming Conventions

```
src/
├── features/
│   └── {feature-name}/
│       ├── components/     # UI components
│       ├── hooks/          # React hooks
│       ├── api/            # tRPC routers
│       ├── events/         # Event handlers
│       ├── types.ts        # TypeScript types
│       └── schema.ts       # Zod schemas
├── lib/
│   ├── db/                 # Database client
│   ├── events/             # Event bus
│   └── utils/              # Shared utilities
└── app/                    # Next.js pages (App Router)
```

## 🔄 Change Log (Last 30 Days)

### January 2025 - Architecture Review & Updates

**Technology Stack Updates:**
- Updated Next.js: 14+ → 15+ (App Router improvements, React 19 support)
- Updated tRPC: 10.x → 11.x (breaking changes, new middleware patterns)
- Updated React: 18.x → 19 (use hook, improved Server Components)
- Updated Zustand: Clarified 4.x with persist middleware and devtools
- Added Drizzle ORM: Explicit version with latest PostgreSQL patterns
- Added shadcn/ui: Official UI component library
- Added Vitest browser mode: Component testing capabilities

**Pattern Improvements:**
- Next.js data fetching: Use React `cache` and server-only patterns
- tRPC context: Updated to latest middleware and standalone middleware
- Drizzle migrations: Added sequences, policies, and improved patterns
- Supabase RLS: Enhanced policy syntax and security patterns

## ❓ Quick Reference

**Starting payroll calculation?** → Read `05-EPIC-PAYROLL.md` + `payroll-cote-d-ivoire.md`
**Adding employee fields?** → Check `03-DATABASE-SCHEMA.md` + `04-DOMAIN-MODELS.md`
**Creating API endpoint?** → Follow patterns in `10-API-CONTRACTS.md`
**Writing tests?** → Use examples from `11-TESTING-STRATEGY.md`

## 🆘 When Lost

1. Re-read `01-CONSTRAINTS-AND-RULES.md`
2. Check source of truth for your domain
3. Search for similar implemented patterns
4. Ask human: *"Should I implement X like Y pattern?"*

---

**Next Step:** Read `01-CONSTRAINTS-AND-RULES.md` before writing any code.
