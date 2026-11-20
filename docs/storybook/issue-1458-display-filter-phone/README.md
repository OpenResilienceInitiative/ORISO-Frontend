# Display-filter dialog on a phone (#1458)

The "Ansicht" display-filter dialog in Gespräche, Anfragen and Zeitstrahl at phone width.

- **Before:** dev.oriso.org v2.0.12 in a 390 px and 320 px browser window. The table squeezes the kind names into one letter per line and clips the pickers on the right. The dark recovery-key snackbar belongs to the live session, not to this dialog.
- **After:** Storybook `Organisms/DisplayFilterDialog` phone stories at 390 px and 320 px. Below 600 px each kind is a block: icon and name on one line, the labelled pickers underneath. The header icon and the list of kinds come from the story data, not from this change.

These images show the layout only. Desktop staying unchanged is covered by the desktop story and its story test, not by these screenshots.

## Gespräche, 390 px

![Before: names one letter per line, pickers clipped](01-before-sessions-dialog-phone-390.png)
![After: one block per kind, pickers fully visible](01-after-sessions-dialog-phone-390.png)

## Gespräche, 320 px

![Before: names one letter per line, Anzeigen column cut off](02-before-sessions-dialog-phone-320.png)
![After: names on one line, both pickers visible (list scrolled)](02-after-sessions-dialog-phone-320.png)

## Anfragen, 390 px

![Before: names one letter per line, pickers clipped](03-before-requests-dialog-phone-390.png)
![After: one block per kind](03-after-requests-dialog-phone-390.png)

## Zeitstrahl, 390 px

![Before: names break mid-word](04-before-timeline-dialog-phone-390.png)
![After: one block per kind](04-after-timeline-dialog-phone-390.png)
