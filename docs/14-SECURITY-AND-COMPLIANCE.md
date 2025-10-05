# 🔒 Security & Compliance

## Document Overview

**Purpose:** Define security architecture, data protection, compliance requirements, and audit strategies for the Preem HR platform.

**Regulatory Frameworks:**
- GDPR (European Union - applicable to EU data processing)
- Senegal Data Protection Law (Law n°2008-12)
- UEMOA regulations (West African Economic Union)
- ISO 27001 principles

**Related Documents:**
- `02-ARCHITECTURE-OVERVIEW.md` - System architecture
- `03-DATABASE-SCHEMA.md` - Row-level security
- `01-CONSTRAINTS-AND-RULES.md` - Security constraints

---

## Core Security Principles

### 1. Defense in Depth

**Multiple layers of security:**
```
┌─────────────────────────────────────┐
│  1. Network Layer (Cloudflare)      │
│     - DDoS protection               │
│     - WAF rules                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  2. Application Layer (Next.js)     │
│     - Authentication (Clerk)        │
│     - Authorization (RBAC)          │
│     - Input validation (Zod)        │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  3. API Layer (tRPC)                │
│     - Request validation            │
│     - Rate limiting                 │
│     - Tenant isolation              │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  4. Database Layer (Supabase)       │
│     - Row-level security (RLS)      │
│     - Encryption at rest            │
│     - Audit logging                 │
└─────────────────────────────────────┘
```

### 2. Principle of Least Privilege

**Every user/service has minimum necessary permissions**

### 3. Zero Trust Architecture

**Never trust, always verify** - authenticate and authorize every request

---

## Multi-Tenancy Security

### Tenant Isolation

**Database-Level Isolation:**
```sql
-- All tables have tenant_id
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- ... other columns

  CONSTRAINT employees_tenant_id_fkey
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE CASCADE
);

-- Row-Level Security Policy
CREATE POLICY tenant_isolation_policy ON employees
  FOR ALL
  USING (tenant_id = auth.uid()::uuid);
```

**Application-Level Checks:**
```typescript
// Every tRPC procedure validates tenant
export const employeeRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(employees.id, input.id),
          eq(employees.tenantId, ctx.user.tenantId) // Tenant check
        ),
      });

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employee not found or access denied',
        });
      }

      return employee;
    }),
});
```

**Invariants:**
- ✅ All queries MUST filter by `tenant_id`
- ✅ All inserts MUST include `tenant_id` from context
- ✅ Cross-tenant access is NEVER allowed
- ✅ Super admin bypasses tenant isolation (explicit flag)

---

## Authentication & Authorization

### Authentication (Clerk)

**Implementation:**
```typescript
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/nextjs';

export default function RootLayout({ children }: { children: React.Node }) {
  return (
    <ClerkProvider>
      <SignedIn>
        {children}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </ClerkProvider>
  );
}
```

**Session Management:**
- Session duration: 7 days (configurable)
- Refresh token rotation: enabled
- Multi-factor authentication: optional (recommended for super admins)
- Session revocation: immediate on logout

### Authorization (RBAC)

**Role Hierarchy:**
```typescript
type UserRole =
  | 'super_admin'    // Platform administrator (all tenants)
  | 'tenant_admin'   // Tenant owner (all permissions within tenant)
  | 'hr_manager'     // HR operations (employees, payroll, leaves)
  | 'manager'        // Department manager (view team, approve leaves)
  | 'employee';      // Self-service (view own data, request leave)

type Permission =
  | 'employees:read'
  | 'employees:write'
  | 'employees:delete'
  | 'payroll:read'
  | 'payroll:write'
  | 'payroll:approve'
  | 'leave:read'
  | 'leave:approve'
  | 'reports:read'
  | 'settings:write';

const rolePermissions: Record<UserRole, Permission[]> = {
  super_admin: ['*'], // All permissions
  tenant_admin: [
    'employees:read', 'employees:write', 'employees:delete',
    'payroll:read', 'payroll:write', 'payroll:approve',
    'leave:read', 'leave:approve',
    'reports:read', 'settings:write',
  ],
  hr_manager: [
    'employees:read', 'employees:write',
    'payroll:read', 'payroll:write',
    'leave:read', 'leave:approve',
    'reports:read',
  ],
  manager: [
    'employees:read', // Only direct reports
    'leave:read', 'leave:approve', // Only direct reports
    'reports:read', // Team reports only
  ],
  employee: [
    'employees:read', // Only self
    'leave:read', // Only self
  ],
};
```

**Permission Checking:**
```typescript
export function requirePermission(permission: Permission) {
  return async (ctx: Context) => {
    const userPermissions = rolePermissions[ctx.user.role];

    if (!userPermissions.includes('*') && !userPermissions.includes(permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Permission denied: ${permission}`,
      });
    }
  };
}

