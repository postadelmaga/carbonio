# El carbono que queda

[English](README.md) · [Italiano](README.it.md) · **Español** · [中文](README.zh.md)

Sitio de una sola página sobre el balance global del carbono: cuánto CO₂
emitimos, cuánto absorben los océanos y la vegetación, y por qué en la curva de
Mauna Loa solo se ve la mitad.

**→ [co2-info.duckdns.org](https://co2-info.duckdns.org/)** — también en
[inglés](https://co2-info.duckdns.org/en/),
[español](https://co2-info.duckdns.org/es/) y
[chino](https://co2-info.duckdns.org/zh/)

Nació para verificar una presentación que ya existía y acabó ocupando su
lugar. Cada número lleva su fuente y su incertidumbre.

## Qué tiene de insólito

- **Lee sus propios datos.** La curva del CO₂, la tasa de crecimiento y la
  serie de temperaturas se piden a la NOAA en cada carga. Si la red no
  responde, la página muestra los valores guardados en el HTML y lo declara con
  un punto de color, en lugar de disimular.
- **Cada figura declara qué tipo de número muestra**: `observado`,
  `observado y estimado`, `estimación`, `estimación preliminar`. Una medida y
  un modelo no son lo mismo, y la página no los confunde.
- **Se corrige en público.** El registro de revisiones del final enumera qué
  cambió y por qué, incluidas las veces en que la página se equivocaba.
- **Nada que compilar para servirla, sin cookies, sin peticiones a terceros**
  más allá de las tipografías y el contador de visitas. Catorce pantallas,
  trece secciones, ocho gráficos dibujados como SVG en la propia página.

## Colaborar

Esta es la parte útil. Si encuentras:

- **un número equivocado** — el aviso más valioso de todos: el registro de
  revisiones está hecho de estos;
- **una fuente mejor**, o una edición más reciente de alguna ya usada;
- **una frase que afirma más de lo que sostienen los datos** — la página
  intenta evitarlo y no siempre lo consigue;
- una traducción que en tu idioma suena mal;

[abre un aviso](https://github.com/postadelmaga/carbonio/issues). Las
propuestas de cambio también son bienvenidas. Dos reglas: nunca transcribas una
cifra de un artículo, ve a la fuente primaria; y si cambias el texto italiano,
regenera las traducciones (`./build.py --extract`, traducir, `./build.py`).

## Cómo está hecho

HTML, CSS y JavaScript escritos a mano. Sin framework, sin dependencias, nada
que compilar para servirlo.

```
.
├── index.html          la página, en italiano: la única copia escrita a mano
├── en/ es/ zh/         traducciones generadas: no editar a mano
├── i18n/               un diccionario por idioma + las claves extraídas
├── build.py            genera las páginas traducidas desde el original italiano
├── publish.sh          deploy.sh con destino y URL pública ya incorporados
├── deploy.sh           publicación por rsync/ssh
├── 404.html  robots.txt
└── assets/
    ├── style.css       tokens de tema claro/oscuro, maquetación, impresión
    ├── charts.js       los ocho gráficos SVG + los datos de reserva incrustados
    ├── slides.js       navegación por diapositivas: flechas, teclado, táctil
    ├── live.js         lectura en directo de la NOAA, con alternativa
    └── favicon.svg
```

```bash
python3 -m http.server 8100     # luego abre http://localhost:8100
./build.py                      # regenera en/, es/, zh/
./publish.sh --apply            # publica
```

El detalle — de dónde sale cada número, cómo funciona la cadena de
traducciones, cómo elige el idioma el servidor, qué se midió y se descartó —
está en **[MAINTENANCE.md](MAINTENANCE.md)**, en inglés.

## Fuentes

- **Global Carbon Budget 2025** (Global Carbon Project, COP30, 13 de noviembre de 2025) — fuentes y sumideros, medias 2015–2024
- **NOAA Global Monitoring Laboratory** — Mauna Loa desde 1958 y media global, leídos en directo
- **NOAA Paleoclimatology** — Bereiter et al. 2015, 800 mil años de CO₂ de los testigos antárticos
- **IPCC AR6** — períodos de referencia del paleoclima; niveles preindustriales de los gases
- **Our World in Data** — emisiones por país, por habitante y acumuladas
- **UNEP Emissions Gap Report 2025** — total mundial de todos los gases de efecto invernadero
- Sobre ejércitos y guerras: SGR y CEOBS; Initiative on GHG Accounting of War;
  Neimark et al. en One Earth; Climate and Community Institute

Conversión usada en todas partes: `1 ppm = 2,124 GtC = 7,78 GtCO₂`,
`1 GtC = 3,664 GtCO₂`.

## Licencia

- **Código** — [MIT](LICENSE): `assets/*.js`, `style.css`, `build.py`, los
  scripts de publicación, la estructura HTML.
- **Textos, gráficos y traducciones** — [CC BY 4.0][cc]: reutilízalos,
  adáptalos, véndelos si quieres, con una condición: decir de dónde vienen y
  si has cambiado algo.
- **Los datos no son nuestros.** Son de la NOAA, el Global Carbon Project,
  Our World in Data, el IPCC, el PNUMA y los grupos de investigación citados
  en la página. Cita la fuente primaria, no este repositorio.

El detalle en [LICENSE-CONTENT.md](LICENSE-CONTENT.md).

[cc]: https://creativecommons.org/licenses/by/4.0/deed.es
