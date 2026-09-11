# MailService template set

Generated — do not edit by hand. Run `npm run emails:mailservice`.

Mounted over the upstream Online-Beratung mail service's `templates/`
directory; see ADR-020 for why an override rather than a fork.

German is `<name>.html`, English `<name>.en.html`, matching upstream's layout.

## The model contract

Each template consumes only what the sending supplier in ORISO-UserService puts
on the wire. The build fails if a template references anything else, because a
missing model variable renders as a blank line rather than as an error.

| Template                                 | Designed as            | Model variables                                             |
| ---------------------------------------- | ---------------------- | ----------------------------------------------------------- |
| `enquiry-notification-consultant`        | `neue-anfrage`         | `name` `plz` `beratungsstelle` `url`                        |
| `direct-enquiry-notification-consultant` | `direkte-anfrage`      | `name` `plz` `url`                                          |
| `assign-enquiry-notification`            | `anfrage-zugewiesen`   | `name_recipient` `name_sender` `name_user` `url`            |
| `daily-enquiry-notification`             | `tagesuebersicht`      | `consultant_name` `agency_name` `enquiries` `subject` `url` |
| `reassign-request-notification`          | `uebergabe-angefragt`  | `name_recipient` `url`                                      |
| `reassign-confirmation-notification`     | `uebergabe-bestaetigt` | `name_recipient` `name_from_consultant` `url`               |
| `free-text`                              | `mitteilung`           | `subject` `text` `url`                                      |

Tenant attributes (`tenant_name`, `tenant_claim`, `tenant_urldatenschutz`,
`tenant_urlimpressum`) travel with every mail when multitenancy is on.

## What upstream sends that ORISO does not

Upstream also ships `message-notification-consultant`,
`message-notification-asker` and `feedback-message-notification`. **This
UserService never triggers them** — the only template ids it sends are the seven
above. They are left untouched by the override.

## Not covered

`name` / `name_recipient` reach every template and are deliberately unused: no
mail in the design system opens with a salutation. Adding one is a copy
decision, not a technical gap.
