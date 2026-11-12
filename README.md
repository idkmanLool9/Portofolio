# Portfolio

Persoonlijke portfolio voor Roblox-werk (scripting, building, modeling, UI). Statische site, geen build stap. Alle projecten en de meeste tekst zijn nog placeholder.

Live: **https://idkmanlool9.github.io/Portofolio/**

GitHub Pages publiceert vanaf de branch `claude/magical-mendel-mqf5do` (root). Elke push daarheen staat binnen een minuut online.

## Bestanden

| Bestand | Wat |
| --- | --- |
| `index.html` | De pagina: hero, work, services, about, contact |
| `style.css` | Alle styling |
| `main.js` | Animaties, filters, cursor, klok, hero-overgang |
| `voxel.js` | Tekent de blok-eilandjes die als tijdelijk beeld dienen |
| `404.html` | Eigen 404-pagina (GitHub Pages gebruikt die automatisch) |
| `assets/fonts` | Archivo, lokaal (SIL Open Font License) |
| `assets/favicon.svg`, `assets/apple-touch-icon.png` | Tab- en homescreen-icoon |
| `assets/og.png` | Preview als de link gedeeld wordt (Discord, X). Opnieuw maken als je naam verandert |
| `.nojekyll` | Zegt tegen Pages dat de bestanden zo geserveerd moeten worden |

## Aanpassen

- **Naam:** `Your Name` in `index.html` en `404.html` (de grote naam in de hero schaalt zichzelf). Ook in de `og:title`.
- **Projecten:** elke `<a class="card">` in de Work-sectie. `data-tags` bepaalt onder welke filters hij valt (`scripting`, `building`, `modeling`, `ui`). Vervang de `vox-host` door een `<img>` zodra er screenshots zijn.
- **Tijdzone van de klok:** `timeZone` in `main.js`.
- **Cijfers:** `data-value` op de `.odo` elementen in About.

## Bekijken

```bash
python3 -m http.server 8000
```

Daarna naar `http://localhost:8000`.
