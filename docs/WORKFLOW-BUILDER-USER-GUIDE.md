# Guide Utilisateur: Constructeur de Workflows

## 📘 Introduction

Le constructeur de workflows vous permet d'automatiser vos tâches RH récurrentes sans aucune programmation. Créez des automatisations qui se déclenchent automatiquement quand certains événements se produisent (embauche, expiration de contrat, changement de salaire, etc.).

### Qu'est-ce qu'un workflow?

Un workflow est une automatisation composée de trois éléments:

1. **Déclencheur**: L'événement qui lance le workflow (ex: "Quand un contrat expire")
2. **Conditions** (optionnel): Les critères qui doivent être remplis (ex: "Si le contrat est un CDD")
3. **Actions**: Ce qui doit être fait automatiquement (ex: "Créer une alerte pour le RH")

**Exemple simple:**
```
Déclencheur: Quand un contrat expire dans 30 jours
Condition: Si le contrat est un CDD
Action: Créer une alerte urgente pour le responsable RH
```

## 🚀 Démarrage Rapide

### 1. Accéder aux Workflows

1. Connectez-vous à Preem HR
2. Dans le menu de gauche, cliquez sur **"Workflows"**
3. Vous verrez la liste de tous vos workflows existants

### 2. Créer Votre Premier Workflow

Il y a deux façons de créer un workflow:

#### Option A: Utiliser un Modèle Pré-Configuré (Recommandé)

1. Cliquez sur **"Créer un workflow"**
2. Choisissez un modèle dans la galerie (ex: "Alerte d'expiration de contrat")
3. Le modèle est pré-configuré - vous pouvez l'utiliser tel quel ou le modifier
4. Cliquez sur **"Activer"** pour le mettre en service

#### Option B: Créer de Zéro

1. Cliquez sur **"Créer un workflow"**
2. Cliquez sur **"Créer depuis zéro"**
3. Suivez l'assistant en 5 étapes (voir ci-dessous)

## 📋 Assistant de Création (5 Étapes)

### Étape 1: Choisir un Modèle

**Modèles Disponibles:**

**Gestion des Contrats:**
- **Alerte d'expiration de contrat (30 jours)**: Notifie le RH 30 jours avant l'expiration d'un contrat
- **Alerte d'expiration de contrat (60 jours)**: Notifie le RH 60 jours avant l'expiration
- **Renouvellement automatique**: Crée une alerte pour préparer le renouvellement d'un contrat

**Paie:**
- **Changement de salaire**: Notifie quand le salaire d'un employé change
- **Rappel de paie mensuelle**: Rappelle de lancer la paie 5 jours avant la fin du mois

**Intégration:**
- **Nouvel employé**: Workflow automatique quand un employé est embauché
- **Documents d'intégration**: Envoie les documents nécessaires au nouvel employé

**Départ:**
- **Procédure de départ**: Checklist automatique quand un employé quitte l'entreprise
- **Documents de fin de contrat**: Génère les documents de sortie

### Étape 2: Configurer le Déclencheur

Choisissez l'événement qui déclenchera votre workflow:

**Événements Disponibles:**
- **Quand un employé est embauché** (`employee.hired`)
- **Quand un contrat expire** (`contract.expiring`)
- **Quand le salaire change** (`salary.changed`)
- **Quand un congé est approuvé** (`leave.approved`)
- **Quand un document expire** (`document.expiring`)
- **Quand un employé est terminé** (`employee.terminated`)

**Configuration du Déclencheur:**

Certains déclencheurs ont des paramètres:

*Exemple: "Quand un contrat expire"*
- **Nombre de jours avant expiration**: 30, 60, 90 jours
- **Type de contrat**: CDD, CDI, Stage, tous

### Étape 3: Ajouter des Conditions (Optionnel)

Les conditions filtrent quand le workflow doit s'exécuter.

**Exemple de Conditions:**

```
Si le type de contrat est égal à "CDD"
ET Si le département contient "Ventes"
ET Si le salaire est supérieur à 500000
```

**Opérateurs Disponibles:**
- **est égal à**: Valeur exacte
- **est différent de**: Valeur différente
- **est supérieur à**: Pour les nombres
- **est supérieur ou égal à**: Pour les nombres
- **est inférieur à**: Pour les nombres
- **est inférieur ou égal à**: Pour les nombres
- **contient**: Pour le texte (recherche partielle)
- **fait partie de**: Pour une liste de valeurs

