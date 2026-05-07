# ♛ ARIA — Outil de jeu de rôle sur table

Système de gestion de partie TTRPG hébergé sur le web, sans installation.  
Accès depuis n'importe quel navigateur, sauvegarde automatique dans le cloud.

---

## Accès rapide

| Panneau | URL |
|---|---|
| **Accueil** | `https://mathieu-chateigner.github.io/Aria/` |
| **Joueur** | `https://mathieu-chateigner.github.io/Aria/views/aria-player.html` |
| **Maître de Jeu** | `https://mathieu-chateigner.github.io/Aria/views/aria-gm.html` |
| **Overlay OBS** | `https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=gm&ably=CLE` |

---

## Mise en place (à faire une seule fois par groupe)

### 1. Créer une clé Ably

Ably gère la communication en temps réel entre les panneaux joueur, MJ et l'overlay OBS.  
Tous les membres d'un même groupe partagent **la même clé**.

1. Aller sur [ably.com](https://ably.com) → **Sign up** (gratuit)
2. Créer une **App** (nom au choix)
3. Onglet **API Keys** → copier la clé Root — format `xxxxxxxx:yyyyyyyyyy`

### 2. Saisir la clé sur la page d'accueil

1. Ouvrir [la page d'accueil](https://mathieu-chateigner.github.io/Aria/)
2. Dans le panneau **⚙ Configuration** en bas de page, renseigner la **Clé Ably**
3. Cliquer **Sauvegarder**

Cette clé est mémorisée dans le navigateur. Elle s'applique au panneau Joueur et au panneau MJ.

> **Tous les participants (joueurs ET MJ) doivent saisir la même clé Ably.**

---

## Clé de sauvegarde

À la première ouverture du panneau Joueur ou MJ, l'application génère ou demande une **clé de sauvegarde** (un code UUID comme `a1b2c3d4-...`).

- **Première utilisation** → cliquer **Générer une nouvelle clé** — noter cette clé précieusement
- **Retour sur un autre appareil** → cliquer **J'ai déjà une clé** → saisir la clé existante

La clé identifie vos données dans le cloud. **Sans elle, les données sont inaccessibles.**  
Les données sont sauvegardées automatiquement à chaque modification (délai ~1s).

---

## Maître de Jeu — Première partie

### Créer une campagne

1. Ouvrir le panneau MJ → saisir/générer une clé de sauvegarde
2. Cliquer **+ Nouvelle campagne** → saisir le nom
3. Un **code d'accès** (5 lettres, ex : `X7K2M`) est généré automatiquement
4. **Partager ce code aux joueurs** — ils en auront besoin pour rejoindre la campagne

Le code est affiché en haut de l'écran pendant toute la partie (cliquer pour copier).

### Onglets du panneau MJ

| Onglet | Fonctionnement |
|---|---|
| **Joueurs** | Affiche les joueurs connectés en temps réel avec leurs PV, stats et statut. Bouton ⚔ pour infliger des dégâts, ♥ pour soigner. Bouton 📋 pour voir la fiche complète et activer/désactiver les onglets Cartes et Alchimie par joueur. |
| **Monstres** | Créatures privées (invisibles pour les joueurs). Cliquer une attaque pour lancer les dés en privé. Modifier les PV directement. |
| **Jets** | Historique de tous les jets des joueurs en temps réel. |
| **Jet MJ** | Jets libres du MJ — compétence sur seuil ou jet simple. Résultats visibles uniquement par le MJ. |
| **Cartes** | Paquet de 54 cartes indépendant — tirer pour animer l'overlay. |
| **⚗ Alchimie** | Créer des recettes de potions à la campagne, les accorder aux joueurs. |
| **Fichiers** | Uploader des fichiers (images, PDF…) et les partager avec certains joueurs ou tous. |
| **♪ Musique** | Playlist par campagne — YouTube, Soundcloud ou fichier uploadé. Lecture avec fondu entrant/sortant. |

### Attribuer des dégâts ou des soins

Dans l'onglet **Joueurs**, chaque carte joueur possède :
- Un champ **Dégâts** → saisir la valeur → appuyer sur Entrée ou ⚔
- Un champ **Soins** → saisir la valeur → appuyer sur Entrée ou ♥

Les PV du joueur sont mis à jour instantanément et une animation s'affiche dans l'overlay.

### Karma

Chaque joueur dispose d'un compteur de Karma (−/+) dans sa carte.  
Il modifie le Bonus/Malus automatiquement lors de ses jets.

---

## Joueur — Première partie

### Créer un personnage

1. Ouvrir le panneau Joueur → saisir/générer une clé de sauvegarde
2. Cliquer **+ Nouveau personnage**
3. Saisir nom, classe, et le **code campagne** fourni par le MJ (ex : `X7K2M`)
4. Cliquer **Créer**

### Onglets du panneau Joueur

| Onglet | Fonctionnement |
|---|---|
| **Compétences** | Cliquer une compétence pour lancer le d100. Le résultat (Succès/Échec/Critique) s'affiche et est envoyé au MJ et à l'overlay. |
| **Caractéristiques** | Choisir un multiplicateur (×1 à ×5) puis cliquer une stat pour lancer. |
| **Jet libre** | Saisir un nom et un seuil manuel, puis lancer. Utile pour les jets non listés. |
| **Inventaire** | Gérer l'inventaire et les armes. Cliquer une arme pour lancer les dégâts. |
| **Notes** | Bloc-notes multi-onglets personnel par personnage. |
| **Cartes** | Paquet de 54 cartes — piocher envoie la carte à l'overlay *(activé par le MJ)*. |
| **⚗ Alchimie** | Créer des potions à partir de recettes accordées par le MJ *(activé par le MJ)*. |
| **Fichiers** | Documents partagés par le MJ — lecture directement dans l'appli. |
| **📹 Caméras** | Visionner les caméras des autres joueurs et du MJ *(visible quand les caméras sont actives)*. |
| **Personnage** | Éditer la fiche complète : stats, armes, protection, compétences, spéciaux, historique. |

### Barre Bonus/Malus

Barre persistante en haut du contenu, visible depuis tous les onglets.  
Boutons `+10` / `+20` / `+30` / `−10` / `−20` / `−30`, saisie manuelle, et **Réinitialiser**.  
Le modificateur s'applique automatiquement à tous les jets d100.

### Combat (sidebar)

La sidebar de combat apparaît automatiquement si le personnage a des compétences de combat :
- **⚔ Attaquer** : cliquer une arme pour lancer les dégâts (dé selon la formule de l'arme)
- **🛡 Parade** : jet sous **Combat rapproché** — bloque l'attaque, peut encore attaquer ce tour
- **⚡ Esquive** : jet sous **Esquiver** — abandonne toutes les attaques du tour (−20% si attaque à distance)

---

## Overlay OBS — Configuration

### Ajouter l'overlay dans OBS

1. OBS → **Sources** → `+` → **Source navigateur**
2. Coller l'URL selon le mode souhaité :

```
# Overlay joueur (suit un joueur spécifique)
https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=player&ably=VOTRE_CLE_ABLY

# Overlay MJ (affiche le retour MJ avec "En attente...")
https://mathieu-chateigner.github.io/Aria/views/aria-overlay.html?mode=gm&ably=VOTRE_CLE_ABLY
```

3. Largeur : **1920** — Hauteur : **1080** — cocher **Fond transparent**

L'overlay s'active automatiquement lors des jets de dés, pioches de cartes, dégâts et soins.

### Éditeur d'overlay (widgets personnalisables)

L'overlay peut afficher des widgets permanents (barres de PV, stats, liste de monstres…) positionnés librement sur l'écran.

1. Ouvrir le panneau Joueur ou MJ → cliquer le bouton **📐 Overlay** en haut à droite
2. L'éditeur s'ouvre dans un nouvel onglet
3. **Palette gauche** → glisser-déposer un widget sur le canvas, ou cliquer pour l'ajouter
4. **Cliquer un widget** sur le canvas → ajuster position, taille, opacité dans le panneau droit
5. Les modifications sont **sauvegardées automatiquement** et appliquées en direct à l'overlay OBS

| Catégorie | Widgets disponibles |
|---|---|
| Persistants | Nom/Classe joueur, Barre de PV, Stats, Protection, Compétences, Armes, Inventaire, Potions, Texte libre, Résumé PV joueurs, Monstres, Historique jets, Caméra VDO.ninja |
| Événements | Carte de jet, Carte piochée, Dégâts, Soins, Barre PV animée, Écran MORT |

---

## Caméras (VDO.ninja) — Optionnel

Permet de voir les caméras de tous les participants directement dans l'appli et dans l'overlay OBS.  
**Aucun compte VDO.ninja n'est nécessaire.**

> Les caméras ne fonctionnent que depuis l'URL GitHub Pages (HTTPS). Pas depuis un fichier local.

### Configuration par le MJ

1. Ouvrir le panneau MJ → ⚙ Configuration
2. Renseigner **VDO.ninja Room** — choisir un nom simple, ex : `ma-campagne` (sans espaces ni caractères spéciaux)
3. Renseigner **Mot de passe VDO** si souhaité (optionnel)
4. Cliquer **Reconnecter**

Le nom de room est diffusé automatiquement aux joueurs connectés.

### Côté joueurs

Aucune configuration manuelle. Dès que le MJ a défini une room :
- La caméra du joueur démarre automatiquement en arrière-plan (le navigateur demandera l'accès à la caméra)
- L'onglet **📹 Caméras** apparaît et affiche toutes les caméras actives

> **Premier lancement :** si la caméra ne démarre pas, visiter [vdo.ninja](https://vdo.ninja) directement dans le même navigateur et accepter la permission caméra.

### Ajouter une caméra dans l'overlay OBS

1. Ouvrir l'éditeur d'overlay (bouton 📐 depuis le panneau MJ)
2. Dans la palette, faire glisser **Caméra joueur** sur le canvas
3. Sélectionner le widget → saisir le **Stream ID** du joueur dans le panneau droit
4. Le Stream ID d'un joueur est : `aria-` + les 8 premiers caractères de son ID de personnage

---

## Dés 3D dddice — Optionnel

Affiche des dés 3D animés dans OBS lors des jets.

1. Créer un compte sur [dddice.com](https://dddice.com)
2. **Account → Developers** → copier l'**API Key**
3. Créer une **Room** → copier le slug
4. Sur la page d'accueil ARIA → **⚙ Configuration** → renseigner la clé API et le slug de room
5. Tous les membres de la session qui utilisent la même room dddice verront les mêmes animations

---

## Règles de jet ARIA

| Résultat | Condition |
|---|---|
| **SUCCÈS CRITIQUE** | Jet ≤ 10 **et** jet ≤ seuil |
| **SUCCÈS** | Jet ≤ seuil |
| **ÉCHEC** | Jet > seuil |
| **ÉCHEC CRITIQUE** | Jet ≥ 91 **et** jet > seuil |

**Calcul du seuil :**
- Compétence : valeur % de la compétence + Bonus/Malus
- Caractéristique : multiplicateur × valeur de la stat + Bonus/Malus
- Jet libre : seuil saisi manuellement

**Soigner** : si un joueur lance la compétence exacte `Soigner`, l'effet se résout automatiquement (succès → soin 1d6, échec → dommages 1d3).

---

## Dépannage

**Pastille Ably rouge** → Vérifier la clé Ably (format `xxxxxxxx:yyyyyyyyyy`, sans espaces). La saisir sur la page d'accueil puis cliquer Sauvegarder.

**Les joueurs n'apparaissent pas chez le MJ** → Vérifier que joueurs et MJ utilisent la **même clé Ably** et que le joueur a renseigné le bon **code campagne** dans son personnage. Les joueurs envoient un signal toutes les 5 secondes — attendre quelques instants après l'ouverture.

**La caméra ne démarre pas** → Visiter [vdo.ninja](https://vdo.ninja) directement dans le navigateur et accepter la permission caméra. L'application doit être ouverte depuis l'URL GitHub Pages (pas un fichier local).

**Les caméras clignotent** → Vérifier que l'application est ouverte depuis l'URL GitHub Pages en HTTPS.

**L'overlay OBS est vide** → Vérifier que `?ably=VOTRE_CLE` est bien présent dans l'URL de la source navigateur.

**Les données ne se sauvegardent pas** → Vérifier que la clé de sauvegarde est bien saisie. En cas de doute, noter la clé affichée dans le panneau puis la ressaisir sur un autre appareil pour vérifier.

**Les dés 3D ne s'affichent pas** → dddice est optionnel. Sans configuration, les jets fonctionnent normalement sans animation.

---

## Pour les développeurs — Auto-hébergement

Si vous souhaitez héberger votre propre instance :

### 1. Créer un projet Supabase

Aller sur [supabase.com](https://supabase.com) → créer un projet → **SQL Editor** → exécuter :

```sql
-- Tables principales
CREATE TABLE saves (
  save_key TEXT PRIMARY KEY, type TEXT,
  player_migrated_at TIMESTAMPTZ, gm_migrated_at TIMESTAMPTZ,
  data JSONB, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE characters (
  id TEXT PRIMARY KEY, save_key TEXT, name TEXT, class TEXT,
  campaign_key TEXT, stats JSONB, physical JSONB, skills JSONB,
  specials JSONB, weapons JSONB, protection JSONB, inventory JSONB,
  potion_recipes JSONB, vials INT DEFAULT 0, updated_at TIMESTAMPTZ
);
CREATE TABLE character_state (
  character_id TEXT PRIMARY KEY, hp INT, cards JSONB, tabs JSONB, updated_at TIMESTAMPTZ
);
CREATE TABLE character_notes (
  id TEXT PRIMARY KEY, character_id TEXT, name TEXT, content TEXT,
  position INT, updated_at TIMESTAMPTZ
);
CREATE TABLE character_files (
  id TEXT PRIMARY KEY, character_id TEXT, file_id TEXT,
  name TEXT, type TEXT, url TEXT, updated_at TIMESTAMPTZ
);
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY, save_key TEXT, name TEXT, join_code TEXT,
  vdo_room TEXT, vdo_room_password TEXT, updated_at TIMESTAMPTZ
);
CREATE TABLE monsters (
  id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, pv INT, max_pv INT,
  armor INT DEFAULT 0, stats JSONB, attacks JSONB, updated_at TIMESTAMPTZ
);
CREATE TABLE campaign_potions (
  id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, description TEXT,
  ingredients JSONB, success_chance INT, updated_at TIMESTAMPTZ
);
CREATE TABLE campaign_files (
  id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, type TEXT,
  url TEXT, path TEXT, granted_to JSONB, updated_at TIMESTAMPTZ
);
CREATE TABLE campaign_known_players (
  id TEXT PRIMARY KEY, campaign_id TEXT, char_id TEXT,
  data JSONB, updated_at TIMESTAMPTZ
);
CREATE TABLE campaign_notes (
  id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, content TEXT,
  position INT, updated_at TIMESTAMPTZ
);
CREATE TABLE campaign_rolls (
  id BIGSERIAL PRIMARY KEY, campaign_id TEXT, skill_name TEXT,
  threshold INT, roll INT, success BOOL, char_name TEXT,
  bonus_malus INT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE campaign_card_history (
  id BIGSERIAL PRIMARY KEY, campaign_id TEXT, card_id TEXT, drawn_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE campaign_music (
  id TEXT PRIMARY KEY, campaign_id TEXT, name TEXT, type TEXT,
  url TEXT, youtube_id TEXT, path TEXT, position INT DEFAULT 0, updated_at TIMESTAMPTZ
);
CREATE TABLE overlay_configs (
  id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT,
  config JSONB, updated_at TIMESTAMPTZ
);

-- Accès anonyme (Row Level Security)
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_potions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_known_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_card_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_music ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon" ON saves FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON characters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON character_state FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON character_notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON character_files FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaigns FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON monsters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_potions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_files FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_known_players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_notes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_rolls FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_card_history FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON campaign_music FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon" ON overlay_configs FOR ALL TO anon USING (true) WITH CHECK (true);

-- Buckets Storage (pour les fichiers MJ et la musique uploadée)
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-files', 'campaign-files', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-music', 'campaign-music', true);
CREATE POLICY "anon files" ON storage.objects FOR ALL TO anon USING (true) WITH CHECK (true);
```

### 2. Renseigner les credentials

Dans `js/aria-supabase.js` :
```js
const SUPABASE_URL      = 'https://votre-projet.supabase.co';
const SUPABASE_ANON_KEY = 'votre-publishable-key';
```

### 3. Héberger

GitHub Pages, Netlify, ou tout hébergement statique — aucun serveur requis.
