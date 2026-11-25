# Vue de jeu — design

Date : 2026-11-25
Statut : validé le 2026-11-25 (4 tours de questions). Maquettes :
canvas « Aria — Vue de jeu » (claude.ai/artifact/NaixJ7zEnsdz8DDhz1fAmo), 5 planches joueur, 2 planches MJ.

## Point de départ

Tout le site est passé à la nouvelle charte (`css/aria-tokens.css`) sauf l'écran où l'on
joue : `views/aria-player.html` et `views/aria-gm.html` gardent les onglets et le moteur
de volets de l'ancienne interface. Une première refonte proposée a été rejetée.

Le sujet principal de l'écran est **la carte tactique**
(`specs/2026-10-05-carte-tactique-design.md`), à côté des **caméras** de la table. Tout
le reste se range autour. Cette spec tranche la question laissée ouverte dans la spec de
la carte (*Ce qui reste ouvert avec la Table*) : la carte est le centre de l'écran.

## Cadre commun (joueur et MJ)

Même squelette des deux côtés, accent braise côté joueur, violet côté MJ.

| zone | taille | contenu |
|---|---|---|
| Barre du haut | 48 px | retour Taverne, ARIA, nom de campagne / personnage, code, réglages ; MJ : mini-lecteur musique, compteur ⚑ ; joueur : volume + titre de la piste (masqué tant que rien ne joue — remplace `#music-bar`) |
| Rail de sections | 60 px, à gauche | une entrée par section ; un clic ouvre son tiroir |
| Centre | le reste | la carte ; sans carte, la grille des caméras |
| Colonne caméras | 300 px, à droite | tuile MJ en grand + tuiles joueurs en 2×2 ; en bas : fil (Table / Messages côté joueur, Jets / Messages côté MJ) |
| Barre du bas | 108 px | joueur : sa carte de personnage, compétences épinglées, dés ; MJ : le jeton sélectionné, dés + Jet MJ |

### Tiroirs

- Un tiroir s'ouvre **par-dessus la carte**, à gauche, contre le rail (≈ 400 px).
- **Un seul à la fois.** Recliquer l'entrée du rail ou `Échap` le ferme. Il garde sa
  position de défilement.
- Tiroir ouvert : les caméras se replient en colonne de portraits ronds (PV + bouton
  « Fil » avec pastille de non-lu) pour rendre de la place à la carte.

### Fin du moteur de volets

Le moteur de volets partagé (`applyTabLayout`, `finishTabLayout`, `aria-split-layout`,
`aria-gm-split-layout`, hooks `splitKey` / `defaultPane`) **disparaît**. Tiroirs + colonne
caméras fixe le remplacent.

## Joueur

### Correspondance des anciens onglets

| ancien onglet | nouvelle place |
|---|---|
| Compétences | épingles de la barre du bas + pop-up « Toutes les compétences » |
| Caractéristiques | dans la pop-up « Toutes les compétences » |
| Jet libre | tiroir |
| Inventaire | tiroir « Sac » |
| Notes, Fichiers (« Docs »), Cartes, ⚗ Alchimie | tiroirs (Cartes / Alchimie toujours conditionnés par `tab-config`, Docs par `playerFiles.length`) |
| Messages | colonne de droite (fil) |
| 📹 Caméras | colonne de droite ; centre sans carte |
| Personnage (éditeur) | tiroir « Fiche » |

Rail : Fiche, Stats, Sac, Alchimie, Cartes, Notes, Docs, Jet libre.

### Barre du bas

- Carte du personnage : portrait, PV, armure, karma.
- **Compétences épinglées** (★ dans la pop-up) + bouton « Toutes les compétences ».
- Modificateur, « Prochains… », « Caché », dés.
- La pop-up « Toutes les compétences » s'ouvre au-dessus de la carte : recherche,
  épingles ★/☆, compétences, Spéciales, Caractéristiques.

### Jets et cartes

Tous les jets et tirages passent par **une seule rangée de cartes au centre** (sur la
carte ; sans carte, au milieu de la grille des caméras). Tranché au 2e tour du
2026-11-25 ; remplace la « petite carte au-dessus de la tuile caméra ».

- **Chaque jet a sa carte**, le mien comme celui des autres, caméra ou non. Le mien a un
  liseré braise.
