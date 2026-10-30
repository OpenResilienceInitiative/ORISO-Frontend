# Handover: withdraw a pending offer (issue number to be assigned)

Local Storybook (`Organisms/AskerInfoAssign`), fictional data, German UI. The backend is answered by a fetch stub in the story.
The stub returns what the owner's status now carries after a reload: the still-open offer (`openOffer`).

| File                                                   | Viewport | What it proves                                                                                                                               |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 01-before-dev-390x844-de-pending-offer-no-withdraw.png | 390x844  | origin/dev code, same stubbed answer: after a reload the owner gets a blank offer form. The open offer is not shown and cannot be cancelled. |
| 02-after-390x844-de-pending-offer-withdraw-button.png  | 390x844  | The open offer is shown ("Warten auf die ausgewählte Kolleg:in.") with "Angebot zurückziehen".                                               |
| 03-after-390x844-de-offer-withdrawn.png                | 390x844  | After the click: "Das Angebot wurde zurückgezogen.", button gone.                                                                            |
| 04-after-1440x900-de-pending-offer-withdraw-button.png | 1440x900 | Same as 02 on desktop.                                                                                                                       |

Not shown by screenshots (covered by unit tests): authorisation, idempotency, the 409 "already answered" path, the recipient's "withdrawn" dialog, the three timeline entries.
