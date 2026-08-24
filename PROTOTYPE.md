# Prototype Lane

Wegwerf-/Sammel-Lane ab `pre-dev`. Ziel: alle offenen Aufgaben automatisch
fixen und validieren, ohne Doppelarbeit und ohne Board-Rauschen.

## Regeln (jede Session, vor jedem Fix)

1. **Ist-Stand prüfen.** Viele Alt-Tickets sind längst gefixt. Erst prüfen,
   dann bauen. Schon erledigt → Issue-Kommentar + Karte weiter, kein Neubau.
2. **Erst suchen, dann bauen.** Existiert ein offener PR dafür? Dann dessen
   Branch hierher mergen statt neu implementieren.
   (`gh pr list --search`, Datei-Überschneidung prüfen.)
3. **Claim eintragen** (Tabelle unten, ein Commit) bevor Arbeit beginnt.
   Zeile freigeben beim Abschluss. Kollision = wer zuerst committed hat.
4. **ADR → Spec zuerst** bei ADR-Bezug: Kurz-Spec aus dem ADR ableiten,
   Issue per Kommentar verfeinern. **Keine neuen Tickets.**
5. **Screenshots bei allem Visuellen** (dreambau-evidence / Storybook).
   Selbstcheck vor dem Vorzeigen.
6. **Board erst beim Cut.** Statuspflege passiert beim PR gegen `pre-dev`,
   nicht während der Arbeit hier.

## Claims

| Issue | Session | Status | Evidenz |
|---|---|---|---|
