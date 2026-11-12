# Portfolio

Persoonlijke portfolio voor Roblox-werk (scripting, building, modeling, UI). Statische site, geen build stap. Alle projecten en de meeste tekst zijn nog placeholder.

## Bestanden

| Bestand | Wat |
| --- | --- |
| `index.html` | De pagina: hero, work, services, about, contact |
| `style.css` | Alle styling |
| `main.js` | Animaties, filters, cursor, klok, hero-overgang |
| `voxel.js` | Tekent de blok-eilandjes die als tijdelijk beeld dienen |
| `assets/fonts` | Archivo, lokaal (SIL Open Font License) |

## Aanpassen

- **Naam:** `Your Name` in `index.html` (de grote naam in de hero schaalt zichzelf).
- **Projecten:** elke `<a class="card">` in de Work-sectie. `data-tags` bepaalt onder welke filters hij valt (`scripting`, `building`, `modeling`, `ui`). Vervang de `vox-host` door een `<img>` zodra er screenshots zijn.
- **Tijdzone van de klok:** `timeZone` in `main.js`.
- **Cijfers:** `data-value` op de `.odo` elementen in About.

## Bekijken

```bash
python3 -m http.server 8000
```

Daarna naar `http://localhost:8000`.
