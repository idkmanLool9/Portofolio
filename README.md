# Portfolio

Persoonlijke portfolio voor Roblox-werk (scripting, building, modeling, UI). Statische site, geen build stap. Alle projecten en de meeste tekst zijn nog placeholder.

Live: **https://idkmanlool9.github.io/Portofolio/**

GitHub Pages publiceert vanaf de branch `claude/magical-mendel-mqf5do` (root). Elke push daarheen staat binnen een minuut online.

## Bestanden

| Bestand | Wat |
| --- | --- |
| `index.html` | De pagina: hero, work, services, about, contact |
| `style.css` | Alle styling |
| `main.js` | Menu, animaties, filters, cursor, hero-overgang |
| `world.js` | De live 3D-blokwereld in het hero-venster (WebGL2). Plek voor een showreel later |
| `voxel.js` | Reservebeeld als een browser geen WebGL2 heeft |
| `diorama.js`, `assets/vendor/three.min.js` | 3D-eiland (Three.js, MIT) voor hero-studie A en de placeholder-renders |
| `assets/placeholders/` | Gerenderde 3D-plaatjes in de projectkaarten en bij About, tot er echte screenshots zijn |
| `lab/` | Drie hero-studies om te vergelijken (A diorama, B typografie, C showcase) en de render-helper |
| `404.html` | Eigen 404-pagina (GitHub Pages gebruikt die automatisch) |
| `assets/fonts` | Archivo, lokaal (SIL Open Font License) |
| `assets/favicon.svg`, `assets/apple-touch-icon.png` | Tab- en homescreen-icoon |
| `assets/og.jpg` | Preview als de link gedeeld wordt (Discord, X). Opnieuw maken als je naam verandert |
| `.nojekyll` | Zegt tegen Pages dat de bestanden zo geserveerd moeten worden |

## Aanpassen

- **Naam:** `Your Name` in `index.html` en `404.html` (de grote naam in de hero schaalt zichzelf). Ook in de `og:title`.
- **Projecten:** elke `<a class="card">` in de Work-sectie. `data-tags` bepaalt onder welke filters hij valt (`scripting`, `building`, `modeling`, `ui`). Vervang het plaatje in `assets/placeholders/` door een echte screenshot.
- **Tijdzone van de klok:** `timeZone` in `main.js`.
- **Cijfers:** `data-value` op de `.odo` elementen in About.

## Bekijken

```bash
python3 -m http.server 8000
```

Daarna naar `http://localhost:8000`.