- **Jets simultanés** : la première carte au milieu, chaque nouvelle à droite de la
  précédente ; une ligne pleine → nouvelle ligne. Pas de limite.
- Le bloc reste **centré** dans les deux sens et grandit symétriquement ; chaque ligne est
  centrée. Une carte qui part ne décale pas les autres : sa place est reprise par la
  suivante. Si le bloc dépasse la hauteur de la carte, les cartes rétrécissent.
- Une carte reste **3 s** à partir de sa propre arrivée, puis va dans le fil. Survoler la
  rangée met tout en pause.
- **Tirage de carte** : retourné dans la même rangée, **vu par tous**, 4 s, puis le fil et
  l'historique du tiroir Cartes.
- MJ : même rangée pour les jets et tirages des joueurs ; ses jets cachés n'y sont jamais
  et restent au-dessus de sa barre du bas.

### Sur la carte

- Je ne déplace **que mon jeton**. En mode validation, un fantôme pointillé reste à la
  destination avec « en attente du MJ · 4,5 m ».
- Outils : zoom, recentrer sur mon jeton, **mesure en mètres** (1 case = 1,5 m), ping.
- Clic sur un jeton : fiche. La mienne a les actions rapides (Combat, Parade, Esquive,
  arme favorite) ; celle des autres est en lecture seule.
- Vue libre + bascule **« Suivre le MJ »**, activée à l'ouverture d'une carte.
- Dégâts : retour visuel sur le jeton **et** sur la carte du personnage.
- PV des monstres : **barre colorée seulement** (vert / ambre / rouge), jamais de chiffres.
- Monstre à 0 PV : jeton gris barré ✕, « hors de combat », reste jusqu'à ce que le MJ le retire.

### Sans carte

Les caméras prennent le centre (« La table » : MJ en 2×2, joueurs autour, « Le MJ prépare
la scène »). La colonne de droite ne garde que le fil.

## MJ

### Correspondance des anciens onglets

| ancien onglet | nouvelle place |
|---|---|
| Joueurs | tiroir (détails, onglets accordés, karma — remplace la modale 📋) |
| Monstres, ♪ Musique, Fichiers, Notes, ⚗ Alchimie, Cartes | tiroirs |
| Cartes du monde | tiroir « Mondes » (choix de la carte affichée) |
| Jets | fil de la colonne de droite (filtres Tous / Succès / Échec / Crit. / Dés + joueur, badge violet MJ sur les jets cachés) |
| Jet MJ | barre du bas — toujours caché |
| Messages | fil de la colonne de droite |

Rail, dans l'ordre : Monstres, Joueurs, Musique, Fichiers, Notes, Alchimie, Cartes, Mondes.

### Barre du bas — suit le jeton sélectionné

- Jeton sélectionné : PV, `− Dégâts` / valeur / `+ Soin`, attaques du monstre en épingles.
- Rien de sélectionné : seulement dés + Jet MJ.

### Sur la carte

- Barre d'outils verticale au bord gauche : sélection, brouillard (rectangle / polygone /
  recouvrir), placer un jeton, masquer / montrer, mesurer, ping, mode de déplacement
  (libre / validation).
- Le MJ voit à travers le brouillard (assombri, contour violet pointillé) et les jetons
  cachés (pointillés).
- File ⚑ : chaque déplacement en attente porte Valider / Refuser sur la carte ; le
  compteur est dans la barre du haut.
- Glisser un monstre du tiroir sur la carte crée un **jeton lié** (`monsterId`) ; bouton
  « Placer » en alternative. Un jeton déposé ainsi est caché aux joueurs par défaut.
- « Retirer les morts » dans la barre d'outils.

### Caméras

Bouton « Projecteur » au survol d'une tuile ; la tuile en projecteur a un cadre violet.

## Comportements transverses

- **Petits écrans** : sous 1440 px, caméras repliées en portraits et 4 épingles + Toutes
  (planche Portable 1366×768). Sous **1280 px** (tablette, téléphone) : pas de jeu,
  message « élargissez la fenêtre », fiche consultable en lecture seule.
