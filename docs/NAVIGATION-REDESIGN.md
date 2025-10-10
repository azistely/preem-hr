# 🧭 Navigation Redesign - HCI-Compliant Structure

> **Goal:** Reduce cognitive load, make navigation task-oriented, and optimize for mobile-first experience.

---

## 🎯 Design Principles Applied

1. **Cognitive Load Minimization** - Max 5-7 primary items visible, rest progressive disclosure
2. **Task-Oriented Design** - Group by user goals, not system operations
3. **Mobile-First** - Hamburger menu on mobile (not bottom nav with 5+ items)
4. **Zero Learning Curve** - Obvious grouping and labeling

---

## 📱 Mobile Navigation Strategy

### ❌ Current: Bottom Nav (5 items)
**Problems:**
- 5 items = cramped on small screens
- Hard to tap accurately (each item ~75px wide on iPhone SE)
- No room for growth
- Forces showing only top-level items

### ✅ New: Hamburger Menu
**Benefits:**
- Familiar pattern (users know hamburger = menu)
- Scrollable (can show all items without cramming)
- Progressive disclosure (sections collapsible)
- More space for labels
- Works for all roles (employee → admin)

**Mobile Header:**
```
┌─────────────────────────────────────┐
│ ☰  Preem HR          🔔  👤 Profil │
└─────────────────────────────────────┘
```

**Hamburger Menu (Slides from left):**
```
┌─────────────────────┐
│ ✕ Fermer           │
├─────────────────────┤
│ 🏠 Accueil          │
│                     │
│ 📋 Mon Travail     │
│   ├ ⏱ Pointage      │
│   └ 📅 Congés       │
│                     │
│ 💰 Ma Paie         │
│   └ 📄 Bulletins    │
│                     │
│ 👤 Mon Profil      │
└─────────────────────┘
```

---

## 🖥️ Desktop Navigation Strategy

### Simplified Sidebar with Progressive Disclosure

**Key Changes:**
1. **Reduce visible items** - Show only 5-7 primary sections
2. **Collapsible groups** - Advanced features hidden by default
3. **Smart defaults** - Most-used items first
4. **Clear hierarchy** - Bold primary, muted secondary

---

## 📋 Navigation Structure by Role

### 1. 👤 Employee Navigation (SIMPLE)

**Primary Goal:** Check schedule, request time off, view payslip

#### Mobile (Hamburger)
```
🏠 Accueil
📋 Mon Travail
  ⏱ Pointage
  📅 Demander congé
💰 Ma Paie
  📄 Mes bulletins
👤 Mon Profil
```

#### Desktop Sidebar (Always Expanded)
```
┌─────────────────────────┐
│ Preem HR           [<]  │
├─────────────────────────┤
│ 🏠 Tableau de bord      │
│                         │
│ MON TRAVAIL             │
│ ⏱ Pointage              │
│ 📅 Demander congé       │
│                         │
│ MA PAIE                 │
│ 📄 Mes bulletins        │
│                         │
│ MON PROFIL              │
│ 👤 Mes informations     │
└─────────────────────────┘
```

**Total: 6 items** ✅

---

### 2. 👔 Manager Navigation (FOCUSED)

**Primary Goal:** Approve time off, review team attendance

#### Mobile (Hamburger)
```
🏠 Accueil
👥 Mon Équipe
  📋 Liste équipe
  ⏱ Pointages
📅 Approbations
  ✓ Congés à valider
📊 Rapports
  ⏰ Heures supplémentaires
```

#### Desktop Sidebar
```
┌─────────────────────────┐
│ 🏠 Tableau de bord      │
│                         │
│ MON ÉQUIPE              │
│ 👥 Liste équipe         │
│ ⏱ Pointages             │
│                         │
│ APPROBATIONS            │
│ ✓ Congés à valider [3]  │
│                         │
│ RAPPORTS                │
│ 📊 Heures sup           │
└─────────────────────────┘
```

**Total: 7 items** ✅

---

### 3. 💼 HR Manager Navigation (STREAMLINED)

**Primary Goals:** Run payroll, manage employees, handle requests

#### Mobile (Hamburger)
```
🏠 Accueil
💰 Paie
  ▶ Lancer la paie
  📜 Historique
👥 Employés
  📋 Liste
  ➕ Nouveau
⏱ Temps & Congés
  ⏱ Pointages
  📅 Demandes congés
⚙️ Plus
  [Collapsible - Advanced features]
```

#### Desktop Sidebar (Primary + Collapsible Advanced)
```
┌─────────────────────────────┐
│ 🏠 Tableau de bord          │
│ 🔔 Alertes              [5] │
│ 🔄 Workflows                │
│                             │
│ PAIE                        │
│ ▶ Lancer la paie            │
│ 📜 Historique paies         │
│ 🧮 Calculatrice paie        │
│                             │
│ EMPLOYÉS                    │
│ 👥 Liste employés           │
│ ➕ Nouvel employé           │
│ 📤 Import/Export            │
│ 💼 Postes                   │
│                             │
│ TEMPS & CONGÉS              │
│ ⏱ Pointages                 │
│ 📅 Demandes congés          │
│ 🏖 Politiques congés         │
│                             │
│ ▼ Plus d'options...         │ ← COLLAPSIBLE
│   └─ [Hidden by default]    │
│      Organigramme           │
│      Salaires               │
│      Bandes salariales      │
│      Géolocalisation        │
│      Jours fériés           │
│      Composants salaire     │
│      Secteurs               │
└─────────────────────────────┘
```

