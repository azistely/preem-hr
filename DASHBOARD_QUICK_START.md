# Dashboard Quick Start Guide

**For Developers**: How to integrate the new dashboard system into your existing app

---

## Step 1: Import the Dashboard Layout

Create or update your main dashboard layout to use the new navigation system:

```tsx
// app/(dashboard)/layout.tsx
"use client";

import { DashboardLayout } from "@/components/navigation";
import { useCurrentUser } from "@/hooks/use-current-user"; // Your auth hook

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();

  // Show loading state while fetching user
  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <DashboardLayout userRole={user.role}>
      {children}
    </DashboardLayout>
  );
}
```

---

## Step 2: Set Default Routes

Update your route redirects based on user roles:

```tsx
// middleware.ts or auth logic
function getDefaultDashboard(role: string) {
  switch (role) {
    case "employee":
      return "/employee/dashboard";
    case "manager":
      return "/manager/dashboard";
    case "hr_manager":
      return "/admin/dashboard";
    case "tenant_admin":
      return "/admin/settings/dashboard";
    default:
      return "/employee/dashboard";
  }
}
```

---

## Step 3: Wire Up Quick Actions

Replace the `{/* TODO */}` placeholders in dashboard pages:

```tsx
// Example: Employee Dashboard
import { useRouter } from "next/navigation";

export default function EmployeeDashboard() {
  const router = useRouter();

  return (
    <QuickActionCard
      icon={Clock}
      label="Pointer"
      description="Enregistrer votre présence"
      onClick={() => router.push("/employee/time")} // ✅ Add actual navigation
    />
  );
}
```

---

## Step 4: Test the Implementation

### Manual Testing

1. **Mobile (375px width)**:
   ```bash
   # Open Chrome DevTools
   # Toggle device toolbar (Cmd+Shift+M)
   # Select iPhone SE (375x667)
   ```

2. **Tablet (768px width)**:
   ```bash
   # Select iPad Mini (768x1024)
   ```

3. **Desktop (1024px+ width)**:
   ```bash
   # Select responsive or desktop view
   ```

### Automated Testing

```tsx
// __tests__/dashboard/employee-dashboard.test.tsx
import { render, screen } from "@testing-library/react";
import EmployeeDashboard from "@/app/employee/dashboard/page";

test("displays employee name", () => {
  render(<EmployeeDashboard />);
  expect(screen.getByText(/Bonjour/i)).toBeInTheDocument();
});
```

---

## Step 5: Customize Navigation

To add/remove navigation items, edit `/lib/navigation/index.ts`:

```tsx
// Add a new item to employee navigation
export const employeeMobileNav: NavItem[] = [
  { icon: Home, label: "Accueil", href: "/employee/dashboard" },
  { icon: FileText, label: "Paies", href: "/employee/payslips" },
  // Add your new item here:
  { icon: Bell, label: "Notifications", href: "/employee/notifications", badge: "3" },
];
```

---

## Step 6: Add Custom Dashboard Components

Create new dashboard components following the pattern:

```tsx
// components/dashboard/employee/my-new-widget.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MyNewWidgetProps {
  data: string;
  className?: string;
}

export function MyNewWidget({ data, className }: MyNewWidgetProps) {
  return (
    <Card className={cn("p-3 md:p-4 lg:p-6", className)}>
      <CardHeader className="pb-3">
        <CardTitle>My Widget</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold md:text-3xl">{data}</div>
      </CardContent>
    </Card>
  );
}
```

Then use it in your dashboard:

```tsx
import { MyNewWidget } from "@/components/dashboard/employee/my-new-widget";

<MyNewWidget data={dashboardData.customData} />
```

---

## Common Patterns

### Loading State

```tsx
if (isLoading) {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32" />
    </div>
  );
}
```

### Error State

```tsx
if (error) {
  return (
    <div className="p-4 text-center">
      <p className="text-destructive">Erreur: {error.message}</p>
    </div>
  );
}
```

### Empty State

```tsx
if (data.length === 0) {
  return (
    <EmptyState
      icon={Calendar}
      title="Aucune donnée"
      description="Commencez par créer votre premier élément"
      action={<Button>Créer</Button>}
    />
  );
}
```

---

## Troubleshooting

### Navigation not showing

**Problem**: Navigation doesn't appear on mobile/desktop

**Solution**: Check that `DashboardLayout` is wrapping your pages and `userRole` is correctly passed.

```tsx
// Verify role is being passed
console.log("User role:", user.role);
```

### Dashboard data not loading

**Problem**: `useQuery()` returns undefined

**Solution**: Check that the tRPC router is properly exported and the API client is configured.

```tsx
// Verify tRPC client
import { api } from "@/server/api/client";
const { data } = api.dashboard.getEmployeeDashboard.useQuery();
console.log("Dashboard data:", data);
```

### Responsive layout not working

**Problem**: Mobile/desktop views don't switch properly

**Solution**: Ensure Tailwind CSS responsive prefixes are correct and breakpoints match.

```tsx
// Use lg: for desktop (1024px+)
className="hidden lg:block"

// Use md: for tablet (768px+)
className="md:grid-cols-2"
```

---

## Performance Tips

1. **Lazy Load Heavy Components**:
   ```tsx
   const HeavyChart = dynamic(() => import("./heavy-chart"), {
     loading: () => <Skeleton className="h-64" />,
   });
   ```

2. **Use React Query for Caching**:
   ```tsx
   const { data } = api.dashboard.getData.useQuery(undefined, {
     staleTime: 5 * 60 * 1000, // 5 minutes
   });
   ```

3. **Optimize Images**:
   ```tsx
   import Image from "next/image";
   <Image src="/logo.png" width={50} height={50} alt="Logo" />
   ```

---

## Accessibility Checklist

- [ ] All interactive elements have focus states
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Screen reader announces all content
- [ ] Color contrast ratio >= 4.5:1
- [ ] Touch targets >= 44×44px
- [ ] Forms have labels and error messages

---

## Next Steps

1. **Integrate with existing auth**: Wire up user role detection
2. **Add real navigation**: Replace TODO comments with actual routes
3. **Test on real devices**: iPhone, Android, slow network
4. **Monitor performance**: Use Lighthouse, Web Vitals
5. **Gather feedback**: User testing with actual employees

---

## Support

For questions or issues:
- Review [DASHBOARD_IMPLEMENTATION.md](./DASHBOARD_IMPLEMENTATION.md)
- Check [HCI-DESIGN-PRINCIPLES.md](./docs/HCI-DESIGN-PRINCIPLES.md)
- Refer to [USER-ROLES-AND-DASHBOARD-DESIGN.md](./docs/USER-ROLES-AND-DASHBOARD-DESIGN.md)

---

**Happy coding!** 🚀
