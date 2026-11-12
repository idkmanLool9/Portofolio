# Portfolio

Drie designrichtingen voor een Roblox-portfolio. Nog zonder werk of persoonlijke info; alle tekst is placeholder.

| Map | Richting |
| --- | --- |
| `concepts/01-ledger` | Licht en redactioneel, werk als index |
| `concepts/02-reel` | Donker en filmisch, serif, grote beeldvlakken |
| `concepts/03-signal` | Eén inktkleur, naam groot in de hero, projectkaarten |

`index.html` in de root is een keuzepagina met previews van alle drie.

## Bekijken

Gewone HTML/CSS/JS, geen build stap. Lokaal openen via een simpele server (fonts laden dan goed):

```bash
python3 -m http.server 8000
```

Daarna naar `http://localhost:8000`.

## Techniek

- Fonts staan lokaal in `assets/fonts` (Archivo, Newsreader, Martian Mono; SIL Open Font License, zie `assets/fonts/licenses`).
- Geen frameworks of externe requests.
- Respecteert `prefers-reduced-motion`.
