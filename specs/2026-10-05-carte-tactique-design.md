# Carte tactique façon Roll20 — design

Date : 2026-10-05
Statut : validé le 2026-10-05 — brouillard global sur les cartes tactiques, éclairage dynamique dans le périmètre. Phase 0 en cours.

## Point de départ

AriaTest a déjà une **carte de monde** (`specs/2026-08-28-carte-points-interet-design.md`,
livrée) : image importée, punaises (POI), jetons posés *sur un POI*
(`positions = { charId: poiId }`), découverte par personnage, zones tracées par le
MJ qui restent noires tant qu'elles ne sont pas découvertes, demandes de
déplacement, widget overlay.

Roll20 est autre chose : un **plateau tactique**. Grille, jetons posés librement
au pixel près, mesure des distances, brouillard qu'on gratte, lumière et lignes de
vue. Cette spec est le **delta** entre les deux, pas une refonte.

## Audit de la carte existante

Lecture du code (`js/aria-gm.js` 3195–3695, `js/aria-player.js` 3025–3160,
`js/aria-overlay.js` 115–170, CSS des quatre feuilles). Audit fait sur le code,
pas sur une partie réelle.

### Bugs — à corriger avant tout ajout

| # | Où | Symptôme | Cause |
|---|---|---|---|
| B1 | `aria-gm.js:3526` → `aria-player.js:2162` | Pendant que le MJ tape une **note privée**, la fiche ouverte de chaque joueur se ferme toutes les 150 ms | Chaque frappe → `saveMaps()` → `publishMapState()`, même quand la projection publique n'a pas changé ; le joueur remet `mapSelectedPoiId = null` à chaque `state` reçu |
| B2 | `aria-gm.js:829` | Le MJ tape dans la fiche d'un POI, un joueur demande à bouger : le champ perd le focus et le texte en cours de frappe saute | Le handler `move-request` appelle `renderMapTab()` sans condition, qui reconstruit la fiche |
| B3 | `renderMapTab()` des deux panneaux | L'image est détruite et recréée à chaque punaise posée/glissée côté MJ, et à **chaque `state`** côté joueur (= à chaque frappe du MJ, cf. B1) : flash et redécodage d'une image qui peut faire 20 Mo | `fill(stage, frame)` reconstruit tout ; l'overlay, lui, garde son `<img>` (`syncMapWidget`) |
| B4 | `.map-poi-card` (`aria-panel.css:655`) | La fiche d'un POI près du bord haut/bas est coupée | Ancrée en `translate(…, -50%)` dans un `.map-stage` en `overflow:auto` ; seul le bord droit est géré (`poi.x > 55`) |
| B5 | `move-request` | Un joueur peut demander un POI qu'il n'a pas découvert (les id des zones noires sont dans `state.fog`) ; le MJ voit alors le vrai nom dans sa file et peut accepter sans y penser | `poiId` n'est pas vérifié contre `visiblePois(state, msg.clientId)` |

### Faiblesses de conception

1. **Pas de zoom ni de déplacement.** L'image est bridée à 100 % du volet : un plan
   de ville Watabou dans un volet à moitié de largeur est illisible, et on ne peut
   pas zoomer pour placer une punaise. C'est la première chose que fait Roll20.
2. **Trois rendus écrits à la main** (MJ, joueur, overlay en chaînes) pour la même
   punaise, le même jeton, la même fiche. Le projet a déjà payé ce motif ailleurs
   (`gm*`, filtres de jets). Le MJ et le joueur peuvent partager un seul
   constructeur dans `aria-shared.js` ; l'overlay reste à part (pas de `el()`).
3. **`prompt()` pour créer une carte, un POI, renommer.** Boîte grise du navigateur
   au milieu de la charte, et un clic sur le fond crée un POI : un clic de trop
   en pleine partie ouvre une boîte de dialogue.
4. **L'image est envoyée brute** (jusqu'à 20 Mo) à chaque joueur et à OBS. Un
   redimensionnement à l'upload (canvas → WebP, côté long ≤ 4096 px) la divise
   par 10 sans perte visible, sans dépendance.
