# #1794 — Share a running call by link (Storybook)

New surface, so there is no "before". Each image is one story of
`Components/Call/Share call by link`, captured locally from Storybook at
commit adc7612f4. The review fix f2aeff307 changes no visuals; it only changes
copy-failure handling and settings state, which the unit and story tests cover.

| File | What it shows                                     |
| ---- | ------------------------------------------------- |
| 01   | Desktop popover, default: both switches on        |
| 02   | Both switches off                                 |
| 03   | Temporary account off                             |
| 04   | After "Kopieren": copied state                    |
| 05   | QR code expanded; popover stays above the toolbar |
| 06   | Browser without Web Share: no "Teilen" button     |
| 07   | Temporary accounts not allowed: switch hidden     |
| 08   | Phone bottom sheet, 375 px                        |
| 09   | Phone bottom sheet, 320 px                        |
| 10   | Phone 320 px with QR code                         |
| 11   | Phone 375 px without Web Share                    |
| 12   | Phone 320 px, temporary accounts not allowed      |
