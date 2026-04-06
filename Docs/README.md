# ♛ ARIA — Système de jeu de rôle sur table

Outil de gestion de partie TTRPG hébergé sur le web, sans installation.  
Accessible depuis n'importe quel navigateur, sauvegarde automatique dans le cloud.

---

## 🌐 Accès

| Panneau | URL |
|---|---|
| **Accueil** | `https://mathieu-chateigner.github.io/Aria/` |
| **Joueur** | `https://mathieu-chateigner.github.io/Aria/views/aria-player.html` |
| **Maître de Jeu** | `https://mathieu-chateigner.github.io/Aria/views/aria-gm.html` |
| **Overlay OBS** | `https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=player&ably=CLE` |

---

## 📁 Structure du projet

```
Aria/
├── index.html          ← Page d'accueil (sélection Joueur / MJ + configuration)
├── views/
│   ├── aria-player.html
│   ├── aria-gm.html
│   └── aria-overlay.html
├── css/
│   ├── aria-player.css
│   ├── aria-gm.css
│   └── aria-overlay.css
└── js/
    ├── aria-player.js
    ├── aria-gm.js
    └── aria-overlay.js
```

---

## 🔧 Prérequis — Comptes à créer (gratuits)

### 1. Ably — Synchronisation en temps réel
> Permet aux panneaux joueur/MJ de communiquer en temps réel.

