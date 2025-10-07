# Guide d'Administration - Gestion du Temps

Guide complet pour les administrateurs RH sur l'utilisation des tableaux de bord d'approbation des heures de travail et des demandes de congé.

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Approbation des heures de travail](#approbation-des-heures-de-travail)
- [Approbation des demandes de congé](#approbation-des-demandes-de-congé)
- [Architecture technique](#architecture-technique)
- [Conformité Convention Collective](#conformité-convention-collective)

---

## Vue d'ensemble

Le système d'administration du temps offre deux tableaux de bord principaux:

### 📍 `/admin/time-tracking` - Heures de travail
Approuvez ou rejetez les entrées de temps soumises par les employés, avec gestion automatique des heures supplémentaires.

### 📅 `/admin/time-off` - Demandes de congé
Approuvez ou rejetez les demandes de congé, avec détection automatique des conflits et calcul d'impact sur les soldes.

---

## Approbation des heures de travail

### Accéder au tableau de bord

1. Naviguez vers `/admin/time-tracking`
2. Par défaut, affiche les entrées de **cette semaine**
3. Utilisez le filtre en haut à droite pour changer la période:
   - **Aujourd'hui** - Entrées du jour actuel
   - **Cette semaine** - Lundi à dimanche
   - **Ce mois** - 1er au dernier jour du mois
   - **Tout** - Toutes les entrées en attente

### Interface utilisateur

#### Widget de résumé (en haut)
```
┌─────────────────────────────────────────┐
│ 🔔 12                                   │
│    entrées en attente                   │
│                                         │
│ ⏰ 45.5h Heures sup. totales            │
│                                         │
│ [✓✓ Tout approuver (12)]                │
└─────────────────────────────────────────┘
```

**Métriques affichées:**
- **Nombre d'entrées en attente** - Requiert votre approbation
- **Heures supplémentaires totales** - Somme de toutes les heures sup. en attente
- **Bouton d'approbation groupée** - Approuve toutes les entrées visibles en un clic

#### Carte d'entrée individuelle
```
┌─────────────────────────────────────────┐
│ 👤 Jean Kouadio                         │
│    Lundi 6 octobre 2025     ✓ Lieu vérifié │
│                                         │
│ ⏰ 08:15 → 18:30          Total: 10.25h │
│    Arrivée   Départ                     │
│                                         │
│ ⚠️ Heures supplémentaires: 2.25h        │
│    Heures 41-46: 2h (+15%)              │
│    Heures 46+: 0.25h (+50%)             │
│                                         │
│ 📷 Photo arrivée  📷 Photo départ       │
│ 💬 "Livraison urgente client VIP"      │
│                                         │
│ [✓ Approuver]  [✗ Rejeter]             │
└─────────────────────────────────────────┘
```

**Informations affichées:**
- **Employé** - Nom, prénom, photo de profil
- **Date** - Format long en français
- **Vérification géolocalisation** - Badge vert si dans la zone autorisée
- **Heures de pointage** - Arrivée et départ avec total
- **Heures supplémentaires** - Décomposition automatique par type:
  - Heures 41-46 (+15%)
  - Heures 46+ (+50%)
  - Week-end (+50%)
  - Nuit (+75%)
  - Jours fériés (+100%)
- **Photos** - Liens vers photos de pointage (si disponibles)
- **Notes** - Commentaires de l'employé

### Actions disponibles

#### 1. Approuver une entrée

**Étapes:**
1. Cliquez sur le bouton **[✓ Approuver]** sur la carte
2. L'entrée passe au statut `approved`
3. Les heures sont comptabilisées pour la paie
4. L'employé peut voir son approbation

**Conditions:**
- L'entrée doit être en statut `pending`
- Une fois approuvée, l'entrée ne peut plus être modifiée

#### 2. Rejeter une entrée

**Étapes:**
1. Cliquez sur le bouton **[✗ Rejeter]**
2. Une fenêtre de dialogue apparaît
3. **Saisissez obligatoirement une raison** (ex: "Heure de départ incorrecte")
4. Cliquez sur **[Confirmer le refus]**

**Ce qui se passe:**
- L'entrée passe au statut `rejected`
- L'employé reçoit la raison du refus
- L'employé peut soumettre une nouvelle entrée corrigée
- Les heures ne sont PAS comptabilisées pour la paie

**Exemples de raisons valides:**
- "Heure de départ incorrecte - vous êtes parti à 17h30 selon les caméras"
- "Hors zone de géolocalisation sans autorisation préalable"
- "Entrée dupliquée - déjà approuvée le matin"

#### 3. Approbation groupée

**Utilisation:**
1. Cliquez sur **[✓✓ Tout approuver]** dans le widget de résumé
2. **Toutes les entrées actuellement filtrées** seront approuvées
3. Confirmation de succès avec nombre d'entrées traitées

**Cas d'usage:**
- Fin de semaine: approuver toutes les entrées de la semaine en un clic
- Fin de mois: approuver toutes les entrées du mois
- Employés de confiance: approuver tout sans vérification manuelle

**⚠️ Attention:**
- L'approbation groupée est irréversible
- Vérifiez le filtre de date avant d'approuver tout
- Les entrées avec problèmes évidents (hors zone, durée anormale) devraient être vérifiées individuellement

### Détection automatique des anomalies

Le système détecte et signale automatiquement:

#### Géolocalisation hors zone
```
Badge: ⚠️ Hors zone
```
**Signification:** L'employé a pointé en dehors de la zone autorisée (géofence)

**Actions recommandées:**
1. Vérifier si l'employé avait une autorisation (déplacement, chantier externe)
2. Contacter l'employé pour explication
3. Rejeter si non autorisé

#### Heures supplémentaires excessives
```
Heures 46+: 5.5h (+50%)
```
**Signification:** L'employé a dépassé 46h/semaine (limite légale)

**Actions recommandées:**
1. Vérifier la conformité avec le Code du Travail
2. S'assurer que l'employé a eu l'autorisation managériale
3. Vérifier si compensation en repos a été accordée

#### Durée anormale
**Non détecté automatiquement - à vérifier manuellement:**
- Entrée < 1h (erreur probable)
- Entrée > 16h (oubli de pointer la sortie?)
- Pas de pause déjeuner sur une journée complète

### Règles métier appliquées

#### Calcul automatique des heures supplémentaires

**Côte d'Ivoire (CI):**
- Semaine normale: 40h
- Heures 41-46: +15% de majoration
- Heures 46+: +50% de majoration
- Week-end: +50%
- Nuit (21h-5h): +75%
- Jours fériés: +100%

**Sénégal (SN):**
- Mêmes règles que CI (convention collective UEMOA)

**Burkina Faso (BF):**
- Mêmes règles que CI (convention collective UEMOA)

**Calcul par semaine civile:**
- Lundi 0h00 → Dimanche 23h59
- Cumul des heures automatique
- Décomposition par type d'heure sup.

---

## Approbation des demandes de congé

### Accéder au tableau de bord

1. Naviguez vers `/admin/time-off`
2. Par défaut, affiche **toutes les demandes en attente**
3. Utilisez le filtre en haut à droite pour filtrer par type:
   - **Tous les types**
   - **Congés annuels** - 24 jours/an (30 jours si employé < 21 ans)
   - **Congés maladie** - Certificat médical requis
   - **Congés maternité** - 14 semaines (CI)
   - **Congés paternité** - 3 jours
   - **Congés sans solde** - Non payés

### Interface utilisateur

#### Widget de résumé
```
┌─────────────────────────────────────────┐
│ 🔔 8                                    │
│    demandes en attente                  │
│                                         │
│ [✓✓ Tout approuver (8)]                 │
└─────────────────────────────────────────┘
```

#### Carte de demande individuelle
```
┌─────────────────────────────────────────┐
│ 👤 Marie Traoré                         │
│    💍 Congé mariage                     │
│                                         │
│ 📅 15 Oct → 18 Oct 2025    4 jours     │
│    Début     Fin          Demandés      │
│                                         │
│ 💬 Raison: "Cérémonie à Bouaké"        │
│                                         │
│ 💰 Impact sur le solde (Congé mariage) │
│    20.0 → -4.0 → 16.0                  │
│    Actuel  Demandé  Restant             │
│                                         │
│ ⚠️ Conflits: 2 employés absents         │
│    - Jean Kouadio (14 Oct - 16 Oct)    │
│    - Fatou Diallo (15 Oct - 17 Oct)    │
│                                         │
│ [✓ Approuver]  [✗ Rejeter]             │
└─────────────────────────────────────────┘
```

**Informations affichées:**
- **Employé** - Nom, prénom, photo
- **Type de congé** - Icône + libellé français
- **Période** - Date de début → date de fin
- **Nombre de jours** - Calcul automatique (jours ouvrés uniquement, excluant week-ends et jours fériés)
- **Raison** - Explication de l'employé
- **Impact sur solde** - Avant, après, et solde restant
- **Conflits** - Liste des autres employés déjà en congé sur la même période

### Calcul automatique des jours ouvrés

**Le système calcule automatiquement:**
- **Exclut les week-ends** (samedi, dimanche)
- **Exclut les jours fériés** (base de données `public_holidays`)
- **Compte uniquement les jours travaillés**

**Exemple:**
```
Demande: 15 Oct → 19 Oct 2025
Jours calendaires: 5 jours
Week-ends exclus: 0 jours (semaine complète)
Jours fériés exclus: 0 jours
Total facturé: 5 jours ouvrés
```

### Détection de conflits

**Le système détecte automatiquement:**
- Employés déjà en congé approuvé sur la période demandée
- Chevauchement partiel ou total
- Affichage en badge rouge avec nombre de conflits

**Cas d'usage:**
- **2+ employés du même département** → Risque de sous-effectif
- **Employé clé** → Approbation conditionnelle
- **Période de forte activité** → Reporter si possible

**Décision finale:**
- **Le conflit est informatif, pas bloquant**
- L'administrateur décide en fonction du contexte métier
- Peut approuver même avec conflits si acceptable

### Actions disponibles

#### 1. Approuver une demande

**Étapes:**
1. Vérifier l'impact sur le solde (doit être positif)
2. Vérifier les conflits (acceptable ou non?)
3. Cliquer sur **[✓ Approuver]**

**Ce qui se passe:**
- Statut passe à `approved`
- Solde `pending` → `used`
- Nouveau solde calculé automatiquement
- Employé reçoit confirmation
- Demande ajoutée au calendrier des absences

**Conditions de validation:**
- Solde suffisant (sinon erreur)
- Pas de chevauchement avec une autre demande approuvée du même employé

#### 2. Rejeter une demande

**Étapes:**
1. Cliquer sur **[✗ Rejeter]**
2. Fenêtre de dialogue s'ouvre
3. **Saisir obligatoirement une raison claire**
4. Cliquer sur **[Confirmer le refus]**

**Ce qui se passe:**
- Statut passe à `rejected`
- Solde `pending` libéré (redevient disponible)
- Employé reçoit la raison du refus
- Employé peut soumettre une nouvelle demande corrigée

**Exemples de raisons valides:**
- "Période de forte activité (inventaire annuel). Merci de choisir une autre période."
- "Solde insuffisant après demande précédente approuvée."
- "Trop d'employés du département déjà en congé sur cette période."
- "Préavis insuffisant (14 jours requis pour congé annuel)."

#### 3. Approbation groupée

**Utilisation:**
1. Filtrer par type si nécessaire (ex: "Congés annuels")
2. Cliquer sur **[✓✓ Tout approuver]** dans le widget
3. Toutes les demandes filtrées sont approuvées

**Cas d'usage:**
- Approuver tous les congés de mariage/décès (généralement non négociables)
- Approuver tous les congés maternité (droits légaux)
- Fin de période: approuver toutes les demandes validées par les managers

**⚠️ Attention:**
- Vérifiez les conflits avant approbation groupée
- Vérifiez les soldes (erreur si insuffisant)
- L'approbation groupée échouera si une seule demande a un solde insuffisant

### Règles métier - Types de congés

#### Congés annuels (annual_leave)
**Droits légaux (Convention Collective):**
- **Standard:** 24 jours ouvrés/an (2 jours/mois)
- **Moins de 21 ans:** 30 jours ouvrés/an
- **Ancienneté 15 ans:** +2 jours
- **Ancienneté 20 ans:** +4 jours
- **Ancienneté 25 ans:** +6 jours

**Règles d'approbation:**
- Préavis de 14 jours minimum
- Pas plus de 15 jours consécutifs sans accord spécial
- Solde doit être positif

**Configuration dans le système:**
- `accrualMethod: 'accrued_monthly'`
- `accrualRate: 2.0` (2 jours/mois)
- `advanceNoticeDays: 14`

#### Congés maladie (sick_leave)
**Droits légaux:**
- Justificatif médical requis (certificat)
- Maintien de salaire partiel selon ancienneté
- Pas de limite de jours (dépend de l'état de santé)

**Règles d'approbation:**
- Certificat médical obligatoire (vérifier avec employé)
- Approbation quasi-automatique si certificat fourni
- Solde non décompté des congés annuels

#### Congé maternité (maternity)
**Droits légaux (Côte d'Ivoire):**
- 14 semaines (98 jours)
- 6 semaines avant accouchement prévu
- 8 semaines après accouchement
- Salaire maintenu à 100% (pris en charge CNPS)

**Règles d'approbation:**
- Certificat médical de grossesse requis
- Non négociable (droit légal)
- Approbation automatique recommandée

#### Congé paternité (paternity)
**Droits légaux:**
- 3 jours ouvrés
- Dans les 15 jours suivant la naissance
- Salaire maintenu à 100%

**Règles d'approbation:**
- Certificat de naissance requis
- Non négociable (droit légal)
- Approbation automatique recommandée

#### Congé mariage (marriage)
**Droits légaux:**
- 4 jours ouvrés (mariage de l'employé)
- 1 jour (mariage d'un enfant)
- Salaire maintenu à 100%

**Règles d'approbation:**
- Certificat de mariage requis (après coup)
- Non négociable (droit légal)
- Approbation automatique recommandée

#### Congé décès (bereavement)
**Droits légaux:**
- 3 jours (conjoint, enfant, parent)
- 2 jours (frère, sœur, grand-parent)
- 1 jour (beau-parent)
- Salaire maintenu à 100%

**Règles d'approbation:**
- Certificat de décès requis (après coup)
- Non négociable (droit légal)
- Approbation automatique recommandée
- Faire preuve d'empathie dans la communication

#### Congé sans solde (unpaid)
**Utilisation:**
- Convenance personnelle
- Solde épuisé mais besoin de congé
- Voyage prolongé

**Règles d'approbation:**
- Préavis de 30 jours minimum
- Accord managérial requis
- Impact sur salaire clairement communiqué
- Limite de 30 jours/an (sauf accord exceptionnel)

---

## Architecture technique

### Structure des fichiers

```
app/admin/
├── layout.tsx                     # Layout avec navigation admin
├── time-tracking/
│   └── page.tsx                   # Dashboard heures
└── time-off/
    └── page.tsx                   # Dashboard congés

components/admin/
├── time-entry-approval-card.tsx   # Carte d'entrée de temps
├── leave-request-card.tsx         # Carte de demande de congé
└── pending-summary-widget.tsx     # Widget de résumé

server/routers/
├── time-tracking.ts              # Endpoints tRPC heures
└── time-off.ts                   # Endpoints tRPC congés
```

### Endpoints tRPC

#### Time Tracking Router

```typescript
// Récupérer les entrées en attente
timeTracking.getPendingEntries({
  startDate?: Date,
  endDate?: Date
}) → TimeEntry[]

// Récupérer le résumé
timeTracking.getPendingSummary() → {
  pendingCount: number,
  totalOvertimeHours: number
}

// Approuver une entrée
timeTracking.approveEntry({
  entryId: string
}) → TimeEntry

// Rejeter une entrée
timeTracking.rejectEntry({
  entryId: string,
  rejectionReason: string
}) → TimeEntry

// Approbation groupée
timeTracking.bulkApprove({
  entryIds: string[]
}) → TimeEntry[]

// Récupérer heures sup. par employé
timeTracking.getOvertimeByEmployee({
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
}) → OvertimeSummary
```

#### Time Off Router

```typescript
// Récupérer demandes en attente avec soldes
timeOff.getPendingRequestsWithBalances() → LeaveRequest[]

// Récupérer le résumé
timeOff.getPendingSummary() → {
  pendingCount: number
}

// Approuver une demande
timeOff.approve({
  requestId: string,
  notes?: string
}) → TimeOffRequest

// Rejeter une demande
timeOff.reject({
  requestId: string,
  reviewNotes: string
}) → TimeOffRequest

// Approbation groupée
timeOff.bulkApprove({
  requestIds: string[]
}) → TimeOffRequest[]

// Détecter les conflits
timeOff.detectConflicts({
  requestId: string
}) → Conflict[]

// Récupérer tous les soldes (vue admin)
timeOff.getAllBalancesSummary() → Balance[]
```

### Base de données

#### Table `time_entries`

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  total_hours NUMERIC(5,2),
  clock_in_location GEOGRAPHY(POINT, 4326),
  clock_out_location GEOGRAPHY(POINT, 4326),
  geofence_verified BOOLEAN DEFAULT false,
  clock_in_photo_url TEXT,
  clock_out_photo_url TEXT,
  entry_type TEXT DEFAULT 'regular',
  overtime_breakdown JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Statuts:**
- `pending` - En attente d'approbation
- `approved` - Approuvé par admin
- `rejected` - Rejeté par admin

**overtime_breakdown (JSONB):**
```json
{
  "hours_41_to_46": 2.0,    // Heures 41-46 (+15%)
  "hours_above_46": 0.5,    // Heures 46+ (+50%)
  "weekend": 0,             // Heures week-end (+50%)
  "night_work": 0,          // Heures nuit (+75%)
  "holiday": 0              // Heures jours fériés (+100%)
}
```

#### Table `time_off_requests`

```sql
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL,
  reason TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Statuts:**
- `pending` - En attente d'approbation
- `approved` - Approuvé par admin
- `rejected` - Rejeté par admin

#### Table `time_off_balances`

```sql
CREATE TABLE time_off_balances (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  policy_id UUID NOT NULL,
  balance NUMERIC(5,1) DEFAULT 0,      -- Solde disponible
  used NUMERIC(5,1) DEFAULT 0,          -- Jours utilisés
  pending NUMERIC(5,1) DEFAULT 0,       -- Jours en attente d'approbation
  period_start DATE,
  period_end DATE,
  last_accrual_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Calcul du solde:**
```
Disponible = balance - pending
Après approbation: balance -= totalDays, used += totalDays, pending -= totalDays
Après rejet: pending -= totalDays (balance inchangé)
```

---

## Conformité Convention Collective

### Heures supplémentaires (Code du Travail - Livre II)

**Durée légale du travail:**
- 40 heures/semaine (8h/jour sur 5 jours)
- 46 heures maximum avec heures supplémentaires

**Majorations obligatoires:**
1. **Heures 41-46 (6 premières heures sup.):** +15%
2. **Heures 46+ (au-delà de 46h/semaine):** +50%
3. **Travail de nuit (21h-5h):** +75%
4. **Travail dominical:** +75%
5. **Jours fériés:** +100%

**Repos compensateur:**
- 1 heure sup. = 1h15 de repos (pour heures +15%)
- 1 heure sup. = 1h30 de repos (pour heures +50%)
- 1 heure sup. = 1h45 de repos (pour heures +75%)
- 1 heure sup. = 2h de repos (pour heures +100%)

**Registre obligatoire:**
- Tenir registre des heures supplémentaires
- Conservation 3 ans
- Présentation à l'inspecteur du travail sur demande

### Congés payés (Articles 68-78 du Code du Travail)

**Durée minimale:**
- 24 jours ouvrés/an (2 jours/mois de travail effectif)
- Proratisé si embauche en cours d'année
- 30 jours pour employés < 21 ans

**Jours d'ancienneté:**
- 15 ans: +2 jours
- 20 ans: +4 jours
- 25 ans: +6 jours

**Période d'acquisition:**
- 1er janvier → 31 décembre
- Droit acquis après 12 mois de service
- Prorata dès le 1er mois (accrual mensuel)

**Période de prise:**
- Congé principal: 12 jours consécutifs minimum
- Fractionnement possible avec accord employeur
- Préavis de 14 jours minimum

**Indemnité de congé:**
- 1/10e de la rémunération brute des 12 derniers mois
- ou maintien du salaire si plus favorable

### Congés pour événements familiaux (Article 79)

**Durée légale garantie:**
1. **Mariage de l'employé:** 4 jours
2. **Mariage d'un enfant:** 1 jour
3. **Naissance ou adoption:** 3 jours
4. **Décès conjoint/enfant:** 3 jours
5. **Décès parent/frère/sœur:** 2 jours
6. **Décès beau-parent:** 1 jour

**Conditions:**
- Salaire maintenu à 100%
- Non déductible des congés annuels
- Justificatif requis (certificat)

### Congé maternité (Article 80-82)

**Durée:**
- 14 semaines (6 avant + 8 après accouchement)
- Extension possible sur avis médical

**Indemnisation:**
- 100% du salaire (pris en charge CNPS)
- Pas de rupture de contrat pendant congé
- Droit de reprendre le même poste

**Protection:**
- Interdit de licencier pendant la grossesse
- Interdiction 15 mois après accouchement sauf faute lourde

---

## Support et Contact

**Questions techniques:**
- Consultez `/docs/TIME-TRACKING-IMPLEMENTATION-SUMMARY.md`
- Consultez `/docs/TIME-OFF-CONVENTION-COLLECTIVE-COMPLIANCE.md`

**Support utilisateur:**
- Email: support@preemhr.com
- Téléphone: +225 XX XX XX XX

**Mises à jour:**
- Les règles de conformité sont automatiquement mises à jour
- Les taux de majoration sont configurés en base de données
- Vérifiez régulièrement les mises à jour légales

---

*Document généré le 7 octobre 2025 - PREEM HR v2.0*
