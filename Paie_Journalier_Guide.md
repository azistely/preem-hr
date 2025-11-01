
# Paie des journaliers – Guide pratique & formules (Côte d’Ivoire)

> _Ce document synthétise les règles de calcul et les formules pour établir la paie des travailleurs journaliers (main d’œuvre occasionnelle / CDDTI), avec des exemples reproductibles. Il est conçu pour être utilisé dans vos logiciels de paie (Sage, etc.) et dans des feuilles de calcul._

---

## 1) Périmètre & définitions

- **Journaliers / main d’œuvre occasionnelle (CDDTI)** : salariés payés à la journée ou à la quinzaine / semaine, avec **clôtures intermédiaires** (2 clôtures au mois si quinzaine, 4 si semaine). Ils disposent de **livres/états/bulletins dédiés**, et **peuvent** coexister avec les permanents dans une base unique si des filtres permettent de distinguer « temporaire » vs « permanent ».  
- **Durée hebdomadaire de référence** (décret 96‑203 du 7 mars 1996) :  
  - Entreprises **non agricoles** : 40 h/semaine (équivalences admises jusqu’à 44 h).  
  - Entreprises **agricoles / assimilées** : 48 h/semaine (équivalences admises jusqu’à 52 h).  
  - **Personnel domestique et gardiennage** : 56 h/semaine (équivalence).  
  > Ces bornes servent uniquement à **poser le taux horaire** adapté au secteur.

---

## 2) Entrées indispensables (par salarié / période)

1. **Salaire catégoriel mensuel** (barème / catégorie).  
2. **Durée hebdomadaire** applicable (40h, 48h, 56h, ou équivalences ci‑dessus).  
3. **Horaire journalier de travail** (ex. 8h/jour).  
4. **Paramètres d’indemnités** de l’entreprise :  
   - **Gratification** (ex. 75 % du SMIG étalé sur l’année).  
   - **Congés payés** (ex. 2,2 jours/mois convertis en heures).  
   - **Indemnité de précarité** (ex. **3 %**).  
   - **Indemnité de transport** (ex. **30 000 F / 26 jours = 1 154 F/jour**). fileciteturn0file1  
5. **Charges / retenues** (taux en vigueur) : **CNPS retraite 6,3 %**, **IS 1,2 %**; **IGR journalier** via le barème spécifique MOA (voir § 6). fileciteturn0file1 fileciteturn0file0

---

## 3) Heures mensuelles de référence & taux horaire

**Heures mensuelles standard** (H\_mois) :  
\[ H_{mois} = \frac{(Durée\ hebdomadaire) \times 52}{12} \]  
- 40 h → **173,33 h** ; 48 h → **208,00 h** ; 56 h → **242,67 h** (arrondis).

**Taux horaire de base** (TH\_base) :  
\[ TH_{base} = \frac{Salaire\ catégoriel\ mensuel}{H_{mois}} \]

> Exemple SMIG 1ère catégorie : 75 000 F / 173,33 h = **433 F/h** (cas 40 h). fileciteturn0file1

---

## 4) Construction du salaire horaire journalier (rubriques minimales)

### 4.1. Composantes **en heure**
1. **Salaire catégoriel horaire** : **TH\_base**.  
2. **Gratification horaire** (exemple « 75 % du SMIG » lissé sur l’année) :  
   \[ Gratif\_h = \frac{SMIG \times 75\%}{12 \times H_{mois}} \]  
   → Avec SMIG=75 000 F et H\_mois=173,33 h : **27 F/h**. fileciteturn0file1  
3. **Congés payés horaire** (conversion des jours acquis en valeur horaire) :  
   - Méthode doc d’entreprise :  
     \[ CP\_h = \frac{(TH\_base \times H\_jour) + (Gratif\_h \times H\_jour)}{H_{mois}} \times (jours\ de\ CP\ mensuels) \]  
     → Avec H\_jour=8 h et 2,2 j/mois : **47 F/h**. fileciteturn0file1  
4. **Total horaire avant précarité** :  
   \[ TH_{avant\,prec} = TH_{base} + Gratif\_h + CP\_h \]  
   → **433 + 27 + 47 = 506 F/h**. fileciteturn0file1  
5. **Indemnité de précarité horaire** :  
   \[ Prec\_h = TH_{avant\,prec} \times 3\% \]  
   → **15 F/h** → **TH\_brut = 521 F/h**. fileciteturn0file1

### 4.2. Composantes **en jour**
- **Indemnité de transport journalière** (exemple) :  
  \[ IT\_{jour} = \frac{30\,000}{26} = 1\,154\ F/jour \] fileciteturn0file1

