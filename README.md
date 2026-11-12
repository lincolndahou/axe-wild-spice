# AXE — Wild Spice

> **Maquette d'étude.** Projet de démonstration réalisé à des fins
> d'apprentissage et de portfolio. Site **non officiel**, sans affiliation
> ni partenariat avec AXE ou Unilever. Les marques, logotypes, noms de
> produits et visuels appartiennent à leurs détenteurs respectifs. Le
> logotype de la barre de navigation est une **reconstruction** des
> lettres en SVG, pas la fonte sous licence de la marque.

Site produit en deux temps :

1. **Un film épinglé.** Une section `100svh` reste à l'écran pendant que la
   séquence d'images défile. La caméra s'arrête sur cinq plans ; à chaque
   arrêt un chapitre s'écrit par-dessus, puis s'efface.
2. **La suite du site.** Quand la timeline est finie, l'épinglage se libère
   et la page reprend son cours normal : sections numérotées, galerie,
   questions, achat, pied de page.

Direction artistique « Cinematic Luxury Tech », calée sur ARQ-01.

## Lancer

Un serveur HTTP est **obligatoire** : en `file://` le navigateur refuse de
charger la séquence d'images.

```
python -m http.server 8000
```

Puis http://localhost:8000

## Arborescence

```
index.html
assets/
  css/style.css          direction artistique
  js/main.js             Lenis + GSAP, film épinglé, apparitions
  video/background.mp4   vidéo source (copie de travail)
frames/                  262 images 1600 px — desktop   (16 Mo)
frames-sm/               131 images  900 px — mobile    (3,6 Mo)
```

L'original `Product_commercial_video_seamles…_33195b4e_1080p.mp4` reste à la
racine, il n'est pas servi par le site.

## Le film

`TIMELINE`, en haut de `assets/js/main.js`, est la source unique des timings.
Chaque étape amène la séquence jusqu'à `frame` en `units` de défilement
(100 units ≈ un écran). Une étape avec `hold` est un plan posé : le chapitre
du même nom s'affiche pendant cette étape.

| frame | units | hold | Plan |
| --- | --- | --- | --- |
| 0 | 120 | `arrivee` | lévitation, volutes de lumière |
| 52 | 80 | — | descente vers la pierre |
| 95 | 140 | `tenue` | posé sur la pierre, éclaboussure |
| 128 | 70 | — | les matières entrent dans le champ |
| 162 | 140 | `signature` | cèdre, orange, cardamome |
| 186 | 70 | — | raccord sur la macro |
| 212 | 140 | `geste` | capot, diffusion |
| 236 | 60 | — | recul |
| 261 | 150 | `final` | plan large |

Total : 970 units, soit 9,7 écrans de défilement épinglé (776 % sur mobile,
via `MOBILE_SCALE`).

Les numéros de `frame` sont ceux du jeu desktop. Sur mobile, `scaleFrame()`
les ramène automatiquement sur les 131 images du jeu allégé : une seule
timeline à maintenir.

Pendant le chargement, `nearest()` affiche l'image chargée la plus proche de
celle demandée — le film reste regardable sans écran noir ni loader bloquant.
Les 60 premières images partent en priorité, le reste par paquets de 8, et
seulement une fois la page affichée.

## La suite du site

| № | Section | Fond |
| --- | --- | --- |
| I | Qualités — quatre bénéfices numérotés | `--bg` |
| II | Preuve — trois chiffres, compteurs animés | `--bg-raised` |
| III | Le flacon — image pleine largeur | — |
| — | Bandeau défilant en contour | `--bg` |
| IV | Galerie — six plans extraits du film | `--bg` |
| V | Questions — accordéon | `--bg-raised` |
| VI | Acheter | `--bg` |

La galerie et la section flacon réutilisent des images de `frames/` : aucun
visuel supplémentaire à produire.

Les éléments `[data-reveal]` apparaissent une fois, par lots
(`ScrollTrigger.batch`), opacité et 28 px de translation, 800 ms.

## Hero — rotation du produit au survol

Le hero est fait de deux couches calées au pixel, posées dans la même
boîte 16/9 (`.hero__stage`) : le décor et la bombe. Elles partagent donc
les mêmes coordonnées en pourcentage, sans aucun recalage en JS.

| Fichier | Rôle |
| --- | --- |
| `assets/img/hero-plate.jpg` | le décor **sans la bombe** : fond, volutes, sol mouillé, reflet |
| `assets/turntable/can_0001.webp` … `can_0036.webp` | la bombe en rotation, fond transparent, 10° par image |
| `assets/img/hero.jpg` | repli : le visuel complet, bombe comprise |