- **Sombre seulement** : le mode clair est abandonné (2026-11-25), comme le reste du site.
- **Raccourcis** (inactifs quand le focus est dans un champ) : `1`–`8` sections du rail,
  `Échap` revient à l'outil Sélection puis ferme le tiroir, `M` mesurer, `F` Suivre le MJ.
  Pas d'`Espace` : on ne relance jamais une compétence.
- Sous 1280 px : message « Élargissez la fenêtre pour jouer » + lien vers la Fiche
  (`aria-fiche.html?camp=`), déjà en lecture seule. Pas de nouvelle vue.

## Mise en œuvre

- **Refonte en place** de `views/aria-player.html` / `views/aria-gm.html` (et leurs CSS /
  JS). Interrupteur provisoire `?ui=old` qui garde l'ancienne interface **une version**.
  URL d'overlay et liens inchangés.
- La vue peut sortir **avant la carte tactique** : sans carte, le centre est la grille des
  caméras ; la carte se branche dans le centre le jour où elle arrive.

### Ordre de construction (chaque étape se livre seule)

1. Cadre côté joueur : barre du haut, rail, tiroirs, barre du bas.
2. Colonne caméras / centre sans carte.
3. Même cadre côté MJ.
4. Emplacement de la carte, quand la carte tactique est livrée.

Avancement (2026-11-25) : étapes 1 à 4 codées. L'étape 4 branche la carte tactique
existante (phases 0–2 de sa spec) dans le centre : jeton mort gris barré ✕ « hors de
combat », éclair sur un jeton qui perd des PV, bouton ◎ « Recentrer sur mon jeton »
côté joueur, clic sur un jeton monstre = sélection de la barre du bas côté MJ, monstre
glissé (poignée ⠿) du tiroir sur la carte = jeton lié caché, « Retirer les morts »,
raccourcis `1`–`8`. Restent, parce qu'ils dépendent des phases 3–4 de la carte :
règle `M`, ping, brouillard, « Suivre le MJ » `F`, barre d'outils verticale du MJ.
Restent aussi hors carte : portraits ronds des caméras tiroir ouvert, message sous
1280 px, barre du haut (musique joueur, ⚑), rangée de jets et tirages au centre, bouton
Projecteur, suppression du moteur de volets après la version `?ui=old`. Détail et ordre :
*Suite* ci-dessous.

### Suite (tranchée le 2026-11-25, 3 tours de questions)

5. **Règle, ping, Suivre le MJ, barre d'outils MJ** (phase 3 de la carte). *Codée le
   2026-11-25 : `mapView` (règle, ping, vue, `sideTools`), `makeMapFx` (Ably), overlay
   (`_owRuler` / `_owPing`), message `view` du MJ. Jeton libre = `{ ref: null, free: true,
   name }`. Vérifiée sur pages de test locales, pas encore à la table.*
   - Règle : clic droit-glisser toujours ; `M` bascule un outil où le glisser gauche mesure.
     Extrémités aimantées au centre des cases quand la grille aimante ; distance par
     `gridDistance()` (comme les déplacements), bulle « 3 cases · 4,5 m ». Vue en direct
     par tous (≈ 10 envois/s sur Ably), couleur de l'auteur (braise joueur, violet MJ),
     s'efface 2 s après le relâché.
   - Ping : clic long 500 ms immobile (< 5 px), partout, jetons compris ; onde + nom de
     l'auteur 1,2 s. Maj + clic long MJ = recentre tous les écrans une fois, même ceux
     qui ne suivent pas. Rien de persistant.
   - Overlay OBS : pings **et** règles (toutes, MJ compris), couleur de l'auteur.
   - Suivre le MJ : le MJ diffuse toujours sa vue (centre + zoom, anti-rebond ≈ 300 ms)
     dès qu'une carte est au centre, monde ou tactique — sans fuite, la vue du joueur
     filtre brouillard et jetons cachés. Le joueur qui suit la copie ; un pan / zoom manuel
     coupe le suivi ; puce « Suivre le MJ » à côté de ◎ (allumée quand active), clic ou
     `F` la rallume ; réactivée à chaque nouvelle carte affichée.
   - Barre d'outils verticale MJ, remplace les outils de la barre horizontale : Sélection
     (par défaut), Placer un jeton, Masquer / Montrer, Mesurer, Ping, Déplacement libre /
     validation, Retirer les morts ; outils de brouillard à l'étape 6. Choix de carte et
     réglages de grille restent dans le tiroir Mondes.
   - Placer un jeton : un clic ouvre un petit menu sur place — monstres pas encore sur la
     carte, personnages pas encore sur la carte, jeton libre nommé. Un monstre posé ainsi
     est caché, comme au glisser.