1. Aller sur [ably.com](https://ably.com) → **Sign up**
2. Créer une **App** (nom au choix)
3. Onglet **API Keys** → copier la clé **Root** (`xxxxxxxx:yyyyyyyyyy`)
4. **Tout le monde utilise la même clé** — joueurs ET MJ

### 2. Supabase — Sauvegarde cloud
> Stocke les données de chaque joueur/MJ dans le cloud.

1. Aller sur [supabase.com](https://supabase.com) → créer un projet (gratuit)
2. **SQL Editor** → exécuter :
```sql
CREATE TABLE saves (
  save_key   TEXT        PRIMARY KEY,
  data       JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon access" ON saves FOR ALL TO anon USING (true) WITH CHECK (true);
```
3. **Project Settings → API** → copier l'**URL** et la **Publishable key**
4. Les renseigner dans `js/aria-player.js` et `js/aria-gm.js` :
```js
const SUPABASE_URL      = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'votre-publishable-key';
```

### 3. dddice — Dés 3D *(optionnel)*
> Affiche des dés 3D animés dans OBS.

1. Aller sur [dddice.com](https://dddice.com) → créer un compte
2. **Account → Developers** → copier votre **API Key**
3. Créer une **Room** → copier le slug
4. À renseigner sur la **page d'accueil** dans le panneau ⚙ Configuration

---

## 🚀 Première utilisation

### Configuration initiale (une seule fois)
1. Aller sur [la page d'accueil](https://mathieu-chateigner.github.io/Aria/)
2. Dans le panneau **⚙ Configuration** en bas de page :
   - Renseigner la **clé Ably** (obligatoire)
   - Renseigner la **clé API dddice** et le **slug de room** (optionnel)
3. Cliquer **Sauvegarder** — ces clés sont partagées par le panneau Joueur et le panneau MJ

### Joueur
1. Page d'accueil → cliquer **Joueur**
2. Une **clé de sauvegarde** est générée automatiquement — la noter précieusement
3. Cliquer **Continuer**
4. Sur l'écran de sélection, cliquer **+ Nouveau personnage**
5. Saisir le **code campagne** fourni par le MJ pour lier le personnage à la campagne

> Pour retrouver sa progression sur un autre appareil : cliquer **Changer…** sur l'écran de sélection → saisir sa clé existante.

### Maître de Jeu
1. Page d'accueil → cliquer **Maître de Jeu**
2. Même processus de clé de sauvegarde
3. Créer une **campagne** — un **code d'accès** (ex : `X7K2M`) est généré automatiquement
4. Partager ce code aux joueurs pour qu'ils le renseignent dans leur personnage
5. Seuls les joueurs avec le bon code apparaissent dans l'onglet **Joueurs**

---

## ⚙ Configuration (page d'accueil)

| Champ | Obligatoire | Description |
|---|---|---|
| Clé Ably | **Oui** | Même clé pour tous — joueurs ET MJ |
| Clé API dddice | Non | Pour les dés 3D |
| Room dddice | Non | Slug de la room partagée |

La configuration est **partagée** entre le panneau Joueur et le panneau MJ — une seule saisie suffit.  
Le thème dddice et le mode clair restent configurables via le bouton ⚙ dans chaque panneau.

---

## 🎮 Utilisation en partie

### Panneau Joueur — Onglets

| Onglet | Description |
|---|---|
| **Compétences** | Cliquer une compétence pour lancer le d100 |
| **Caractéristiques** | Choisir le multiplicateur (×1 à ×5) puis cliquer la stat |
| **Jet libre** | Nom + seuil manuel → Lancer |
| **Notes** | Bloc-notes personnel multi-notes par personnage |
| **Cartes** | Paquet de 54 cartes — cliquer pour piocher *(activé par le MJ)* |
| **⚗ Alchimie** | Recettes accordées par le MJ, création de potions *(activé par le MJ)* |
| **Personnage** | Édition de la fiche complète (dont le code campagne) |

**Barre Bonus/Malus** : persistante entre les onglets, s'applique à tous les jets d100.

**Combat** (sidebar) :
- Cliquer une arme pour lancer les dégâts
- 🛡 **Parade** : jet de Combat rapproché
- ⚡ **Esquive** : jet d'Esquiver (−20% si attaque à distance)

### Panneau MJ — Onglets

| Onglet | Description |
|---|---|
| **Joueurs** | Présence en temps réel, PV, ⚔ dégâts, ♥ soins, 📋 fiche complète |
| **Monstres** | Créatures privées — cliquer une attaque pour lancer |
| **Jets** | Historique en direct de tous les jets des joueurs |
| **Jet MJ** | Jets privés libres ou par monstre |
| **Cartes** | Paquet indépendant du joueur |
| **⚗ Alchimie** | Gestion des recettes par campagne, attribution aux joueurs |

**📋 Modal joueur** (bouton en haut à droite de chaque carte joueur) :
- Fiche complète : stats, armes, compétences, inventaire, potions
- Activer/désactiver les onglets Cartes et Alchimie par joueur

### Overlay OBS

Dans OBS → **Sources → Source navigateur** :

```
# Overlay joueur
https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=player&ably=CLE_ABLY

# Overlay MJ
https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=gm&ably=CLE_ABLY
```

- Largeur : `1920` — Hauteur : `1080` — Fond transparent
- S'affiche automatiquement lors des jets, pioches de cartes et événements de dégâts

---

## 🎲 Règles de jet ARIA

| Résultat | Condition |
|---|---|
| **SUCCÈS CRITIQUE** | Jet ≤ 10 ET jet ≤ seuil |
| **SUCCÈS** | Jet ≤ seuil |
| **ÉCHEC** | Jet > seuil |
| **ÉCHEC CRITIQUE** | Jet ≥ 91 ET jet > seuil |

**Calcul du seuil :**
- Compétence : valeur % directe
- Caractéristique : `multiplicateur × stat + Bonus/Malus`
- Jet libre : seuil saisi manuellement

---

## 🔁 Flux de données (Ably)

```
aria-player
    ├── aria-rolls   ──▶ MJ (historique) + autres joueurs (toast) + overlay
    ├── aria-cards   ──▶ overlay (animation carte)
    └── aria-damage  ──▶ MJ (présence heartbeat toutes les 5s)

aria-gm
    └── aria-damage  ──▶ joueur ciblé (dégâts / soins / config tabs / recettes)

aria-overlay
    ├── aria-rolls   ──▶ affiche le résultat après animation dddice
    ├── aria-cards   ──▶ affiche la carte piochée
    └── aria-damage  ──▶ animations dégâts, soins, écran MORT
```

---

## 💾 Sauvegarde

- Les données sont sauvegardées dans **Supabase** (cloud) à chaque modification (délai 800ms)
- Également en cache dans le **localStorage** du navigateur pour fluidité
- La **clé de sauvegarde** (UUID) est l'identifiant unique de chaque joueur/MJ
- En cas de perte de clé : les données restent dans Supabase mais sont inaccessibles sans la clé

---

## ❓ Dépannage

**Pastille Ably rouge** → Vérifier la clé Ably sur la page d'accueil (sans espaces, format `xxx:yyy`)

**Les joueurs n'apparaissent pas chez le MJ** → Vérifier que la même clé Ably est utilisée et que le joueur a renseigné le bon **code campagne** dans son personnage. Les joueurs envoient un heartbeat toutes les 5s — attendre quelques secondes après ouverture.

**Les données ne se sauvegardent pas** → Vérifier que `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont bien renseignés dans les fichiers JS et que la table `saves` a été créée.

**Les dés 3D ne s'affichent pas** → dddice est optionnel. Sans configuration, les jets fonctionnent normalement sans animation 3D.

**L'overlay OBS est blanc/vide** → Vérifier que le paramètre `?ably=` est renseigné dans l'URL et que la clé est correcte.