5. **Brouillard plat.** Un polygone noir à bords nets sur une carte sépia : on voit
   le découpage, ça fait trou dans l'image. Un flou SVG (`feGaussianBlur` sur un
   `<mask>`) + le grain déjà présent donnent une brume — c'est la même
   géométrie.
6. **Jetons = pastilles de texte.** Lisible, mais rien ne les distingue d'une
   étiquette. Roll20 : disque, portrait, liseré de couleur. Le portrait existe
   déjà (`physical.portrait`, Fiche).
7. **`activeMapId` n'est que local** : le MJ sur un second appareil montre une
   autre carte à la table sans le savoir.
8. **L'overlay a gardé l'ancienne palette** (`#c9a84c` codé en dur,
   `aria-overlay.css:1058`) alors que la refonte est passée à braise/violet.

## Charte visuelle

La référence est la **charte des écrans terminés** — Connexion, Hub, Accueil,
Fiche, Journal — telle que la fixent `design_handoff_aria/README.md` (*Design
tokens*) et `css/aria-tokens.css`. **Pas l'écran Table** : sa maquette
(`Aria Table.dc.html`) est en pause et n'est pas la version terminée. Elle sert
au plus d'indication ; rien n'en est repris au pixel, et rien dans ce plan ne doit
dépendre de choix qui y restent ouverts.

Règles de la charte qui s'appliquent à la carte :
- **Polices** : Cormorant Garamond pour les noms (carte, lieux, personnages) ;
  Archivo pour l'interface ; mono majuscules espacées (≈ .12–.2em, 10–12 px)
  pour les libellés, chiffres, distances.
- **Couleurs** : encre froide (`--ink-*`) relevée de braise (`--ember`) ;
  `--violet` = l'arcane et le MJ ; états `--ok` / `--warn` / `--bad`. Toujours
  des tokens, jamais d'hexadécimal dans les feuilles de la carte.
- **Traits** : filets 1 px `--line` (`.10–.25`), rayons 2–6 px, pastilles en
  rayon plein.
- **Profondeur** : ombres sombres et profondes (`--shadow-float`) sur ce qui
  flotte, voiles `--scrim*`.
- **Pas de police d'icônes** : les glyphes sont des caractères (←, ▸, ★, ×, −).
- **Mouvement** : figé sous `prefers-reduced-motion`.

**La carte actuelle n'est pas dans la charte**, et ce n'est pas qu'une question de
goût :
- **Cinzel** (`.map-pin-label`, `.map-title`, `.map-poi-title`, `.map-drawer`,
  `.ow-map-label`) n'est plus chargée : `aria-fonts.css` ne contient
  qu'Archivo et Cormorant. Ces libellés tombent sur la serif par défaut du
  navigateur.
- L'habillage est **chaud** (`sepia(.45)`, vignettage `rgba(9,8,4,…)`) alors que
  la charte est une encre **froide** (`--ink-0 #030405`) relevée de braise.
- L'overlay a gardé l'ancien or (`#c9a84c` codé en dur).
- La fiche de lieu est une boîte `--bg2` à petite ombre, pas une surface
  flottante de la charte.

### Proposition de rendu, dans la charte

À valider sur un premier rendu — ce sont des propositions, pas des valeurs
arrêtées.