// Usage in tRPC router
export const payrollRouter = createTRPCRouter({
  approve: publicProcedure
    .use(requirePermission('payroll:approve'))
    .input(z.object({ payrollRunId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Only users with 'payroll:approve' permission reach here
      await approvePayrollRun(input.payrollRunId);
    }),
});
```

---

## Data Protection (PII)

### Personally Identifiable Information (PII)

**PII Fields:**
- Full name (first + last name)
- Email address
- Phone number
- Date of birth
- National ID number
- Bank account details
- Home address
- Salary information

### Encryption at Rest

**Database Encryption:**
```sql
-- Supabase provides transparent encryption at rest
-- All data encrypted with AES-256

-- Additional column-level encryption for highly sensitive data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt national ID
CREATE TABLE employee_sensitive (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL,
  national_id_encrypted BYTEA, -- Encrypted
  bank_account_encrypted BYTEA, -- Encrypted

  created_at TIMESTAMP DEFAULT now()
);

-- Encrypt/decrypt functions
CREATE FUNCTION encrypt_pii(data TEXT, key TEXT)
RETURNS BYTEA AS $$
  SELECT pgp_sym_encrypt(data, key);
$$ LANGUAGE SQL;

CREATE FUNCTION decrypt_pii(data BYTEA, key TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(data, key);
$$ LANGUAGE SQL;
```

**Application-Level Encryption:**
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY!; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encryptPII(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv + authTag + encrypted (all hex)
  return iv.toString('hex') + authTag.toString('hex') + encrypted;
}

export function decryptPII(encrypted: string): string {
  const iv = Buffer.from(encrypted.slice(0, 32), 'hex');
  const authTag = Buffer.from(encrypted.slice(32, 64), 'hex');
  const data = encrypted.slice(64);

  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Encryption in Transit

**HTTPS Everywhere:**
- All communication over TLS 1.3
- HSTS enabled (Strict-Transport-Security header)
- Certificate pinning for mobile app

**API Security:**
```typescript
// Next.js middleware - enforce HTTPS
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'http:') {
    return NextResponse.redirect(`https://${request.nextUrl.host}${request.nextUrl.pathname}`);
  }
}
```

---

## Audit Logging

### Audit Trail Requirements

**What to log:**
- All data modifications (create, update, delete)
- Authentication events (login, logout, failed attempts)
- Permission changes
- Export operations (reports, CSV downloads)
- Payroll calculations and approvals
- Sensitive data access (employee PII views)

### Audit Log Schema

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Event details
  event_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'export', 'login'
  entity_type TEXT NOT NULL, -- 'employee', 'payroll_run', 'user'
  entity_id UUID, -- Affected entity

  -- Actor
  user_id UUID NOT NULL REFERENCES users(id),
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- Changes
  old_values JSONB, -- Before modification
  new_values JSONB, -- After modification

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

### Audit Logging Implementation

```typescript
export async function logAudit(params: {
  tenantId: string;
  eventType: 'create' | 'update' | 'delete' | 'export' | 'login';
  entityType: string;
  entityId?: string;
  userId: string;
  userEmail: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    userId: params.userId,
    userEmail: params.userEmail,
    userRole: params.userRole,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    oldValues: params.oldValues,
    newValues: params.newValues,
  });
}

// Usage in tRPC mutation
export const employeeRouter = createTRPCRouter({
  update: publicProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      const oldEmployee = await getEmployee(input.id);

      const updated = await db.update(employees)
        .set(input.changes)
        .where(eq(employees.id, input.id))
        .returning();

      // Log the change
      await logAudit({
        tenantId: ctx.user.tenantId,
        eventType: 'update',
        entityType: 'employee',
        entityId: input.id,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userRole: ctx.user.role,
        oldValues: oldEmployee,
        newValues: updated[0],
      });

      return updated[0];
    }),
});
```

---

## GDPR Compliance

### Data Subject Rights

**1. Right to Access (Article 15)**
```typescript
export async function exportUserData(userId: string) {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, userId),
    with: {
      salaries: true,
      assignments: true,
      leaveRequests: true,
      payrollEntries: true,
    },
  });

  // Export all user data as JSON
  return {
    personal: employee,
    salaries: employee.salaries,
    assignments: employee.assignments,
    leaves: employee.leaveRequests,
    payroll: employee.payrollEntries,
  };
}
```

**2. Right to Erasure (Article 17 - "Right to be Forgotten")**
```typescript
export async function deleteUserData(userId: string) {
  // Soft delete (for audit compliance)
  await db.update(employees)
    .set({
      status: 'deleted',
      email: `deleted_${userId}@example.com`, // Anonymize
      phone: null,
      firstName: 'Deleted',
      lastName: 'User',
      dateOfBirth: new Date('1900-01-01'), // Anonymize
    })
    .where(eq(employees.id, userId));

  // Log deletion
  await logAudit({
    eventType: 'delete',
    entityType: 'employee',
    entityId: userId,
    // ...
  });
}
```

**3. Right to Data Portability (Article 20)**
```typescript
export async function exportDataPortable(userId: string) {
  const data = await exportUserData(userId);

  // Return in machine-readable format (JSON, CSV, etc.)
  return {
    format: 'JSON',
    data: JSON.stringify(data, null, 2),
  };
}
```

### Data Retention Policy

```typescript
const retentionPolicies = {
  auditLogs: 7 * 365, // 7 years (legal requirement)
  payrollRecords: 10 * 365, // 10 years (tax audit)
  employeeRecords: 5 * 365, // 5 years after termination
  leaveRecords: 3 * 365, // 3 years
  sessionLogs: 90, // 90 days
};