**Champs Disponibles:**
- `employeeId`: ID de l'employé
- `employeeName`: Nom complet
- `department`: Département
- `position`: Poste
- `salary`: Salaire
- `contractType`: Type de contrat (CDD, CDI, etc.)
- `hireDate`: Date d'embauche
- `terminationDate`: Date de fin
- Et bien d'autres...

**Comment Ajouter une Condition:**

1. Cliquez sur **"+ Ajouter une condition"**
2. Sélectionnez le **champ** (ex: "Type de contrat")
3. Choisissez l'**opérateur** (ex: "est égal à")
4. Entrez la **valeur** (ex: "CDD")
5. Répétez pour ajouter plus de conditions

**Note:** Toutes les conditions doivent être remplies (logique ET).

### Étape 4: Choisir les Actions

Les actions sont ce qui sera exécuté automatiquement.

**Actions Disponibles:**

#### 1. Créer une Alerte

Crée une alerte dans le tableau de bord RH.

**Configuration:**
- **Titre**: Ex: "Contrat expire dans 30 jours"
- **Description**: Détails de l'alerte
- **Sévérité**:
  - Information (bleue)
  - Attention (orange)
  - Urgent (rouge)
- **Assigner à**: Responsable RH, Manager, ou personne spécifique
- **Date d'échéance**: Optionnel

**Exemple:**
```
Créer une alerte
  Titre: "Contrat de {employeeName} expire le {expiryDate}"
  Sévérité: Urgent
  Assigner à: Responsable RH
  Date d'échéance: {expiryDate} - 7 jours
```

#### 2. Envoyer une Notification

Envoie une notification email ou SMS.

**Configuration:**
- **Destinataire**: Email ou numéro de téléphone
- **Sujet**: Titre de la notification
- **Message**: Contenu (peut utiliser des variables)

**Exemple:**
```
Envoyer une notification
  Destinataire: rh@entreprise.com
  Sujet: "Action requise: Contrat expire"
  Message: "Le contrat de {employeeName} expire le {expiryDate}.
            Veuillez préparer le renouvellement."
```

#### 3. Créer un Événement de Paie

Déclenche un événement dans le système de paie.

**Configuration:**
- **Type d'événement**: Bonus, Prime, Ajustement, etc.
- **Montant**: Montant de l'événement
- **Description**: Détails

**Exemple:**
```
Créer un événement de paie
  Type: Prime d'ancienneté
  Montant: 50000 FCFA
  Description: "Prime automatique après 1 an de service"
```

#### 4. Mettre à Jour le Statut de l'Employé

Change automatiquement le statut d'un employé.

**Configuration:**
- **Nouveau statut**: Actif, En congé, Suspendu, Terminé

**Exemple:**
```
Mettre à jour le statut
  Nouveau statut: "Terminé"
```

**Vous pouvez sélectionner plusieurs actions!**

### Étape 5: Résumé et Activation

Vérifiez votre configuration:

1. **Déclencheur**: Quand va-t-il se déclencher?
2. **Conditions**: Quelles sont les conditions?
3. **Actions**: Que va-t-il faire?

**Options d'Activation:**

- **Sauvegarder comme brouillon**: Le workflow n'est pas actif, vous pouvez le modifier plus tard
- **Activer maintenant**: Le workflow commence à surveiller les événements immédiatement

## 📊 Gérer Vos Workflows

### Voir la Liste des Workflows

Sur la page **"Workflows"**, vous voyez:

- **Nom du workflow**
- **Statut**:
  - 🟢 Actif: En service
  - 🟡 En pause: Temporairement désactivé
  - ⚪ Brouillon: Pas encore activé
  - ⚫ Archivé: Supprimé
- **Statistiques**:
  - Nombre d'exécutions
  - Taux de succès (%)
  - Nombre d'erreurs
  - Dernière exécution

### Actions Disponibles

Pour chaque workflow, vous pouvez:

1. **Modifier**: Changer la configuration
2. **Activer/Mettre en pause**: Démarrer ou arrêter temporairement
3. **Voir les détails**: Voir la configuration complète
4. **Voir l'historique**: Voir toutes les exécutions
5. **Supprimer**: Archiver le workflow

