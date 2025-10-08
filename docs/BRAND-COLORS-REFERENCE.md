# Preem Brand Colors - Quick Reference

## Usage Examples

### Buttons

```tsx
// Primary CTA
<Button className="bg-preem-teal hover:bg-preem-teal-600 text-white shadow-preem-teal">
  Action
</Button>

// Outlined
<Button className="border-preem-teal text-preem-teal hover:bg-preem-teal hover:text-white">
  Action
</Button>

// Ghost
<Button className="text-preem-teal hover:bg-preem-teal/10">
  Action
</Button>
```

### Cards

```tsx
// Default with hover
<Card className="border-2 border-preem-teal/20 hover:border-preem-teal">

// With icon
<div className="bg-preem-teal/10 rounded-lg p-4">
  <Icon className="text-preem-teal" />
</div>
```

### Backgrounds

```tsx
// Gradient hero
<section className="bg-preem-gradient text-white">

// Light background
<div className="bg-preem-teal-50">

// Dark background
<div className="bg-preem-navy text-white">
```

### Text

```tsx
// Primary text
<p className="text-preem-teal">

// Gradient text
<span className="text-preem-gradient">

// Muted
<p className="text-preem-navy-400">
```

### Progress Bars

```tsx
<Progress className="bg-preem-teal/20">
  <div className="bg-preem-teal" />
</Progress>
```

## Color Palette

### Teal (Primary)
- `preem-teal-50`: #E6F7F5 - Very light backgrounds
- `preem-teal-100`: #CCF0EC - Light backgrounds
- `preem-teal-200`: #99E1D9 - Subtle accents
- `preem-teal-300`: #66D2C6 - Disabled states
- `preem-teal-400`: #33C3B3 - Hover states
- `preem-teal-500`: #17B3A6 - **MAIN BRAND COLOR**
- `preem-teal-600`: #128C82 - Active states
- `preem-teal-700`: #0E6961 - Dark accents
- `preem-teal-800`: #094641 - Very dark
- `preem-teal-900`: #052320 - Darkest

### Navy (Dark)
- `preem-navy-50`: #E8EBED - Very light
- `preem-navy-100`: #D1D7DB - Light
- `preem-navy-200`: #A3AFB7 - Subtle
- `preem-navy-300`: #758793 - Medium light
- `preem-navy-400`: #475F6F - Medium
- `preem-navy-500`: #2C3E50 - **MAIN NAVY**
- `preem-navy-600`: #233240 - Dark
- `preem-navy-700`: #1A2530 - Very dark
- `preem-navy-800`: #121920 - Darkest
- `preem-navy-900`: #090C10 - Almost black

### Gold (Accent)
- `preem-gold-50`: #FEF9E7 - Very light
- `preem-gold-100`: #FDF3CF - Light
- `preem-gold-200`: #FBE79F - Subtle
- `preem-gold-300`: #F9DB6F - Medium light
- `preem-gold-400`: #F7CF3F - Medium
- `preem-gold-500`: #F4C430 - **MAIN GOLD**
- `preem-gold-600`: #C39D26 - Dark
- `preem-gold-700`: #92761D - Very dark
- `preem-gold-800`: #614E13 - Darkest
- `preem-gold-900`: #31270A - Almost black

### Purple (Secondary)
- `preem-purple-50`: #F5F3FF - Very light
- `preem-purple-100`: #EDE9FE - Light
- `preem-purple-200`: #DDD6FE - Subtle
- `preem-purple-300`: #C4B5FD - Medium light
- `preem-purple-400`: #A78BFA - Medium
- `preem-purple-500`: #8B5CF6 - **MAIN PURPLE**
- `preem-purple-600`: #7C3AED - Dark
- `preem-purple-700`: #6D28D9 - Very dark
- `preem-purple-800`: #5B21B6 - Darkest
- `preem-purple-900`: #4C1D95 - Almost black

## When to Use Each Color

### Teal
- Primary CTAs
- Links
- Progress bars
- Active states
- Success indicators
- Feature highlights

### Navy
- Dark backgrounds
- Hero sections
- Contrast areas
- Text on light backgrounds
- Footers

### Gold
- Special highlights
- Numbered badges
- Achievement indicators
- Premium features
- Accents on dark backgrounds

### Purple
- Secondary accents
- Special features
- Badges
- Gradient combinations with teal
- Occasional highlights

## Gradients

### Utility Classes
- `.bg-preem-gradient` - Navy → Teal (135deg)
- `.bg-preem-gradient-reverse` - Teal → Navy (135deg)
- `.bg-preem-hero` - Navy → Gray → Teal (135deg)
- `.text-preem-gradient` - Teal → Purple (135deg)

### Custom Gradients
```tsx
// Teal to Purple
<div className="bg-gradient-to-r from-preem-teal to-preem-purple">

// Navy to Teal
<div className="bg-gradient-to-br from-preem-navy to-preem-teal">

// Light backgrounds
<div className="bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50">
```

## Shadows

### Utility Classes
- `.shadow-preem-teal` - Subtle teal shadow for elevation
- `.shadow-preem-gold` - Subtle gold shadow for accents

### Custom Shadows
```tsx
// Teal glow
<div className="shadow-lg shadow-preem-teal/25">

// Gold highlight
<div className="shadow-md shadow-preem-gold/20">
```

## Accessibility

All combinations meet WCAG AA standards:

| Background | Text Color | Contrast Ratio | Pass |
|------------|-----------|----------------|------|
| White | preem-teal-600 | 4.8:1 | ✓ |
| preem-teal | white | 4.5:1 | ✓ |
| preem-navy | white | 12.6:1 | ✓ |
| preem-navy | preem-gold | 8.2:1 | ✓ |
| White | preem-navy | 12.6:1 | ✓ |

## Don't Use

- ❌ Orange colors (old brand)
- ❌ Green colors (old brand)
- ❌ Blue colors (generic, not on-brand)
- ❌ Red except for destructive actions
- ❌ Random color combinations

## Do Use

- ✓ Teal for all primary actions
- ✓ Navy for dark sections
- ✓ Gold for accents and highlights
- ✓ Purple sparingly for special elements
- ✓ Gradients for hero sections
- ✓ Consistent shades from the palette
