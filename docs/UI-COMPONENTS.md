# UI Components Documentation

## Overview

PREEM HR uses [shadcn/ui](https://ui.shadcn.com/) for all UI components. Components are built with Radix UI primitives and styled with Tailwind CSS, providing:

- **Accessibility**: ARIA-compliant components out of the box
- **Customizable**: Full control over component styling
- **Type-safe**: TypeScript definitions included
- **Composable**: Build complex UIs from simple primitives

---

## Installation

shadcn/ui components are installed individually as needed:

```bash
# Install a new component
npx shadcn@latest add button

# Install multiple components
npx shadcn@latest add button card input
```

Components are added to `/components/ui/` and can be customized directly.

---

## Installed Components

### Core Components

#### Button
**Location:** `/components/ui/button.tsx`

```tsx
import { Button } from '@/components/ui/button';

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon</Button>
```

#### Card
**Location:** `/components/ui/card.tsx`

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Titre de la Carte</CardTitle>
    <CardDescription>Description de la carte</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Contenu principal de la carte</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Input
**Location:** `/components/ui/input.tsx`

```tsx
import { Input } from '@/components/ui/input';

<Input type="email" placeholder="Email" />
<Input type="password" placeholder="Mot de passe" />
<Input type="number" placeholder="Salaire" />
```

#### Label
**Location:** `/components/ui/label.tsx`

```tsx
import { Label } from '@/components/ui/label';

<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />
```

### Form Components

#### Form
**Location:** `/components/ui/form.tsx`

Uses `react-hook-form` with Zod validation:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const formSchema = z.object({
  username: z.string().min(2, {
    message: "Le nom d'utilisateur doit contenir au moins 2 caractères.",
  }),
});

function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom d'utilisateur</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
              </FormControl>
              <FormDescription>
                Votre nom d'utilisateur public.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Soumettre</Button>
      </form>
    </Form>
  );
}
```

#### Checkbox
**Location:** `/components/ui/checkbox.tsx`

```tsx
import { Checkbox } from '@/components/ui/checkbox';

<Checkbox id="terms" />
<Label htmlFor="terms">Accepter les conditions</Label>
```

#### Select
**Location:** `/components/ui/select.tsx`

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Sélectionner" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
    <SelectItem value="option3">Option 3</SelectItem>
  </SelectContent>
</Select>
```

### Layout Components

#### Separator
**Location:** `/components/ui/separator.tsx`

```tsx
import { Separator } from '@/components/ui/separator';

<div>
  <p>Contenu au-dessus</p>
  <Separator className="my-4" />
  <p>Contenu en-dessous</p>
</div>
```

#### Collapsible
**Location:** `/components/ui/collapsible.tsx`

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

<Collapsible>
  <CollapsibleTrigger>Cliquer pour afficher</CollapsibleTrigger>
  <CollapsibleContent>
    <p>Contenu caché</p>
  </CollapsibleContent>
</Collapsible>
```

---

## Customization

### Tailwind Configuration

Components use Tailwind CSS utility classes. Customize theme in `tailwind.config.ts`:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... other colors
      },
    },
  },
};
```

### CSS Variables

Define color scheme in `app/globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    /* ... other variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode colors */
  }
}
```

### Component Variants

Modify component variants using `class-variance-authority`:

```tsx
// components/ui/button.tsx
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Add custom variant
        success: "bg-green-600 text-white hover:bg-green-700",
      },
    },
  }
);
```

---

## Best Practices

### 1. Use with React Hook Form

Always pair form components with `react-hook-form` and Zod validation:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeSchema } from '@/lib/validations/employee';

const form = useForm({
  resolver: zodResolver(employeeSchema),
  defaultValues: {
    firstName: '',
    lastName: '',
  },
});
```

### 2. Accessibility

- Always pair inputs with labels
- Use proper ARIA attributes
- Ensure keyboard navigation works
- Test with screen readers

```tsx
// ✅ Good
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />

// ❌ Bad
<Input type="email" /> // No label
```

### 3. Error Handling

Display validation errors using FormMessage:

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Displays Zod errors */}
    </FormItem>
  )}
/>
```

### 4. Loading States

Use disabled state for async operations:

```tsx
const [isLoading, setIsLoading] = useState(false);

<Button disabled={isLoading}>
  {isLoading ? 'Chargement...' : 'Soumettre'}
</Button>
```

### 5. Localization

All UI text should be in French:

```tsx
// ✅ Good
<Button>Enregistrer</Button>
<FormDescription>Entrez votre email professionnel</FormDescription>

// ❌ Bad
<Button>Save</Button>
<FormDescription>Enter your work email</FormDescription>
```

---

## Complex Examples

### Employee Form

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const employeeSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  department: z.string().min(1, 'Sélectionnez un département'),
});

export function EmployeeForm() {
  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      department: '',
    },
  });

  async function onSubmit(values: z.infer<typeof employeeSchema>) {
    // Submit logic
    console.log(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nouvel Employé</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jean.dupont@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un département" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rh">Ressources Humaines</SelectItem>
                      <SelectItem value="it">Informatique</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Créer l'employé</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

---

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

---

## Next Steps

To add more components:

1. Browse [shadcn/ui components](https://ui.shadcn.com/docs/components)
2. Install needed component: `npx shadcn@latest add [component-name]`
3. Import and use in your application
4. Customize as needed in `/components/ui/`
5. Document usage patterns here

**Tip:** Most components work seamlessly together. Combine them to build complex UIs while maintaining consistency and accessibility.
