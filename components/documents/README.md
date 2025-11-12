# Document Management Components

Complete frontend implementation for the document upload and management system.

## Components

### 1. `UploadDocumentDialog`
Main upload dialog with drag & drop functionality.

**Features:**
- ✅ Drag & drop file upload
- ✅ File validation (type, size)
- ✅ Category selection (role-based filtering)
- ✅ Optional metadata (expiry date, tags)
- ✅ Real-time upload progress
- ✅ Mobile-friendly (touch targets ≥ 48px)
- ✅ Approval workflow indicators

**Usage:**
```tsx
import { UploadDocumentDialog } from '@/components/documents';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <UploadDocumentDialog
      open={open}
      onOpenChange={setOpen}
      employeeId={null} // null = current user, uuid = specific employee
      onUploadSuccess={() => console.log('Upload complete!')}
    />
  );
}
```

### 2. `UploadButton` / `UploadFAB`
Pre-built buttons with dialog integration.

**Usage:**
```tsx
import { UploadButton, UploadFAB } from '@/components/documents';

// Standard button
<UploadButton
  employeeId={employeeId} // Optional: for HR to upload for specific employee
  onUploadSuccess={() => refetch()}
/>

// Floating Action Button (mobile-only)
<UploadFAB />
```

### 3. `DocumentList`
Table view with filters and HR actions.

**Features:**
- ✅ List documents with pagination
- ✅ Filter by status & category
- ✅ Approval status badges
- ✅ Download documents
- ✅ HR actions (approve/reject)
- ✅ Mobile-responsive

**Usage:**
```tsx
import { DocumentList } from '@/components/documents';

// Show all user's documents
<DocumentList />

// Show documents for specific employee (HR view)
<DocumentList
  employeeId="uuid-here"
  showActions={true} // Enable approve/reject
/>
```

## Integration Examples

### Employee Self-Service Page

```tsx
// app/(employee)/employee/documents/page.tsx
'use client';

import { UploadButton, DocumentList } from '@/components/documents';

export default function EmployeeDocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Mes Documents</h1>
        <UploadButton />
      </div>
      <DocumentList />
    </div>
  );
}
```

### HR Document Approval Page

```tsx
// app/(admin)/admin/documents/approvals/page.tsx
'use client';

import { DocumentList } from '@/components/documents';

export default function DocumentApprovalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Documents en attente</h1>
      <DocumentList showActions={true} />
    </div>
  );
}
```

### HR Employee Profile Integration

```tsx
// Show documents for specific employee on their profile page
'use client';

import { UploadButton, DocumentList } from '@/components/documents';

export default function EmployeeProfilePage({ params }) {
  return (
    <div className="space-y-6">
      <UploadButton employeeId={params.id} />
      <DocumentList employeeId={params.id} showActions={true} />
    </div>
  );
}
```

## Document Categories

Documents are categorized based on database configuration:

| Category | Employee Can Upload | Requires HR Approval |
|----------|--------------------|--------------------|
| Pièce d'identité | ✅ | ❌ |
| Diplôme | ✅ | ❌ |
| Certificat médical | ✅ | ✅ |
| Autre document | ✅ | ❌ |
| Contrat de travail | ❌ | ❌ (HR only) |
| Bulletin de paie | ❌ | ❌ (Generated) |
| Évaluation | ❌ | ❌ (HR only) |

## Approval Workflow

1. **Employee uploads document** → Document status = `pending` (if requires approval)
2. **Inngest workflow starts** → Creates alert for HR managers
3. **HR approves/rejects** → Inngest event emitted
4. **Employee notified** → Alert created with outcome
5. **Auto-rejection** → After 7 days if no HR action

## File Validation

**Allowed formats:**
- PDF (`.pdf`)
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- DOCX (`.docx`)

**Maximum file size:** 25MB

**Client-side validation:** Before upload
**Server-side validation:** In upload service

## Mobile Optimization

All components follow HCI design principles:
- Touch targets ≥ 48×48px
- Works on 5" screens (375×667)
- Responsive tables (horizontal scroll)
- Floating Action Button for mobile upload
- One-hand operation support

## Testing

Test the complete flow:
1. Start Inngest dev server: `npx inngest-cli@latest dev`
2. Upload a document with approval requirement
3. Check Inngest dashboard for workflow execution
4. Approve/reject via DocumentList component
5. Verify alerts created for employee

## Troubleshooting

**Upload fails:**
- Check file size (< 25MB)
- Check file type (PDF, JPEG, PNG, DOCX only)
- Verify Supabase Storage bucket exists
- Check network connection

**Approval workflow not triggered:**
- Verify Inngest dev server is running
- Check console for event emission logs
- Verify document category requires approval
- Check HR managers exist in tenant

**RLS errors:**
- Verify tenant context is set correctly
- Check user role permissions
- Verify employee_id matches for non-HR users
