# Le carbone qui reste

[English](README.md) · [Italiano](README.it.md) · [Español](README.es.md) ·
**Français** · [中文](README.zh.md)

Site d'une seule page sur le bilan mondial du carbone : combien de CO₂ nous
émettons, combien en absorbent les océans et la végétation, et pourquoi la
courbe de Mauna Loa n'en montre que la moitié.

**→ [co2-info.duckdns.org](https://co2-info.duckdns.org/)** — l'anglais à la racine,
et aussi en [italien](https://co2-info.duckdns.org/it/),
[espagnol](https://co2-info.duckdns.org/es/),
[français](https://co2-info.duckdns.org/fr/) et
[chinois](https://co2-info.duckdns.org/zh/)

Née pour vérifier une présentation existante, la page a fini par prendre sa
place. Chaque chiffre porte avec lui sa source et son incertitude.

## Ce qu'elle a d'inhabituel

- **Elle lit ses propres données.** La courbe du CO₂, le taux de croissance,
  la série des températures et la chaleur accumulée dans les océans sont lus
  auprès de la NOAA à chaque chargement. Si le réseau ne répond pas, la page
  affiche les valeurs enregistrées dans le HTML et le déclare par une pastille
  de couleur, au lieu de faire comme si de rien n'était.
- **Chaque figure déclare quel type de chiffre elle montre** : `mesuré`,
  `mesuré et estimé`, `estimation`, `estimation préliminaire`. Une mesure et
  un modèle ne sont pas la même chose, et la page ne les confond pas.
- **Elle se corrige en public.** Le registre des révisions, en bas, énumère ce
  qui a changé et pourquoi, y compris les fois où la page avait tort.
- **Rien à compiler pour la servir, aucun cookie, aucune requête à des tiers**
  au-delà des polices et du compteur de visites. Seize écrans, quinze
  sections, neuf graphiques dessinés en SVG dans la page.

## Contribuer

C'est la partie utile. Si vous trouvez :

- **un chiffre faux** — le signalement le plus précieux de tous : le registre
  des révisions est fait de ceux-là ;
- **une meilleure source**, ou une édition plus récente d'une source déjà
  utilisée ;
- **une phrase qui dit plus que ce que les données soutiennent** — la page
  essaie de l'éviter et n'y parvient pas toujours ;
- une traduction qui sonne mal dans votre langue ;

[ouvrez un signalement](https://github.com/postadelmaga/carbonio/issues) ou
écrivez sur le [tableau de messages](https://co2-info.duckdns.org/feedback.html),
si vous préférez ne pas avoir de compte GitHub. Sous chaque section il y a
aussi une ligne avec deux questions, « vous a-t-elle servi ? » et « est-elle
claire ? » : c'est la façon la plus économique de me dire où la page ne
fonctionne pas. Les propositions de modification sont bienvenues elles aussi.
Deux règles : ne jamais recopier un chiffre depuis un article, on va à la
source primaire ; et si vous changez le texte italien, régénérez les
traductions (`./build.py --extract`, traduire, `./build.py`).

## Comment c'est fait

HTML, CSS et JavaScript écrits à la main. Aucun framework, aucune dépendance,
rien à compiler pour l'héberger.

```
.
├── index.html          la page, en italien : la seule copie écrite à la main
├── it/ en/ es/ fr/ zh/ pages générées : ne pas les modifier à la main.
│                    en/ est publiée à la racine, pas sur /en/
├── i18n/               un dictionnaire par langue + les clés extraites
├── build.py            génère les pages traduites depuis la source italienne
├── publish.sh          deploy.sh avec la destination et l'URL publique intégrées
├── deploy.sh           publication par rsync/ssh
├── 404.html  robots.txt
└── assets/
    ├── style.css       jetons de thème clair/sombre, mise en page, impression
    ├── charts.js       les neuf graphiques SVG + les données de secours intégrées
    ├── slides.js       navigation en diapositives : flèches, clavier, tactile
    ├── live.js         lecture en direct auprès de la NOAA, avec repli
    └── favicon.svg
```

```bash
python3 -m http.server 8100     # puis ouvrez http://localhost:8100
./build.py                      # régénère it/, en/, es/, fr/, zh/
./publish.sh --apply            # publie
```

Le détail — d'où vient chaque chiffre, comment fonctionne la chaîne de
traduction, comment le serveur choisit la langue, ce qui a été mesuré puis
écarté — est dans **[MAINTENANCE.md](MAINTENANCE.md)**, en anglais.

## Sources

- **Global Carbon Budget 2025** (Global Carbon Project, COP30, 13 novembre 2025) — sources et puits, moyennes 2015–2024
- **NOAA Global Monitoring Laboratory** — Mauna Loa depuis 1958 et moyenne mondiale, lus en direct
- **NOAA NCEI** — contenu thermique des océans, 2000 premiers mètres, lu en direct
- **NOAA Paleoclimatology** — Bereiter et al. 2015, 800 mille ans de CO₂ tirés des carottes antarctiques
- **GIEC AR6** — périodes de référence du paléoclimat ; niveaux préindustriels des gaz à effet de serre ; figure 7.2, les flux d'énergie
- **Forster et al., IGCC 2025** et **von Schuckmann et al. 2023** — le déséquilibre énergétique de la Terre et l'inventaire de la chaleur
- **Our World in Data** — émissions par pays, par habitant et cumulées
- **PNUE Emissions Gap Report 2025** — total mondial de tous les gaz à effet de serre
- Sur les armées et les guerres : SGR et CEOBS ; Initiative on GHG Accounting
  of War ; Neimark et al. dans One Earth ; Climate and Community Institute

Conversion utilisée partout : `1 ppm = 2,124 GtC = 7,78 GtCO₂`,
`1 GtC = 3,664 GtCO₂`.

## Licence

- **Code** — [MIT](LICENSE) : `assets/*.js`, `style.css`, `build.py`, les
  scripts de publication, la structure HTML.
- **Textes, graphiques et traductions** — [CC BY 4.0][cc] : réutilisez-les,
  adaptez-les, vendez-les même, à une condition : dire d'où ils viennent et si
  vous y avez changé quelque chose.
- **Les données ne sont pas les nôtres.** Elles appartiennent à la NOAA, au
  Global Carbon Project, à Our World in Data, au GIEC, au PNUE et aux équipes
  de recherche citées dans la page. Citez la source primaire, pas ce dépôt.

Le détail dans [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

[cc]: https://creativecommons.org/licenses/by/4.0/deed.fr