---

## 5) Salaire d’une journée de 8 heures (exemple SMIG)

- **Salaire de base** : 433 × 8 = **3 464 F**  
- **Gratification** : 27 × 8 = **216 F**  
- **Congés payés** : 47 × 8 = **376 F**  
- **Total avant précarité** : **4 056 F**  
- **Précarité (3 %)** : 4 056 × 3 % = **121 F**  
- **Salaire brut jour (hors transport)** : **4 177 F**  
- **+ Transport jour** : **1 154 F**  
- **Total coût jour** : **5 331 F** fileciteturn0file1

---

## 6) Impôt journalier (IGR – main d’œuvre occasionnelle)

La réforme ITS a instauré un **barème progressif** et une **réduction pour charges de famille**. Pour la **main d’œuvre occasionnelle**, l’Administration a **converti** les barèmes mensuels/trimestriels en **barème journalier** (tranches + réduction par parts) **à utiliser par jour travaillé**, puis à **multiplier par le nombre de jours** de la période. fileciteturn0file0

### 6.1. Procédure
1. Calculer l’**impôt brut journalier** par **tranche** sur la rémunération **journalière imposable**.  
2. Déduire la **réduction journalière** selon le **nombre de parts** (situation familiale).  
3. Multiplier le **net d’impôt journalier** par **le nombre de jours payés** de la clôture (semaine, quinzaine, etc.). fileciteturn0file0

### 6.2. Exemple administratif (10 jours)
- Célibataire, **3 enfants** (3 parts), **10 000 F/jour** × **10 jours**.  
- Impôt brut jour par tranches : **1 300 F** ; Réduction **733 F/jour** → **7 330 F** pour 10 jours.  
- **IGR dû** = 13 000 − 7 330 = **5 670 F**. fileciteturn0file0

> Utilisez ce barème journalier même si vos paies sont établies en clôtures intermédiaires (semaine/quinzaine). fileciteturn0file0

---

## 7) Retenues sociales & fiscales usuelles (exemple chiffré)

Sur **Salaire brut jour hors transport = 4 177 F** (exemple § 5) :
- **CNPS retraite (6,3 %)** : 4 177 × 6,3 % = **263 F**  
- **IS (1,2 %)** : 4 177 × 1,2 % = **50 F**  
- **IGR journalier** : selon § 6 (barème/réduction).  
- **Net à payer jour** (hors transport) = **Brut – retenues**.  
> Dans l’exemple de la fiche type : total retenues **300 F**, **Net jour = 5 031 F** (transport inclus). fileciteturn0file1

---

## 8) Algorithme de paie (clôture hebdo / quinzaine)

1. **Poser la base** horaire (H\_mois) selon **40/48/56h** → **TH\_base**.  
2. Calculer **Gratif\_h**, **CP\_h**, **Prec\_h** → **TH\_brut**.  
3. Calculer les **montants par jour** : TH\_brut × **H\_jour**.  
4. **IGR journalier** via barème/parts (§ 6) → × **Nb jours de la période**.  
5. Appliquer **CNPS** et **IS** sur le **brut** (hors indemnités exonérées).  
6. Ajouter **indemnité de transport** (par jour × nb jours) si applicable.  
7. Émettre la **clôture intermédiaire** (paie semaine/quinzaine), puis la **clôture mensuelle** si nécessaire.

---

## 9) Contrats & population

- **CDI**, **CDD à terme précis**, **CDDTI (journaliers)**, **Stages école / qualification**.  
- Les journaliers sont **comptabilisés dans l’effectif total** de l’entreprise, même si les **règles de calcul** nécessitent des bases / clôtures distinctes (Sage).

---

## 10) Annexes – paramètres à adapter

- **SMIG / barèmes catégoriels** (source RH/CC).  
- **Taux et bases CNPS / IS** (mise à jour réglementaire).  
- **Barème journalier IGR & réductions** main d’œuvre occasionnelle (Administration fiscale). fileciteturn0file0  
- **Indemnités internes** : gratification %, jours de CP/mois, transport, précarité %. fileciteturn0file1

---

### Références administratives citées

- Note DGI du **03 janv. 2024** – aménagements ITS (**barème journalier MOA & réductions**), **contribution employeur**, etc. fileciteturn0file0  
- **Fiche type « Salaire travailleur journalier » (2023)** – **formules internes** (gratification, CP, précarité, transport) et **exemple chiffré**. fileciteturn0file1
