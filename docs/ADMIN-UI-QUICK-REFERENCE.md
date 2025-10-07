# Admin UI - Quick Reference Card

**Quick guide for HR managers** - Print this page for easy reference!

---

## 🕐 Time Tracking Approvals

**URL:** `/admin/time-tracking`

### Quick Actions

| Action | Steps | Time |
|--------|-------|------|
| **Approve all this week** | 1. Select "Cette semaine"<br>2. Click "Tout approuver" | 10 sec |
| **Approve one entry** | 1. Click "Approuver" on card | 5 sec |
| **Reject with reason** | 1. Click "Rejeter"<br>2. Type reason<br>3. Click "Confirmer" | 30 sec |

### What You See

```
┌─────────────────────────────────┐
│ 🔔 12 entrées en attente        │
│ ⏰ 45.5h heures sup. totales    │
│ [Tout approuver (12)]           │
└─────────────────────────────────┘

👤 Jean Kouadio - Lun 06 Oct 2025
⏰ 08:15 → 18:30 (10.25h)
✓ Lieu vérifié
⚠️ Heures sup: 2.25h
[✓ Approuver] [✗ Rejeter]
```

### Red Flags to Check

- ⚠️ **Hors zone** - Not at authorized location
- 🕐 **46+ hours/week** - Overtime limit exceeded
- 📷 **No photo** - Missing verification photo
- 🕐 **16+ hours/day** - Possibly forgot to clock out

---

## 📅 Time-Off Approvals

**URL:** `/admin/time-off`

### Quick Actions

| Action | Steps | Time |
|--------|-------|------|
| **Approve all annual leave** | 1. Select "Congés annuels"<br>2. Click "Tout approuver" | 10 sec |
| **Approve one request** | 1. Click "Approuver" on card | 5 sec |
| **Reject with reason** | 1. Click "Rejeter"<br>2. Type reason<br>3. Click "Confirmer" | 30 sec |

### What You See

```
┌─────────────────────────────────┐
│ 🔔 8 demandes en attente        │
│ [Tout approuver (8)]            │
└─────────────────────────────────┘

👤 Marie Traoré
💍 Congé mariage (4 jours)
📅 15 Oct → 18 Oct 2025
💰 Solde: 20.0 → 16.0 jours restants
⚠️ 2 conflits (employés déjà absents)
[✓ Approuver] [✗ Rejeter]
```

### Red Flags to Check

- 🔴 **Solde négatif** - Insufficient balance after approval
- ⚠️ **Conflits** - Other employees already on leave
- 📅 **Préavis court** - Less than 14 days notice
- 📊 **Haute activité** - During busy period (inventory, etc.)

---

## 🎯 Common Scenarios

### Scenario 1: Weekly Time Approval (Friday 4pm)
**Goal:** Approve all entries for the week

1. Go to `/admin/time-tracking`
2. Filter: "Cette semaine"
3. Review entries (look for red flags)
4. Click "Tout approuver (XX)"
5. Done! ✅

**Time:** 2-5 minutes

---

### Scenario 2: Marriage Leave Request
**Goal:** Approve 4-day marriage leave

1. Go to `/admin/time-off`
2. Find "Congé mariage" request
3. Check balance (should have enough)
4. Check conflicts (acceptable or not?)
5. Click "Approuver"
6. Done! ✅

**Time:** 30 seconds

**Note:** Marriage leave is a legal right - almost always approve!

---

### Scenario 3: Reject Overtime Entry
**Goal:** Reject overtime without authorization

1. Go to `/admin/time-tracking`
2. Find entry with excessive overtime
3. Click "Rejeter"
4. Type reason: *"Heures supplémentaires non autorisées par votre manager. Merci de soumettre une autorisation signée."*
5. Click "Confirmer le refus"
6. Done! ✅

**Time:** 1 minute

---

### Scenario 4: Annual Leave with Conflict
**Goal:** Approve despite conflict

1. Go to `/admin/time-off`
2. Find request with ⚠️ Conflit badge
3. Review conflict details:
   - Who's already on leave?
   - Same department?
   - Can we manage with reduced staff?
4. **If OK:** Click "Approuver"
5. **If NOT OK:** Click "Rejeter" + reason
6. Done! ✅

**Time:** 1-2 minutes

---

## 📊 Leave Types Quick Reference

| Type | Icon | Days | Auto-Approve? | Document Required |
|------|------|------|---------------|-------------------|
| Congé annuel | ✈️ | 24/year | No | - |
| Congé maladie | ❤️ | Unlimited | No | Medical cert |
| Congé maternité | 👶 | 98 days | Yes | Medical cert |
| Congé paternité | 👨‍👧 | 3 days | Yes | Birth cert |
| Congé mariage | 💍 | 4 days | Yes | Marriage cert |
| Congé décès | 📄 | 1-3 days | Yes | Death cert |
| Congé sans solde | 💰 | Varies | No | - |

**Auto-approve = Legal right, almost never reject**

---

## ⏱️ Overtime Rates Quick Reference

| Type | Rate | Example |
|------|------|---------|
| Hours 41-46 | +15% | 1h = 1h15 paid |
| Hours 46+ | +50% | 1h = 1h30 paid |
| Weekend | +50% | 1h = 1h30 paid |
| Night (21h-5h) | +75% | 1h = 1h45 paid |
| Holidays | +100% | 1h = 2h paid |

**Legal limit:** 46 hours/week maximum

---

## 🚨 When to Reject

### Time Entries
- ❌ Hors zone without prior authorization
- ❌ Excessive overtime without manager approval
- ❌ Duplicate entry (already approved)
- ❌ Clearly incorrect times (16+ hours/day)

### Leave Requests
- ❌ Insufficient balance (automatic error)
- ❌ Too many team members already on leave
- ❌ During blackout period (inventory, audit, etc.)
- ❌ Less than 14 days notice (annual leave only)

**Always provide clear reason when rejecting!**

---

## 💡 Best Practices

### ✅ DO
- Approve weekly (don't wait until month-end)
- Provide clear rejection reasons
- Check conflicts before approving leave
- Verify balance before approving
- Look for patterns (recurring late arrivals)

### ❌ DON'T
- Approve without reviewing red flags
- Reject without clear explanation
- Wait until last minute (blocks payroll)
- Approve negative balances (system prevents it)
- Ignore geofence violations

---

## 🆘 Troubleshooting

### "Cannot approve - insufficient balance"
**Cause:** Employee doesn't have enough leave days

**Solution:**
1. Check balance details
2. Verify if balance accrual is up to date
3. Ask employee to reduce days OR reject

---

### "Bulk approve failed"
**Cause:** One or more entries have errors

**Solution:**
1. Approve entries individually
2. Find the problematic entry
3. Fix or reject it
4. Continue with others

---

### "Conflict detected"
**Cause:** Other employees on leave same period

**Solution:**
1. Review conflict details
2. Assess team capacity
3. Approve if acceptable OR reject with reason

---

## 📞 Support

**Questions?** Contact IT Support:
- Email: support@preemhr.com
- Phone: +225 XX XX XX XX

**Documentation:**
- Full guide: `/docs/ADMIN-TIME-MANAGEMENT-GUIDE.md`
- Technical: `/docs/ADMIN-UI-IMPLEMENTATION-SUMMARY.md`

---

**Print this page for quick reference!**

*Last updated: 7 octobre 2025*
