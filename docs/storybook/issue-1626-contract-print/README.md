# Confirmed contract print evidence — issue 1626

The success page now offers “Drucken / als PDF speichern”. The browser print document contains the complete contract and the server-confirmed person and date.

## Before and after

Screenshots use the local Storybook DpaSign fixture with a mocked API and the safe demo identity Marge Simpson. They are visual evidence only; they do not prove deployment or delivery of real mail.

| View                | Before                           | After                           |
| ------------------- | -------------------------------- | ------------------------------- |
| Mobile, 390 × 844   | 01-before-success-mobile-de.png  | 02-after-success-mobile-de.png  |
| Tablet, 820 × 1180  | 03-before-success-tablet-de.png  | 04-after-success-tablet-de.png  |
| Desktop, 1440 × 900 | 05-before-success-desktop-de.png | 06-after-success-desktop-de.png |

Before source is `2efed16fd8e31a3e019ac0c9a675929b5ac8fdb2`. After UI/print source is commit `5060b5f8130291a54fadc6153d25379d29ca868d`; the subsequent sparse informal translation overlay correction inherits the existing German copy and does not change these German captures.

## Printed document

`09-confirmed-contract-de.pdf` and page images 07/08 show two A4 pages: all six fixture chapters, contract version, organisation, stored signer name/position, optional note, and the server timestamp displayed in Europe/Berlin. Navigation, form controls and success actions are excluded. Browser-generated headers and footers were disabled; the production hint instructs the user to do this so the one-use URL is not printed.

Browser checks cover the real German success action at 320/390/412/820/1440 pixels. Tab naturally focuses the action after success, Enter invokes browser printing, and the focused action fits at 320/412. Additional English/French label substitution is a layout stress check only. The public page retains its existing default German language and has no language selector. Explicit English legal content/notices are covered by LegalContentRenderer unit tests; a full English browser PDF was not verified.

The local browser/PDF scripts and command logs are held in the task artifact directory. All browser contexts launched by those scripts close in `finally`.