| élément | proposition |
|---|---|
| Fond hors image | dégradé radial d'encre (`--ink-3` → `--ink-0`) |
| Image importée | habillage froid : `saturate(.7) brightness(.85) contrast(1.05)`, vignettage vers `--ink-0`, grain conservé |
| Nom de carte | Cormorant 600, `--warm`, en haut à gauche ; dessous un kicker mono `--dim` qui dit le mode (« Vue table », « Brouillard actif ») |
| Nom de lieu | Cormorant 600, `--text-5`, ombre portée sombre pour rester lisible sur n'importe quelle image |
| Zone découverte | filet `--line`, fond à peine teinté de l'accent du panneau |
| Secret (MJ seul) | `--violet` en **pointillé** — le pointillé distingue le secret dans le panneau MJ, dont l'accent est déjà violet |
| Brouillard joueur | `--ink-0` presque opaque, bords adoucis (`feGaussianBlur`), pas un aplat à bord net |
| Jeton | disque à initiale Cormorant ; anneau `--ember` (joueur) / `--bad` (monstre) / `--faint-2` (mort) ; halo braise sur mon jeton |
| Barre de PV | fine, sous le jeton : `--ok` / `--warn` / `--bad`, vide `--hp-empty` |
| Zoom | boutons carrés `+` / `−`, filet `--line`, fond `--scrim-strong` |
| Fiche de lieu | surface `--ink-3`, filet `--line`, `--shadow-float`, titre Cormorant, libellés mono majuscules |
| Règle, distances | trait pointillé de l'accent, bulle mono « 3 cases · 4,5 m » |

Accent par panneau inchangé : `--gold` = braise côté joueur, violet côté MJ.

### Ce qui reste ouvert avec la Table

L'écran Table n'est pas tranché : la carte y sera-t-elle un onglet, le fond de
l'écran, autre chose ? Le plan n'en dépend pas. Une seule précaution, qui ne
coûte rien : le rendu partagé de la phase 0 (`mapView(container, …)`) ne suppose
rien de son conteneur, pour pouvoir changer de place le jour où la Table sera
décidée.

## Ce que fait Roll20, et où en est AriaTest

| Roll20 | Ce que c'est | AriaTest aujourd'hui | Verdict |
|---|---|---|---|
| **Pages** + barre de pages, ruban joueurs | Plusieurs cartes, le MJ choisit laquelle la table voit | Barre de cartes (`_renderGroupBar('map')`), `activeMapId` | **Existe** |
| **Calque Carte** | Image de fond, non déplaçable par erreur | Image importée + habillage CSS | **Existe** |
| **Grille** | Carrée/hexa, taille de case, échelle (« 1 case = 1,5 m »), magnétisme | — | **Nouveau** (phase 1) |
| **Calque Jetons** | Jetons libres, glissés par leur propriétaire | Jetons collés à un POI | **Nouveau** (phase 2) |
| Barres de jeton (3), nom | PV sur le jeton | PV déjà dans la présence | **Adapter** : barre PV lue dans la présence, pas stockée sur le jeton |
| Marqueurs d'état | Icônes (à terre, empoisonné…) | — | **Nouveau, petit** (phase 2) |
| Auras (2) | Cercle coloré autour du jeton | — | Plus tard |
| Déplacement mesuré | Distance affichée pendant le glisser, points de passage | Demande de déplacement validée par le MJ | **Adapter** (phase 2) |
| **Règle** | Mesure visible par tous | — | **Nouveau** (phase 3) |
| **Ping** | Clic long = onde visible par tous ; Maj = recentre tout le monde | — | **Nouveau** (phase 3) |
| **Calque MJ** | Jetons/notes visibles du MJ seul | `gmNote` des POI | **Adapter** : drapeau `hidden` sur un jeton |
| **Fog of War** manuel | Le MJ révèle/cache au rectangle, polygone, pinceau ; il voit à travers | Zones par POI, polygones | **Adapter** (phase 4) : réutiliser `_mapZoneLayer` |
| **Dynamic Lighting** | Murs, portes, fenêtres, murs à sens unique ; vision et lumières à rayon | — | **Nouveau** (phase 5) |
| **Explorer Mode** | Ce qu'un jeton a vu reste révélé, en gris/sépia | Découverte par POI (même idée, au lieu près) | **Nouveau** (phase 5) |
| Daylight | Toute la carte éclairée | — | Va avec la phase 5 |
| Dessin libre, texte, gabarits de zone d'effet | Annoter la carte | — | Hors périmètre (sauf question 2) |
| Turn tracker | Ordre d'initiative | — | **À vérifier** : les règles ARIA ont-elles une initiative ? (`Docs/Aide aux combats.pdf`) |
| Calque premier plan, jukebox, tables aléatoires | — | Musique existe ailleurs | Hors périmètre |

