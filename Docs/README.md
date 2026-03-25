# ♛ ARIA — Système d'overlay TTRPG

Système de gestion de partie TTRPG pour OBS, composé de trois fichiers HTML autonomes.
Aucune installation de serveur requise — tout fonctionne dans le navigateur.

---

## 📁 Fichiers inclus

| Fichier | Rôle | Où l'ouvrir |
|---|---|---|
| `aria-player.html` | Panneau joueur (fiche, dés, cartes) | Navigateur sur le PC du joueur |
| `aria-gm.html` | Panneau Maître de Jeu | Navigateur sur le PC du MJ |
| `aria-overlay.html` | Overlay OBS (résultats de jets, cartes, dégâts) | Source navigateur dans OBS |

---

## 🔧 Prérequis — Comptes à créer (gratuits)

### 1. Ably — Synchronisation en temps réel
> Permet aux panneaux joueur/MJ de communiquer entre eux.

1. Aller sur [ably.com](https://ably.com) → **Sign up** (gratuit)
2. Créer une **App** (nom au choix)
3. Dans l'app → onglet **API Keys**
4. Copier la clé **Root** (format `xxxxxxxx.yyyyyy:zzzzzzzzzzzz`)
5. **Tout le monde utilise la même clé Ably** — joueurs ET MJ

### 2. dddice — Dés 3D dans OBS *(optionnel)*
> Affiche des dés 3D animés dans la room partagée visible dans OBS.

1. Aller sur [dddice.com](https://dddice.com) → créer un compte
2. **Account → Developers** → copier votre **API Key**
3. Créer ou rejoindre une **Room** → copier le slug (ex: `ma-salle-aria`)
4. Ajouter des thèmes de dés via **Dice Box** sur le site dddice

---

## 🚀 Installation & lancement

### Étape 1 — Placer les fichiers
Mettez les trois fichiers HTML dans le **même dossier** sur votre PC.
> ⚠️ Ils doivent être dans le même répertoire pour que les liens entre eux fonctionnent.

### Étape 2 — Configurer le panneau joueur
1. Ouvrir `aria-player.html` dans votre navigateur
2. Cliquer sur **⚙** (engrenage) en haut à droite
3. Renseigner :
   - **Clé API dddice** *(optionnel)*
   - **Room dddice** *(optionnel)*
   - **Clé Ably** ← obligatoire pour la sync
4. Cliquer **Sauvegarder & Connecter**
5. Les pastilles vertes confirment la connexion

### Étape 3 — Configurer le panneau MJ
1. Ouvrir `aria-gm.html` dans le navigateur du MJ
2. Cliquer sur **⚙**
3. Renseigner la **même clé Ably** que les joueurs
4. Cliquer **Sauvegarder & Connecter**

### Étape 4 — Configurer l'overlay OBS

#### Overlay joueur (POV joueur)
Dans OBS → **Sources → Ajouter → Source navigateur**
- URL : `file:///CHEMIN/VERS/aria-overlay.html?mode=player&ably=VOTRE_CLE_ABLY`
- Largeur : `1920` — Hauteur : `1080`
- ✅ Contrôler l'audio via OBS : non

#### Overlay MJ
Dans OBS du MJ → **Sources → Ajouter → Source navigateur**
- URL : `file:///CHEMIN/VERS/aria-overlay.html?mode=gm&ably=VOTRE_CLE_ABLY`
- Largeur : `1920` — Hauteur : `1080`

> **Exemple de chemin Windows :**
> `file:///C:/Users/VotreNom/ARIA/aria-overlay.html?mode=player&ably=abc123:xyz456`
>
> **Exemple de chemin Mac/Linux :**
> `file:///home/votrenom/aria/aria-overlay.html?mode=player&ably=abc123:xyz456`

---

## 🎮 Utilisation en partie

### Joueur
- **Compétences** : cliquer une compétence pour lancer le d100
- **Caractéristiques** : choisir le multiplicateur (×1 à ×5) puis cliquer la stat
- **Jet libre** : nom + seuil manuel → Lancer
- **Cartes** : cliquer le dos du paquet pour piocher
- **Personnage** : éditer la fiche, sauvegarder avec le bouton en bas
- **Bonus/Malus** : barre persistante en haut — s'applique à tous les jets

### MJ
- **Joueurs** : les cartes apparaissent automatiquement quand un joueur ouvre son panneau
  - ⚔ = infliger des dégâts (transmis au joueur en temps réel)
  - ♥ = soigner (transmis au joueur en temps réel)
- **Monstres** : créer des créatures privées (non visibles par les joueurs)
  - Cliquer une attaque dans la fiche monstre = jet automatique
- **Jets** : fil en direct de tous les jets des joueurs
- **Jet MJ** : jets privés (libres ou pour un monstre spécifique)
- **Cartes** : paquet indépendant de celui des joueurs

### Overlay OBS
- S'affiche automatiquement lors de chaque jet, pioche de carte ou événement de dégâts
- Mode `player` : résultats des jets + cartes + animations de dégâts
- Mode `gm` : couronne animée en attente + mêmes événements

---

## 🎲 Système de règles ARIA

| Résultat | Condition |
|---|---|
| **SUCCÈS CRITIQUE** | Jet ≤ 10 ET dans le seuil |
| **SUCCÈS** | Jet ≤ seuil |
| **ÉCHEC** | Jet > seuil |
| **ÉCHEC CRITIQUE** | Jet ≥ 91 ET hors seuil |

**Calcul du seuil :**
- Compétence : valeur % directe (ex: Perception 70%)
- Caractéristique : `multiplicateur × stat + Bonus/Malus` (ex: 3 × DEX 10 = 30%)
- Jet libre : seuil saisi manuellement

---

## 🔁 Flux de données (Ably)

```
aria-player.html
    │── canal aria-rolls   ──▶ MJ voit le jet  +  autres joueurs voient un toast
    │── canal aria-cards   ──▶ overlay reçoit la carte piochée
    └── canal aria-damage  ──▶ heartbeat de présence vers le MJ

aria-gm.html
    └── canal aria-damage  ──▶ dégâts/soins envoyés au joueur ciblé

aria-overlay.html
    ├── reçoit aria-rolls  ──▶ affiche le résultat du jet après 3s
    ├── reçoit aria-cards  ──▶ affiche la carte piochée
    └── reçoit aria-damage ──▶ animations de dégâts / soins
```

---

## ❓ Dépannage

**Pastille Ably rouge** → Vérifier la clé Ably (copier-coller sans espaces)

**Les joueurs n'apparaissent pas dans le panneau MJ** → Vérifier que la même clé Ably est utilisée partout. Les joueurs envoient un heartbeat toutes les 15 secondes — attendre 15s après ouverture du panneau joueur.

**Les dés 3D ne s'affichent pas** → dddice est optionnel. Sans clé dddice, les jets fonctionnent normalement (résultat aléatoire local, sans animation 3D).

**L'overlay OBS est blanc/vide** → Vérifier le chemin du fichier et que le paramètre `?ably=` est bien renseigné dans l'URL OBS.

**Les dégâts ne s'affichent pas sur l'overlay joueur** → L'overlay reçoit les événements du canal `aria-damage`. Vérifier que la clé Ably dans l'URL de l'overlay est identique à celle du panneau MJ.

---

## 📝 Notes

- Toutes les données (personnage, config, cartes) sont sauvegardées en **localStorage** dans le navigateur — elles persistent entre les sessions.
- Les monstres du MJ sont sauvegardés localement et **ne sont jamais transmis** aux joueurs.
- Le panneau joueur et le panneau MJ ont chacun leur **paquet de cartes indépendant**.
- Testé sur Chrome et Firefox. Recommandé : **Chrome** pour les sources navigateur OBS.
