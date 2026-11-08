# Shadepi Deskpet

Ein Desktop-Maskottchen im Stil von **[ShadepiRPG](https://github.com/Inrouder/ShadepiRPG)**: **Shadepi** und **Raven** leben auf deinem Bildschirm. Sie laufen über die Taskleiste, klettern an echten Fenstern hoch, stehen auf Titelleisten und fahren mit, wenn du ein Fenster verschiebst. Ab und zu greifen Drohnen, Datenviren, Cyberpunk-Gangs, Kampfbots oder sogar Bosse an. Alles läuft vollautomatisch und mit Kino-Inszenierung: Letterbox-Balken, Titelkarten, Zeitlupe beim letzten Treffer, Kamerawackeln und Trefferstopps.

![Drohnenschwarm: Raven übernimmt eine Drohne](docs/vorschau-drohnen.png)

| Shadepi trainiert … und flickt das Loch mit Klebeband | Raven öffnet eine Wartungsluke und verkabelt neu |
| --- | --- |
| ![Training](docs/vorschau-training.png) | ![Luke](docs/vorschau-luke.png) |

| Boss: ICE-Wächter | Menü im Pixel-UI des Spiels |
| --- | --- |
| ![Boss](docs/vorschau-boss.png) | ![Menü](docs/vorschau-menue.png) |

## Was passiert auf dem Bildschirm?

- **Umschaltbar:** nur Shadepi, nur Raven, beide zusammen oder **abwechselnd** mit Schichtwechsel. In allen Einzelmodi kommt der Partner manchmal **zu Besuch** oder springt **im Kampf zur Hilfe** („Brauchst du Hilfe, Hutmann?“).
- **Fenster beklettern:** Die Figuren erkennen unter Windows alle sichtbaren Fenster, klettern an den Seitenkanten hoch (Raven nutzt bei zu hohen Kanten ihren Greifhaken, Shadepi den Schattensprung), springen von Fenster zu Fenster und lassen sich wieder fallen. Verdeckte Teile werden berücksichtigt, die Ecke mit Minimieren/Schließen bleibt frei.
- **Kämpfe:** Drohnenpatrouillen und -schwärme, Virusausbrüche aus einem Glitch-Riss, Cyberpunk-Gangs und Schützen, Kampfbots im Luftabwurf, **Boss ICE-Wächter** und **Boss Chrome Jackal**. Manchmal kämpft eine Figur allein, manchmal beide zusammen.
  - **Shadepi:** Katana-Kombos, Tritt, aufgeladener Schlag, Sprungschlag gegen Flieger, Wurfsterne und der Spezialangriff **Schattenschnitt** (Zeitlupe + Nachbilder).
  - **Raven:** Impulspistole (auch aus der Hocke), Kettenblitz gegen Viren, **Drohnen-Hack** (die Drohne kämpft dann für sie), Störsignal gegen schwere Gegner.
  - **Doppelschlag:** Raven blockiert einen schweren Gegner, Shadepi vollendet.
  - Werden die Helden besiegt, gehen sie nur kurz in die Knie und regenerieren (Heiligtum bzw. Neustart).
- **Eigenleben:** Shadepi **trainiert** selbstständig, schlägt dabei manchmal versehentlich ein **Loch in den Bildschirm** und flickt es danach mit **Klebeband**. Raven öffnet ab und zu eine **Wartungsluke** im Bildschirm, scannt, löst die Schrauben und **verkabelt die Leitungen neu**, ARToS meldet „Signal 100 Prozent“. Dazu kommen Sparring (Shadepi pariert Ravens Schüsse), Gespräche zwischen den beiden, Ballspiel, Nickerchen und Kommentare zu deinen Fenstertiteln.

## Bedienung

| Aktion | Wirkung |
| --- | --- |
| Figur **mit der Maus packen** | Sie baumelt am Kragen und **schimpft**. Wer schüttelt, bekommt extra Ärger (und eine schwindelige Figur). |
| Figur **loslassen/werfen** | Sie fliegt, trudelt, landet und beschwert sich. Geworfene Figuren hauen Gegner um. |
| Figur **anklicken** | Sie reagiert und hüpft kurz. |
| Gegner anklicken / packen / werfen | Du kannst mithelfen: Gegner gegeneinander werfen funktioniert. |
| Spielzeug anklicken | wird weggekickt; Power-ups lässt du von der nächsten Figur einsammeln. |
| **Rechtsklick auf eine Figur**, Klick auf das **Tray-Symbol**, die **Seitenleiste** rechts oder **Strg+Alt+P** | Menü öffnen. |
| **Strg+Alt+H** | Alles aus-/einblenden. |

Überall sonst gehen Klicks einfach durch das Overlay hindurch – du kannst normal weiterarbeiten.

### Menü

- **Spielzeug:** Kiste, explosives Fass, Holowürfel, Neon-Ball, Snackautomat, Server, Sicherungskasten (Grafiken aus dem Spiel). Die Figuren spielen damit: kicken, zerlegen Kisten, Raven hackt Automaten und schießt Fässer an.
- **Ausrüstung:** Heiligtums-Kern (Aura, doppelter Schaden), Drachenklinge (Schwertwellen), Wurfsterne, Overclock-Chip (Schnellfeuer), EMP-Granate, Nanitenpaket.
- **Gegner:** einzelne Drohnen, Viren, Cyberpunks, Schützen, Kampfbots sowie beide Bosse.
- **Szenen:** jedes automatische Ereignis lässt sich auch direkt starten.
- **Figuren:** Modus wählen, Partner rufen, Schichtwechsel.
- **System:** Größe, Lautstärke, Aktivität (Ruhig/Normal/Chaos), Kino-Effekte, Bildschirmschäden, Fensterklettern, Sprechblasen, Kampfmusik, bei Vollbild ausblenden, Ruhemodus, Beenden.

Einstellungen werden gespeichert. Über das Tray-Menü lässt sich außerdem **„Mit Windows starten“** und bei mehreren Monitoren der **Bildschirm** wählen.

## Installation (Windows)

1. Unter **Actions → Windows-Build** den neuesten erfolgreichen Lauf öffnen und das Artefakt **Shadepi-Deskpet-Windows** herunterladen (bei Versions-Tags `v*` liegt es zusätzlich unter **Releases**).
2. Entweder `Shadepi-Deskpet-…-portable.exe` direkt starten oder den Installer ausführen.
3. Windows SmartScreen kann beim ersten Start warnen, weil die Datei nicht signiert ist: „Weitere Informationen → Trotzdem ausführen“.

### Selbst bauen

```bash
npm install
npm start            # direkt starten
npm run dist         # Windows-Programm (portable + Installer) nach dist/
npm run demo         # Browser-Vorschau mit simulierten Fenstern: http://localhost:8377/?mode=beide
```

Nützliche Vorschau-Parameter: `?mode=beide&event=training`, `event=luke`, `event=ice`, `event=jackal`, `event=schwarm`, `activity=chaos`, `debug=1` (zeigt erkannte Kanten), `menu=1`.

## Technik

- **Electron**-Overlay: randlos, transparent, immer im Vordergrund, über den ganzen Bildschirm. Klick-Durchlass per `setIgnoreMouseEvents(…, { forward: true })`; nur über Figuren, Gegenständen und dem Menü fängt das Overlay die Maus ab.
- **Fenstererkennung** (`main/winscan.ps1`): ein kleiner PowerShell-/C#-Helfer liest per `EnumWindows` + DWM-Rahmen alle sichtbaren Fenster in Z-Reihenfolge (DPI-bewusst) und meldet Änderungen als JSON. Daraus berechnet `app/js/terrain.js` begehbare Oberkanten und kletterbare Seiten. Unter macOS/Linux laufen die Figuren nur auf dem Bildschirmboden.
- **Spiel-Engine** in reinem Canvas-JavaScript (`app/js/`): Helden-KI mit Generator-Abläufen (`hero.js`), Gegner (`enemies.js`), Spielzeug/Power-ups (`items.js`), Effekte und Bildschirmschäden (`fx.js`, `screen.js`), Kino-Regie (`cinema.js`) und die automatische Regie (`director.js`).

## Grafiken, Klänge und Schriften

Alles unter `app/assets/` stammt aus **ShadepiRPG** und wird dort nicht verändert: Helden-Atlanten, Kampfposen, Ravens Handzauber, Straßenkämpfer, Schützen, Chrome Jackal, Kampfbot, Drohne (Fahrzeugatlas), Datenvirus, ICE-Wächter, Requisiten, Feuer/Rauch/Explosion, Pixel-UI (Raven-Thema), Soundeffekte, Kampf-/Bossmusik und die Schriften *Shadepi Pixel* (Jersey 10, OFL) und *Silkscreen* (OFL). Neu übernehmen bzw. aktualisieren:

```bash
python tools/build_assets.py ../ShadepiRPG
```

Das Skript liest nur, schneidet Requisiten und FX aus den Atlanten, misst die Fußpunkte der Kampfposen und schreibt `app/assets/manifest.js`. Die Sprechblasen, Löcher, Klebeband, Wartungsluke, Projektile und kleinen Power-up-Symbole werden zur Laufzeit gezeichnet.