6. **Brouillard** (phase 4, cartes tactiques seulement — les cartes du monde gardent
   leurs lieux découverts). *Codée le 2026-11-25 : `map.fog = { base, ops }` (colonne
   `fog` déjà créée par `specs/campaign_maps_tactique.sql`), `mapFog` / `fogVisible` /
   `visibleTokens` dans `aria-supabase.js` (selfcheck), `_mapFogLayer`, outils MJ
   Révéler/Recouvrir · Rect. · Polygone · Tout voir · Tout noir, overlay `_owFog`.
   Vérifiée sur pages de test locales.*
   - Nouvelle carte : tout noir. Carte existante (sans brouillard enregistré) : tout
     révélé, pour ne pas noircir une partie en cours.
   - Outils : révéler / cacher au rectangle et au polygone (éditeur de zones réutilisé),
     « Tout révéler » / « Tout cacher ». Pas de pinceau. Le MJ voit à travers (assombri,
     contour violet pointillé).
   - Tout jeton en zone non révélée est absent chez les joueurs, personnages des autres
     compris ; mon jeton reste toujours visible pour moi.
7. **Hors carte**, dans l'ordre :
   1. Rangée de jets et tirages au centre (voir *Jets et cartes*).
   2. Barre du haut : musique joueur (volume + titre) ; MJ mini-lecteur (lecture / pause,
      titre, volume ; le reste dans le tiroir Musique) et compteur ⚑ — un clic centre la
      carte sur le plus ancien déplacement en attente.
   3. Portraits ronds tiroir ouvert ; le bouton « Fil » (pastille de non-lu) ouvre le fil
      en panneau flottant sur la colonne ; fermer le tiroir rend la colonne normale.
   4. Projecteur : une tuile à la fois, devient la grande tuile chez tous les joueurs avec
      un cadre violet ; via Ably, non persisté, sans effet sur l'overlay. Recliquer la
      tuile en projecteur rend la grande tuile au MJ.
   5. Message sous 1280 px.
   *Codée le 2026-11-25, vérifiée sur pages de test locales (pas encore à la table) :*
   - *Rangée : `makeRollRow()` dans `aria-shared.js` (emplacements, ligne pleine → ligne
     suivante, bloc centré, réduction si trop haut, 3 s / 4 s pour un tirage, survol =
     pause). Joueur : `showOwnRoll()` remplace la carte flottante et le toast des autres ;
     une carte partie devient une ligne du fil (`chat.note`, locale, jamais publiée). MJ :
     jets et tirages des joueurs (les cachés avec « caché ») ; ses jets restent au-dessus
     de la barre ; le fil des jets de la colonne est son fil. Le nom vient du roster
     (`msg.clientId`), plus du message.*
   - *Barre du haut : le joueur garde `#music-bar` (déjà volume + titre, masqué sans
     piste). MJ : ▶/⏸ et volume dans `#tb-music-chip`, `#tb-flag` ⚑ + `focusOldestMove()`.*
   - *Portraits : CSS seul (`.content.drawer-open` + caméras en colonne), PV sous chaque
     portrait (`hp` de la présence), bouton « Fil » (`mountFil`, point de non-lu).
     Joueur seulement : la colonne du MJ porte Joueurs, pas des caméras.*
   - *Projecteur : le ☀ existant des cartes Joueurs (`gmSpotlightCharId`, présence).
     `.cameras-grid.has-spot` fait de la tuile éclairée la grande tuile (colonne et
     centre) ; re-cliquer ☀ rend la place au MJ.*
   - *Sous 1280 px : `mountPlayNarrow()` — Fiche pour le joueur, Accueil pour le MJ.*
   - Suppression du moteur de volets et de `?ui=old` : en un seul nettoyage, quand
     l'utilisateur dit que la version `?ui=old` est sortie.

## Hors périmètre

- Le contenu de la carte tactique elle-même (spec de la carte).
- L'overlay OBS.
- Le jeu sur tablette / téléphone.