// Scheduled job: Delete old records
export async function cleanupOldData() {
  const cutoffDate = subDays(new Date(), retentionPolicies.auditLogs);

  await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoffDate));
}
```

---

## Input Validation & Injection Prevention

### SQL Injection Prevention

**Use parameterized queries (Drizzle ORM):**
```typescript
// ✅ SAFE - Parameterized
const employee = await db.query.employees.findFirst({
  where: eq(employees.id, userId), // Uses prepared statement
});

// ❌ UNSAFE - Never do this
const result = await db.execute(
  sql`SELECT * FROM employees WHERE id = '${userId}'` // SQL injection risk
);
```

### XSS Prevention

**React automatically escapes:**
```tsx
// ✅ SAFE - React escapes by default
<div>{employee.fullName}</div>

// ❌ UNSAFE - dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: employee.notes }} />

// ✅ SAFE - Use sanitizer
import DOMPurify from 'isomorphic-dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(employee.notes) }} />
```

### Input Validation (Zod)

```typescript
const employeeCreateSchema = z.object({
  firstName: z.string().min(2).max(100).regex(/^[\p{L}\s'-]+$/u),
  lastName: z.string().min(2).max(100).regex(/^[\p{L}\s'-]+$/u),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[0-9\s\-()]+$/).optional(),
  dateOfBirth: z.date().refine(
    (date) => differenceInYears(new Date(), date) >= 16,
    { message: "L'employé doit avoir au moins 16 ans" }
  ),
});

// All inputs validated before processing
export const employeeRouter = createTRPCRouter({
  create: publicProcedure
    .input(employeeCreateSchema) // Validation happens here
    .mutation(async ({ input, ctx }) => {
      // Input is guaranteed valid
      const employee = await createEmployee(input);
      return employee;
    }),
});
```

---

## Rate Limiting

### API Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

// Apply to tRPC procedures
export const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  const { success } = await ratelimit.limit(ctx.user.id);

  if (!success) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop de requêtes. Veuillez réessayer dans 1 minute.',
    });
  }

  return next();
});
```

### Brute Force Protection

```typescript
// Login attempt tracking
const loginAttempts = new Map<string, number>();

export async function checkLoginAttempts(email: string) {
  const attempts = loginAttempts.get(email) || 0;

  if (attempts >= 5) {
    throw new Error('Compte temporairement bloqué. Réessayez dans 15 minutes.');
  }

  loginAttempts.set(email, attempts + 1);

  // Reset after 15 minutes
  setTimeout(() => {
    loginAttempts.delete(email);
  }, 15 * 60 * 1000);
}
```

---

## Security Headers

### Next.js Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

## Incident Response

### Security Incident Workflow

```
1. DETECT
   ↓
2. ASSESS
   ↓
3. CONTAIN
   ↓
4. INVESTIGATE
   ↓
5. REMEDIATE
   ↓
6. DOCUMENT
   ↓
7. REVIEW
```

### Incident Response Team

**Roles:**
- Incident Commander (CTO)
- Security Lead
- Infrastructure Engineer
- Communications Lead

### Post-Mortem Template

```markdown
# Security Incident Report

## Incident Summary
- **Date:** YYYY-MM-DD
- **Severity:** Critical / High / Medium / Low
- **Status:** Resolved / In Progress

## Timeline
- **00:00** - Incident detected
- **00:15** - Team notified
- **00:30** - Root cause identified
- **01:00** - Fix deployed
- **02:00** - Incident resolved

## Root Cause
[Description of what caused the incident]

## Impact
- **Users affected:** X
- **Data compromised:** None / [details]
- **Downtime:** X minutes

## Resolution
[Steps taken to resolve]

## Prevention
[Measures to prevent recurrence]
```

---

## Compliance Checklist

### Pre-Launch Security Audit

- [ ] All PII fields encrypted at rest
- [ ] HTTPS enforced on all endpoints
- [ ] Row-level security (RLS) enabled
- [ ] Audit logging implemented
- [ ] Rate limiting configured
- [ ] Input validation on all forms
- [ ] GDPR data export implemented
- [ ] GDPR data deletion implemented
- [ ] Security headers configured
- [ ] Penetration testing completed
- [ ] Incident response plan documented

### Monthly Security Review

- [ ] Review audit logs for anomalies
- [ ] Update dependencies (security patches)
- [ ] Rotate encryption keys
- [ ] Review access permissions
- [ ] Test backup/restore procedures
- [ ] Scan for vulnerabilities (OWASP)

---

**Security is a continuous process, not a one-time task.**