**Repli.** Le lecteur ne s'active que si `hero-plate.jpg` **et**
`can_0001.webp` se chargent. S'il en manque un, `hero.jpg` reste affiché tel
quel : pas de bombe en double, pas de trou.

**Interaction.** Au survol de la zone sensible, rotation continue, un tour
en 9 s. À la sortie, retour à la pose d'origine par le chemin le plus court,
1,1 s. Le glisser fonctionne aussi, à la souris comme au doigt. Sur écran
tactile la rotation automatique est désactivée : seul le glisser répond.
`prefers-reduced-motion: reduce` coupe la rotation automatique.

La zone sensible est le gabarit de la bombe dans l'image, réglé en CSS :

```css
.hero__hot{ left:68%; right:9%; top:2%; bottom:9%; }
```

À réajuster si le cadrage du visuel change.

**Réglages JS** (objet `SPIN`, dans `assets/js/main.js`) : `count` (36),
`turnMs` (9000), `dragFactor` (0,09 image par pixel glissé).

## Produire les 36 images

`tools/turntable.py` construit la bombe à partir des cotes de la product
reference sheet (150 mm × 52 mm) et rend le tour complet :

```
blender --background --python tools/turntable.py
```

Puis conversion en WebP :

```
cd assets/turntable
for f in can_*.png; do
  ffmpeg -v error -y -i "$f" -c:v libwebp -quality 82 -compression_level 6 "${f%.png}.webp"
done
rm can_*.png
```

Le calage de l'image 1 sur la plaque se règle avec `CAM_DIST`,
`CAM_HEIGHT`, `CAM_SHIFT_X` et `START_ANGLE`, en haut du script. Mettre
`FRAMES = 1`, rendre, superposer à `hero-plate.jpg`, ajuster, recommencer.

Le script accepte aussi un modèle existant via `MODEL_PATH`
(`.blend`, `.obj`, `.fbx`, `.glb`) au lieu de construire la bombe.
L'étiquette se pose via `LABEL_PATH` : un déroulé à plat, 2048 × 1200.

## Regénérer les images

Si la vidéo change :

```
ffmpeg -i assets/video/background.mp4 -vf "fps=24,scale=1600:-2" \
       -c:v libwebp -quality 78 -compression_level 6 "frames/frame_%04d.webp"

ffmpeg -i assets/video/background.mp4 -vf "fps=12,scale=900:-2" \
       -c:v libwebp -quality 72 -compression_level 6 "frames-sm/frame_%04d.webp"
```

Puis ajuster `FILM.frames` et `FILM.refFrames` en haut de
`assets/js/main.js`, et les numéros de `frame` de la `TIMELINE`.

## Direction artistique

| Token | Valeur | Usage |
| --- | --- | --- |
| `--bg` | `#080B0E` | fond |
| `--bg-raised` | `#0C1116` | alternance de section |
| `--surface` | `#171D23` | surfaces |
| `--text` | `#F5F7FA` | texte principal |
| `--text-2` | `#B8C1C9` | texte secondaire |
| `--accent` | `#58BCE8` | accent bleu, numéros, points clés |
| `--accent-2` | `#718A9D` | libellés techniques |
| `--product` | `#F7931A` | orange AXE, réservé au bouton d'achat |

**Typographies.** Titres en grotesque serrée : `Helvetica Neue` si la machine
l'a, sinon `Inter` chargé en webfont. Graisse 300, interlignage `.88`,
approche `-.042em`, bas de casse. Libellés en `IBM Plex Mono`, majuscules,
`letter-spacing .22em`.

**Lisibilité sur le film.** Les deux bords de l'écran sont assombris en
dégradé continu depuis le bord (`.film__vignette`), pas par un bloc posé sur
le texte : aucune arête visible, et le produit garde le centre en pleine
lumière. Sous 768 px le texte passe en bas de l'écran et le dégradé bascule
du bas vers le haut ; le paragraphe long est masqué.

**Mouvement réduit.** `prefers-reduced-motion: reduce` supprime Lenis,
l'épinglage et toutes les animations : le film devient une suite d'images
fixes, une par chapitre, avec le même texte.

## Contenu

Le site ne liste **aucune donnée technique** : ni cotes, ni matière, ni
pyramide olfactive. Il montre ce que le produit apporte. Les quatre qualités
et les trois chiffres viennent tous de la product reference sheet, qui reste
par ailleurs la référence pour la 3D.