### Voir les Détails d'un Workflow

Cliquez sur un workflow pour voir:

- **Configuration complète**: Déclencheur, conditions, actions
- **Statistiques détaillées**:
  - Exécutions totales
  - Taux de succès
  - Temps moyen d'exécution
  - Dernière exécution
- **Historique récent**: Les 5 dernières exécutions
- **Graphique de performance**: Évolution dans le temps

### Voir l'Historique d'Exécution

L'historique montre chaque fois que le workflow s'est exécuté:

**Informations par Exécution:**
- **Date et heure**: Quand s'est-il exécuté?
- **Statut**:
  - ✅ Succès: Tout s'est bien passé
  - ❌ Échec: Une erreur s'est produite
  - ⏭️ Ignoré: Les conditions n'étaient pas remplies
- **Actions exécutées**: Quelles actions ont été faites?
- **Détails techniques**: Log complet (pour le débogage)

**Filtres:**
- Par statut (succès, échec, ignoré)
- Par période (aujourd'hui, cette semaine, ce mois)

## 🔧 Modifier un Workflow

Pour modifier un workflow existant:

1. Allez sur la page **"Workflows"**
2. Cliquez sur le menu **"..."** à droite du workflow
3. Sélectionnez **"Modifier"**
4. Modifiez ce que vous voulez:
   - Nom et description
   - Déclencheur
   - Conditions
   - Actions
5. Cliquez sur **"Sauvegarder"**

**Note:** Si le workflow est actif, les changements s'appliquent immédiatement.

## ⏸️ Mettre en Pause un Workflow

Parfois, vous voulez arrêter temporairement un workflow (ex: pendant les vacances):

1. Allez sur la page **"Workflows"**
2. Cliquez sur le menu **"..."** à droite du workflow
3. Sélectionnez **"Mettre en pause"**

Le workflow ne s'exécutera plus jusqu'à ce que vous le réactiviez.

**Pour Réactiver:**
1. Même menu **"..."**
2. Sélectionnez **"Activer"**

## 🗑️ Supprimer un Workflow

Pour supprimer un workflow:

1. Allez sur la page **"Workflows"**
2. Cliquez sur le menu **"..."** à droite du workflow
3. Sélectionnez **"Supprimer"**
4. Confirmez la suppression

**Note:** Le workflow est archivé (pas supprimé définitivement). L'historique d'exécution est conservé.

## 🧪 Tester un Workflow

Avant d'activer un workflow, vous pouvez le tester:

1. Allez sur la page de détails du workflow
2. Cliquez sur **"Tester le workflow"**
3. Entrez des données de test (optionnel)
4. Cliquez sur **"Exécuter le test"**

Le test montre:
- ✅ **Conditions remplies**: Les conditions sont-elles satisfaites?
- 📋 **Actions qui seraient exécutées**: Aperçu des actions (elles ne sont PAS vraiment exécutées)
- ⚠️ **Erreurs potentielles**: Problèmes détectés

**Aucune action réelle n'est exécutée pendant le test!**

## 💡 Bonnes Pratiques

### 1. Commencez Simple

- Utilisez les modèles pré-configurés
- Testez avec un seul déclencheur et une seule action
- Ajoutez des conditions progressivement

### 2. Nommez Clairement Vos Workflows

**Bon:**
- "Alerte contrat CDD expire (30 jours)"
- "Notification changement salaire > 10%"

**Évitez:**
- "Workflow 1"
- "Test"

### 3. Testez Avant d'Activer

Utilisez toujours la fonction **"Tester le workflow"** avant d'activer.

### 4. Surveillez les Performances

Consultez régulièrement:
- Taux de succès (devrait être > 95%)
- Historique d'exécution
- Erreurs éventuelles

### 5. Mettez en Pause les Workflows Saisonniers

Si un workflow n'est utile qu'à certaines périodes, mettez-le en pause le reste du temps.

### 6. Documentez Vos Workflows

Utilisez le champ **"Description"** pour expliquer:
- Pourquoi ce workflow existe
- Qui doit être notifié en cas de problème
- Quand il devrait être mis à jour

## ❓ Résolution des Problèmes

### Le Workflow Ne S'Exécute Pas

**Vérifications:**
1. Le workflow est-il **actif**? (pas en pause ou brouillon)
2. Le déclencheur s'est-il vraiment produit?
3. Les conditions sont-elles remplies?
4. Consultez l'historique: y a-t-il des exécutions "ignorées"?

### Le Workflow Échoue Constamment

**Causes Communes:**
1. **Configuration incorrecte des actions**:
   - Vérifiez les champs requis
   - Assurez-vous que les emails/IDs sont valides

2. **Conditions trop strictes**:
   - Simplifiez les conditions
   - Testez chaque condition individuellement

3. **Problème technique**:
   - Consultez les logs détaillés dans l'historique
   - Contactez le support si le message d'erreur n'est pas clair

### Les Alertes Ne Sont Pas Créées

**Vérifications:**
1. L'action **"Créer une alerte"** est-elle sélectionnée?
2. Le champ **"Assigner à"** est-il correct?
3. Consultez l'historique: l'action est-elle marquée comme **"exécutée avec succès"**?

### Les Notifications Ne Sont Pas Envoyées

**Vérifications:**
1. L'email du destinataire est-il correct?
2. Le domaine d'email est-il autorisé?
3. Vérifiez les dossiers spam

## 📞 Support

Si vous avez besoin d'aide:

1. **Documentation**: Consultez ce guide
2. **Historique**: Regardez les logs détaillés dans l'historique d'exécution
3. **Support**: Contactez support@preem.app avec:
   - ID du workflow
   - Description du problème
   - Capture d'écran si possible

## 📈 Exemples de Workflows Courants

### Exemple 1: Alerte Expiration Contrat CDD (30 Jours)

```yaml
Déclencheur: contract.expiring
  Paramètres:
    - Jours avant expiration: 30
    - Type de contrat: CDD

Conditions:
  - contractType est égal à "CDD"

Actions:
  - Créer une alerte
      Titre: "Contrat de {employeeName} expire dans 30 jours"
      Sévérité: Urgent
      Assigner à: Responsable RH
      Description: "Contrat {contractType} expire le {expiryDate}"
```

**Résultat:** Le RH reçoit une alerte urgente 30 jours avant l'expiration de tout contrat CDD.

### Exemple 2: Notification Changement de Salaire Important

```yaml
Déclencheur: salary.changed

Conditions:
  - percentChange est supérieur à 10

Actions:
  - Envoyer une notification
      Destinataire: finance@entreprise.com
      Sujet: "Changement de salaire important"
      Message: "Le salaire de {employeeName} a changé de {oldSalary} à {newSalary} ({percentChange}% d'augmentation)"

  - Créer une alerte
      Titre: "Révision salariale validée"
      Sévérité: Information
      Assigner à: Manager
```

**Résultat:** Quand un salaire augmente de plus de 10%, le département finance est notifié et le manager reçoit une alerte.

### Exemple 3: Workflow d'Intégration Nouvel Employé

```yaml
Déclencheur: employee.hired

Actions:
  - Créer une alerte
      Titre: "Préparer l'intégration de {employeeName}"
      Sévérité: Attention
      Assigner à: Manager
      Date d'échéance: {hireDate} - 7 jours
      Description: "Checklist intégration:
                   - Poste de travail
                   - Équipement informatique
                   - Accès aux systèmes"

  - Envoyer une notification
      Destinataire: {employeeEmail}
      Sujet: "Bienvenue chez {companyName}!"
      Message: "Bonjour {employeeName}, nous sommes ravis de vous accueillir..."
```

**Résultat:** Quand un employé est embauché, le manager reçoit une checklist d'intégration une semaine avant, et l'employé reçoit un email de bienvenue.

## 🎓 Formation

**Durée Recommandée:** 30 minutes

**Objectifs:**
- Créer un workflow simple à partir d'un modèle (5 min)
- Créer un workflow personnalisé avec conditions (15 min)
- Consulter l'historique et interpréter les résultats (5 min)
- Modifier et tester un workflow (5 min)

**Exercice Pratique:**

Créez un workflow qui:
1. Se déclenche quand un contrat CDD expire dans 60 jours
2. Crée une alerte pour le RH
3. Envoie une notification au manager de l'employé
4. Testez-le avec des données fictives
5. Activez-le

---

**Version:** 1.0
**Date:** Octobre 2025
**Contact:** support@preem.app