**Visible: 14 items (reduced from 28)**
**Hidden (collapsible): 7 advanced items**

---

### 4. 🔐 Tenant Admin Navigation (DRASTICALLY SIMPLIFIED)

**Primary Goals:** Same as HR Manager + user management + company settings

#### Mobile (Hamburger)
```
🏠 Accueil
💰 Paie
  ▶ Lancer la paie
  📜 Historique
👥 Employés
  📋 Liste
  ➕ Nouveau
⏱ Temps & Congés
  ⏱ Pointages
  📅 Demandes congés
🔐 Administration
  👥 Utilisateurs
  🏢 Paramètres société
⚙️ Plus
  [Collapsible - Advanced features]
```

#### Desktop Sidebar (Context Switcher + Collapsible)
```
┌─────────────────────────────────┐
│ [Mode: RH ▼]  [Admin ▼]         │ ← MODE SWITCHER
├─────────────────────────────────┤
│                                 │
│ === MODE RH ===                 │
│ [Same as HR Manager navigation] │
│                                 │
│ === MODE ADMIN ===              │
│ 🏠 Tableau de bord admin        │
│                                 │
│ ADMINISTRATION                  │
│ 👥 Utilisateurs                 │
│ 🛡 Rôles & Permissions          │
│ 🏢 Paramètres société           │
│                                 │
│ SÉCURITÉ & AUDIT                │
│ 🛡 Sécurité                     │
│ 📜 Journal d'audit              │
│                                 │
│ ▼ Plus d'options...             │
│   └─ [Hidden by default]        │
│      Facturation                │
│      Analyse coûts              │
│      Intégrations               │
└─────────────────────────────────┘
```

**Strategy:**
- **Mode Switcher** - Toggle between "RH" and "Admin" mode
- "RH" mode = HR Manager navigation (day-to-day work)
- "Admin" mode = Administrative tasks (user management, billing, security)
- Reduces mental context switching

**Visible (Admin Mode): 7 items**
**Hidden (collapsible): 3 advanced items**
**Total reduction: 74 → 7 visible items** 🎉

---

## 🎨 Visual Design Changes

### 1. **Section Headers**
```tsx
// Clear hierarchy
<h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
  Mon Travail
</h3>
```

### 2. **Primary Items (Bold, Large)**
```tsx
<Link className="text-base font-semibold min-h-[48px]">
  <Icon className="h-6 w-6" />
  Lancer la paie
</Link>
```

### 3. **Secondary Items (Muted, Smaller)**
```tsx
<Link className="text-sm text-muted-foreground min-h-[44px] pl-8">
  <Icon className="h-4 w-4" />
  Historique paies
</Link>
```

### 4. **Collapsible "Plus" Section**
```tsx
<Collapsible>
  <CollapsibleTrigger className="w-full">
    <ChevronDown className="mr-2" />
    Plus d'options
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Advanced features */}
  </CollapsibleContent>
</Collapsible>
```

---

## 🔄 Migration Strategy

### Phase 1: Mobile Hamburger (Week 1)
1. Create `<HamburgerMenu>` component
2. Replace bottom nav with header + hamburger
3. Test on iPhone SE / Android (5" screens)

### Phase 2: Desktop Simplification (Week 1)
1. Group navigation into task-oriented sections
2. Add collapsible "Plus" section for advanced features
3. Reduce visible items to 7-15 per role

### Phase 3: Admin Mode Switcher (Week 2)
1. Add mode switcher for tenant admin
2. Context toggle between RH/Admin views
3. Save preference in localStorage

### Phase 4: Polish (Week 2)
1. Smooth animations (hamburger slide, collapse)
2. Keyboard navigation (Tab, Enter, Escape)
3. Screen reader testing

---

## ✅ Success Metrics

**Before:**
- Tenant Admin: 74 visible items
- Mobile: Bottom nav with 5 cramped items
- Users need to scroll/search to find features

**After:**
- Tenant Admin: 7-15 visible items (max)
- Mobile: Hamburger menu with scrollable, organized items
- Primary tasks visible in 3 seconds ✅
- Advanced features discoverable but not overwhelming ✅

**HCI Compliance:**
- ✅ Cognitive load minimized (5-7 primary items)
- ✅ Mobile-first (hamburger > bottom nav for complex roles)
- ✅ Task-oriented grouping
- ✅ Progressive disclosure (collapsible sections)
- ✅ Touch-friendly (min 44×44px targets)

---

## 📚 References

- HCI Principle #4: Cognitive Load Minimization (docs/HCI-DESIGN-PRINCIPLES.md:103)
- Mobile-First Pattern: Touch-Friendly Navigation (docs/HCI-DESIGN-PRINCIPLES.md:431)
- Pattern 3: Progressive Disclosure (docs/HCI-DESIGN-PRINCIPLES.md:361)
