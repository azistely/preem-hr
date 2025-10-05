# Preem HR - Payroll Management System for Côte d'Ivoire

A comprehensive, production-ready payroll calculation engine for Côte d'Ivoire, built with Next.js 15, TypeScript, Drizzle ORM, and tRPC.

## Features

✅ **Fully Compliant** - Implements all Côte d'Ivoire payroll regulations (2024 reform)
✅ **Type-Safe** - End-to-end type safety with TypeScript and tRPC
✅ **Well-Tested** - 100% test coverage for all calculation logic
✅ **Production-Ready** - Error handling, validation, audit trails
✅ **Scalable** - Handles bulk payroll runs for hundreds of employees

## What's Implemented

### Core Calculations
- **Base Salary** - Prorated for mid-month hires/terminations
- **CNPS Contributions** - Pension, maternity, family, work accident
- **CMU** - Universal health coverage
- **ITS** - Progressive income tax (8 brackets, 0-60%)
- **Overtime** - 5 types of overtime with different multipliers
- **Net Salary** - Complete gross-to-net calculation

### Payroll Orchestration
- **Payroll Runs** - Bulk processing for all employees
- **Line Items** - Detailed breakdown for each employee
- **Audit Trail** - Complete calculation details stored
- **Error Handling** - Graceful handling of individual failures

### API Layer
- **tRPC Routers** - Type-safe API endpoints
- **Zod Validation** - Input validation with clear error messages
- **Client SDK** - Type-safe client for frontend integration

### Frontend UI (NEW ✨)
- **Payroll Calculator** - Interactive calculator with real-time results
- **shadcn/ui Components** - Accessible, mobile-optimized UI
- **French Language** - 100% French interface for Côte d'Ivoire users
- **Mobile-First** - 44px touch targets, progressive disclosure
- **Real-Time Calculation** - Instant results as you type

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL

# Generate database schema
npm run db:generate

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

### Run Tests

```bash
# Run all tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Usage Examples

### Calculate Individual Payroll

```typescript
import { trpc } from '@/lib/trpc/client';

const result = await trpc.payroll.calculate.query({
  employeeId: 'emp-123',
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-01-31'),
  baseSalary: 300000,
  hasFamily: false,
});

console.log('Net Salary:', result.netSalary); // 219,285 FCFA
```

### Process Payroll Run

```typescript
// Create run
const run = await trpc.payroll.createRun.mutate({
  tenantId: 'tenant-123',
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-01-31'),
  paymentDate: new Date('2025-02-05'),
  createdBy: 'user-123',
});

// Calculate for all employees
const summary = await trpc.payroll.calculateRun.mutate({
  runId: run.id,
});

console.log('Total payroll:', summary.totalNet);
```

## Regulatory Compliance

### Constants (2025)
- **SMIG**: 75,000 FCFA/month
- **CNPS Pension**: 6.3% employee, 7.7% employer (ceiling: 3,375,000)
- **CMU**: 1,000 FCFA employee, 500 + 4,500 employer
- **ITS**: Progressive tax (0% to 60%)

### Official Examples Validated
All calculations match official examples from:
- `docs/payroll-cote-d-ivoire.md` (Example 7.1: 300k gross → 219,285 net)
- Government regulations and tax tables

## Project Structure

```
preem-hr/
├── app/
│   └── api/trpc/[trpc]/route.ts  # tRPC API handler
├── features/payroll/
│   ├── constants.ts               # Regulatory constants
│   ├── types.ts                   # Type definitions
│   └── services/
│       ├── gross-calculation.ts   # Base salary
│       ├── cnps-calculation.ts    # Social security
│       ├── cmu-calculation.ts     # Health coverage
│       ├── its-calculation.ts     # Income tax
│       ├── overtime-calculation.ts # Overtime
│       ├── payroll-calculation.ts  # Orchestration
│       └── run-calculation.ts      # Bulk processing
├── lib/
│   ├── db/                        # Database client & schema
│   └── trpc/                      # tRPC client
├── server/
│   ├── trpc.ts                    # tRPC setup
│   └── routers/                   # API routers
├── docs/
│   ├── 03-DATABASE-SCHEMA.md      # DB design
│   ├── 05-EPIC-PAYROLL.md         # Epic & user stories
│   ├── payroll-cote-d-ivoire.md   # Regulations
│   └── PAYROLL-CALCULATION-GUIDE.md # Technical docs
└── tests/
    └── payroll-calculation.test.ts # Comprehensive tests
```

## Documentation

- **[Payroll Calculation Guide](docs/PAYROLL-CALCULATION-GUIDE.md)** - Complete technical documentation
- **[Epic: Payroll](docs/05-EPIC-PAYROLL.md)** - User stories and acceptance criteria
- **[Database Schema](docs/03-DATABASE-SCHEMA.md)** - Database design
- **[Regulations](docs/payroll-cote-d-ivoire.md)** - Côte d'Ivoire payroll laws

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Drizzle ORM
- **API**: tRPC + Zod
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest
- **Validation**: Zod schemas

## Test Coverage

```
Coverage Summary:
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%
```

All test cases from the epic specification pass:
- ✅ Base salary calculation with proration
- ✅ CNPS contributions (all types)
- ✅ CMU calculations
- ✅ ITS progressive tax (all brackets)
- ✅ Overtime calculations
- ✅ Complete payroll flow
- ✅ Official Example 7.1 match

## API Endpoints

### tRPC Endpoints

All endpoints available at `/api/trpc`:

- `payroll.calculateGross` - Calculate gross salary
- `payroll.calculate` - Complete payroll calculation
- `payroll.createRun` - Create payroll run
- `payroll.calculateRun` - Process all employees
- `payroll.getRun` - Get run details
- `payroll.listRuns` - List payroll runs

## Database Schema

### Core Tables
- `employees` - Employee master data
- `employee_salaries` - Effective-dated salaries
- `payroll_runs` - Payroll period runs
- `payroll_line_items` - Individual employee pay records

See [DATABASE-SCHEMA.md](docs/03-DATABASE-SCHEMA.md) for complete schema.

## Contributing

This is an internal project. For contributions:
1. Follow TypeScript strict mode
2. Maintain 100% test coverage
3. Update documentation
4. Validate against regulations

## License

Proprietary - Internal Use Only

## Support

For technical support: tech@preem-hr.com

---

**Built with ❤️ for Côte d'Ivoire businesses**