De Roll20 on reprend les **gestes**, pas le look : le rendu suit la section
*Charte visuelle*. En complément :
- marqueurs d'état : glyphes texte (la charte n'a pas de police d'icônes), 10 px,
  en couronne ;
- zone explorée mais hors de vue (phase 5) : `grayscale(1) brightness(.55)`,
  froid comme le reste — pas le sépia de Roll20 ;
- règle et déplacement : trait pointillé `--ember` (violet pour le MJ), bulle mono
  10 px « 3 cases · 4,5 m » ;
- ping : onde `--ember` / `--violet` selon l'auteur, 1,2 s, figée sous
  `prefers-reduced-motion`.

## Décisions

1. **Un champ `kind` sur la carte : `monde` (l'existant) ou `tactique`.** Une carte
   tactique réutilise tout le tuyau — `ENT.map`, upload d'image, `_mapFrame`, la
   barre de cartes, le canal `aria-map`, `buildMapState()` seul constructeur du
   payload, `state` qui remplace sans jamais patcher. On ne greffe pas les jetons
   libres sur le modèle POI : `positions = { charId: poiId }` est un autre modèle,
   et le forcer à porter des coordonnées casserait la carte de monde qui marche.
   Les deux sortes vivent dans la même table (`kind`, `grid`, `tokens`, `fog` en
   jsonb, une ligne dans `ENT` chacun).

2. **Coordonnées en pixels de l'image, plus en pourcentages.** Le calque SVG actuel
   est en `viewBox 0 0 100 100` avec `preserveAspectRatio="none"` : sur une image
   non carrée, une case carrée, un rayon de vision ou une distance seraient
   étirés. On enregistre `naturalWidth/naturalHeight` à l'upload, la carte
   tactique a un `viewBox 0 0 W H` et toutes les distances se calculent en
   pixels puis en cases. La carte de monde garde ses pourcentages.

3. **Le MJ reste la seule source de vérité, et le seul à publier `state`.** Un
   joueur qui lâche son jeton publie une intention `token-move { tokenId, x, y }` ;
   le MJ vérifie que `msg.clientId` contrôle ce jeton (jamais un `charId` du
   payload, cf. *Ably tokens*) et republie. Deux modes, au choix du MJ par carte :
   **libre** (accepté automatiquement — c'est Roll20) ou **sur validation**
   (la file `⚑` existante). En mode libre l'aller-retour coûte ~100 ms ; le jeton
   bouge localement tout de suite et se recale sur le `state` suivant.

4. **Les jetons référencent, ils ne copient pas.** `token = { id, ref, x, y,
   size, hidden, markers }`, où `ref` est un `charId` ou un `monsterId` existant.
   Les PV d'un joueur viennent de la présence, ceux d'un monstre de `gmMonsters`
   (déjà publiés en `monster-state`). Aucune nouvelle entité, aucune barre
   stockée deux fois.

5. **Le brouillard manuel est la version Roll20 de nos zones.** Le MJ révèle au
   rectangle ou au polygone ; il voit à travers. Techniquement c'est le même
   `<polygon>` que `_mapZoneLayer`, inversé : sur une carte tactique **tout est
   noir sauf ce qui est révélé** (`fog.revealed: [[x,y]…][]`), via un `<mask>`.
   C'est précisément le brouillard global que la décision 11 de la spec
   précédente avait écarté — voir question 1.

6. **Le payload doit tenir sous 16 Ko.** C'est la taille maximale d'un message
   Ably sur l'offre gratuite. Une carte avec murs et zones explorées la dépasse
   vite. Règle : **ce qui ne change pas en partie ne passe pas par Ably.** La
   géométrie statique (murs, portes fermées par défaut, grille) est écrite par le
   MJ en JSON dans le bucket public `campaign-files/maps/{mapId}.json`, et `state`
   n'en porte que l'URL + une version. Le dynamique (jetons, portes ouvertes,
   brouillard révélé) reste dans `state`. Un garde dans `publishMapState()`
   mesure la taille et prévient le MJ au lieu d'échouer en silence.

7. **Les règles de visibilité vivent à un seul endroit**, `aria-supabase.js`, à
   côté de `visiblePois()` / `fogZones()` : `visibleTokens(state, charId)`
   (retire les `hidden`, et en phase 5 ceux hors de vue). Couvertes par
   `aria-shared.selfcheck.js`. L'overlay a son propre rendu en chaînes
   (`_owZones`) : chaque changement de brouillard doit y atterrir aussi — c'est
   écrit dans chaque phase pour ne pas l'oublier.

8. **Comme aujourd'hui, le brouillard est un confort, pas une frontière.** Un seul
   `state` pour toute la table : un joueur avec les outils de développement voit
   les jetons cachés et la carte entière. Pour une vraie frontière il faudrait un
   `state` par personnage, filtré par le MJ — même modèle, N publications. Pas
   pour maintenant.

## Données

```js
// ENT.map — colonnes en plus (jsonb / text), une ligne chacune dans ENT
kind:   'monde' | 'tactique'                 // défaut 'monde' : rien ne change pour l'existant
size:   { w, h }                             // naturalWidth/Height de l'image
grid:   { type: 'carre', cell: 70, ox: 0, oy: 0, unit: 'm', per: 1.5, snap: true, show: true }
tokens: [{ id, ref, x, y, size: 1, hidden: false, markers: [] }]
fog:    { on: true, revealed: [[[x,y],…], …] }    // polygones en pixels
moves:  'libre' | 'validation'
walls:  { url, v }                           // phase 5, géométrie dans Storage
```

```sql
-- AriaTest uniquement (--project-ref qpxaaauzzbahsdhsjaqn)
alter table campaign_maps
  add column kind text default 'monde', add column size jsonb, add column grid jsonb,
  add column tokens jsonb, add column fog jsonb, add column moves text default 'libre',
  add column walls jsonb;
```

`state` d'une carte tactique :

```js
{ mapId, kind: 'tactique', name, imageUrl, size, grid, moves,
  tokens: [{ id, ref, x, y, size, markers, name, own }],   // `own` = charId contrôleur, hidden retirés
  fog: { on, revealed }, walls: { url, v }, players: { charId: name } }
```

## Protocole (canal `aria-map-{CODE}`, déjà autorisé dans `ably-token`)

| message | sens | charge |
|---|---|---|
| `state` | MJ → tous | ci-dessus |
| `request` | joueur / overlay → MJ | `{}` (existe) |
| `token-move` | joueur → MJ | `{ tokenId, x, y }` — accepté si `msg.clientId` contrôle le jeton |
| `move-denied` | MJ → joueur | `{ tokenId }` (existe, généralisé) |
| `ping` | tous → tous | `{ x, y, focus }` — `focus` réservé au MJ (`ablyFromGM`) |
| `ruler` | tous → tous | `{ pts: [[x,y]…] }` ou `null` pour effacer — éphémère, jamais stocké |

`ping` et `ruler` ne touchent pas l'état : volatils, pas de persistance, pas de
`state`. Vérifier que le jeton `ably-token` laisse les joueurs publier sur
`aria-map` (ligne 98 : `PS`, oui) ; l'overlay reste limité à `request`.

## Phases

Chaque phase est jouable seule. **Ligne de coupe : après la phase 4, c'est déjà
Roll20 sans l'éclairage dynamique**, ce qui couvre l'essentiel d'une partie.

**Phase 0 — Remettre l'existant d'aplomb** (≈ 1 jour). *Codée le 2026-10-05 ; reste la vérification dans les vrais panneaux (session requise). Non fait : `size` (dimensions de l'image) n'est pas encore stocké, il arrive avec les colonnes de la phase 1.* Rien de nouveau pour le
joueur, mais tout le reste s'appuie dessus.
- B1 : `publishMapState()` compare la projection à la précédente
  (`JSON.stringify`, comme `_lastMapPlayerNames`) et ne publie que si elle a
  changé ; le joueur ne ferme sa fiche que si le POI sélectionné a disparu.
- B2/B3 : un seul rendu partagé `mapView(container, { img, zones, pins, card })`
  dans `aria-shared.js`, qui garde l'`<img>` (garde `setFrameSrc`) et passe les
  punaises par `reconcile()`. `renderMapTab()` du MJ et du joueur l'appellent ;
  le handler `move-request` ne touche plus que le badge.
- B4 : la fiche se place hors du cadre de la carte (`position: fixed` calculée
  depuis la punaise) et se retourne en haut/bas comme à gauche/droite.
- B5 : `move-request` refusé si `poiId` n'est pas dans
  `visiblePois(buildMapState(), msg.clientId)`.
- Zoom molette + déplacement clic-glisser (une `transform` sur le cadre, les
  coordonnées en % restent justes), bouton « Ajuster ». Pour les deux sortes de
  carte.
- Image redimensionnée à l'upload (WebP, ≤ 4096 px).
- `prompt()` remplacés par une saisie inline dans la barre / la fiche ; créer un
  POI demande un outil « Punaise » armé, plus un clic nu sur le fond.
- **Mise en charte** (section *Charte visuelle*) : Cinzel → Cormorant / Archivo /
  mono, habillage froid, nom de carte, boutons de zoom, fiche en surface
  flottante, jetons en disque à initiale, brouillard aux bords adoucis, violet
  pointillé pour le secret, dans les trois rendus (MJ, joueur, overlay).
  L'overlay ne charge pas `aria-tokens.css` mais en recopie une partie dans son
  `:root` (`aria-overlay.css:6`) : y ajouter les tokens de carte, et retirer
  `#c9a84c`.
- Contrôle : comparer la carte à la Fiche ou au Journal ouverts à côté — mêmes
  polices, même encre, mêmes filets, même accent. Premier rendu montré à
  l'utilisateur avant de passer à la phase 1.

**Phase 1 — Carte tactique et grille** (≈ 1 jour). *Codée le 2026-10-05 : bascule Monde / Tactique qui convertit les coordonnées (aller-retour exact), `size` lu à l'import, grille SVG, réglages (case, décalage, échelle, visible, magnétisme), « Caler sur une case » par deux clics, lieux aimantés au centre des cases, punaises de taille constante au zoom. Joueur et overlay reçoivent `kind`/`size`/`grid` et dessinent la grille. Colonnes : `specs/campaign_maps_tactique.sql` (appliqué sur AriaTest, pas sur la prod).* `kind`, `size` à l'upload,
`viewBox` en pixels, grille SVG (`<pattern>`, donc gratuite à n'importe quel
zoom), réglages de grille dans la barre d'outils (taille de case, décalage pour
caler sur une grille dessinée dans l'image, échelle). Le zoom vient de la
phase 0. MJ seulement, rien sur Ably.
*Vérif* : une case de 70 px reste carrée dans un volet étroit.

**Phase 2 — Jetons libres** (≈ 2 jours). *Codée le 2026-10-05 : jetons qui référencent un personnage ou un monstre (nom et PV relus à chaque rendu), « ＋ Jeton » puis clic, glisser avec magnétisme (×1 au centre d'une case, ×2 sur une intersection) et règle « 5 cases · 7,5 m », fiche (taille 1–4, caché, six états), monstres posés cachés par défaut, déplacements libres ou sur validation (`token-move` validé sur `msg.clientId`, file `⚑`), vue joueur et overlay. Non testé de bout en bout sur Ably (session requise).* Jetons depuis les joueurs (présence) et
les monstres (`gmMonsters`), glisser avec magnétisme et distance affichée,
taille 1/2/3 cases, `hidden` (calque MJ), marqueurs d'état (liste fixe de 6
icônes en caractères, pas d'images). `token-move`, modes libre/validation,
rendu joueur, widget overlay (`syncMapWidget` gère `kind`). PV en barre fine.
`visibleTokens()` + selfcheck.
*Vérif* : un joueur ne peut pas bouger le jeton d'un autre en forgeant
`tokenId` ; un jeton `hidden` n'est ni dans le panneau joueur ni sur l'overlay.

**Phase 3 — Règle et ping** (≈ ½ jour). Clic droit-glisser = règle, partagée en
direct ; clic long = ping (onde CSS), Maj + clic long côté MJ = recentre tous les
écrans. Rien de persistant.

**Phase 4 — Brouillard manuel** (≈ 1 jour). Outils MJ : révéler/cacher au
rectangle et au polygone (l'éditeur de tracé de zones existe déjà —
`_zoneEditLayer`, `_zoneDragVertex` — on le réutilise). `<mask>` SVG dans les
trois rendus, MJ translucide / joueur opaque, overlay via `_owZones`. Bouton
« Tout révéler / Tout cacher ». Garde de taille 16 Ko.
*Vérif* : selfcheck — un jeton dans une zone non révélée n'est pas dans
`visibleTokens()` d'un joueur.

**Phase 5 — Murs, portes, vision, mode Explorateur** (≈ 4–6 jours,
le plus gros morceau). Murs et portes tracés par le MJ, stockés dans Storage
(décision 6). Vision par jeton joueur = polygone de visibilité (lancer de rayons
vers les extrémités des murs, ~80 lignes de JS pur, testable en selfcheck).
Explorateur = union des polygones vus, mémorisée par personnage, rendue
désaturée. Coûts réels : le calcul tourne dans trois rendus dont un en chaînes,
et la mémoire d'exploration grossit le payload — elle irait dans Storage aussi.
Engagée (décision de l'utilisateur), après les phases 1–4.

## Vérification

Logique pure, dans `js/aria-shared.selfcheck.js` :
0. (phase 0) B5 repose sur `visiblePois()`, déjà couvert (un POI non découvert n'est pas
   dans la vue du joueur). La déduplication de `publishMapState()` et le rendu partagé
   ne sont pas de la logique pure : vérifiés à la main sur une page de test (zoom autour
   du curseur, panoramique sans clic parasite, image non recréée, fiche hors du bloc de
   la punaise), puis dans les panneaux.
1. `visibleTokens()` retire les jetons `hidden` pour un joueur, les garde pour le MJ.
2. Un `tokens` non-tableau (payload forgé) ne lève pas d'exception.
3. Conversion pixels → cases → mètres (case 70 px, 1,5 m) : 210 px = 3 cases = 4,5 m.
4. Magnétisme : un jeton lâché à 100 px se cale au centre de la case 2.
5. (phase 4) Un jeton hors de toute zone révélée est absent de la vue joueur.
6. (phase 5) Polygone de visibilité : un mur entre A et B cache B.

`specs/ably_token.check.py` : ajouter l'attaque « `token-move` sur le jeton d'un
autre » — elle doit être refusée par le MJ, pas seulement masquée.

## Décisions de l'utilisateur (2026-10-05)

1. **Brouillard global sur les cartes tactiques : oui.** Tout est noir par défaut,
   le MJ révèle. Les cartes de monde gardent leurs zones par POI.
2. **Éclairage dynamique : dans le périmètre**, plus optionnel. Il reste en phase 5
   parce qu'il dépend des jetons libres et des coordonnées en pixels (phases 1–2) ;
   « maintenant » veut dire engagé, pas avant la grille. Conséquence pour la
   phase 0 : le rendu partagé reçoit son espace de coordonnées (`viewBox` W×H,
   100×100 par défaut) au lieu de le coder en dur.

Reste ouvert : initiative / turn tracker, seulement si les règles ARIA en ont une.

## Hors périmètre

Dessin libre et texte sur la carte, gabarits de zone d'effet, grille hexagonale,
calque premier plan, lumières colorées, jetons animés, cartes multi-niveaux,
vraie frontière de sécurité par personnage (décision 8).
