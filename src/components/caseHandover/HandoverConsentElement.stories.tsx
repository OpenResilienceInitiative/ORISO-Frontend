import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
	HandoverConsentElement,
	initialHandoverConsentState,
	type HandoverConsentLinksStatus,
	type HandoverConsentTenantDefault,
	type HandoverConsentWording
} from './HandoverConsentElement';
import {
	MessageStoryShell,
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import '../message/message.styles.scss';
import './caseHandoverClientCards.styles.scss';
import './handoverConsentElement.styles.scss';

const AGENCY = 'Beratungsstelle Bremen-Mitte';
const IMPRINT_URL =
	'https://example.org/beratungsstelle-bremen-mitte/impressum';
const PRIVACY_URL =
	'https://example.org/beratungsstelle-bremen-mitte/datenschutz';

/** Renders the element the way the message list does — white surface, real width. */
const Stream = ({
	children,
	compact = false
}: {
	children: React.ReactNode;
	compact?: boolean;
}) => <MessageStoryShell compact={compact}>{children}</MessageStoryShell>;

/**
 * Stateful host, so the switch really moves and the sentence underneath really
 * changes. A static `checked` prop would let a screenshot claim a behaviour the
 * component does not have.
 */
const Live = ({
	initial,
	compact = false,
	...props
}: {
	initial: boolean;
	compact?: boolean;
	agencyName?: string;
	imprintUrl?: string;
	privacyUrl?: string;
	linksStatus?: HandoverConsentLinksStatus;
	wording?: HandoverConsentWording;
	saving?: boolean;
	error?: string;
	onRetry?: () => void;
	onOpenDocument?: (document: 'imprint' | 'privacy') => void;
}) => {
	const [checked, setChecked] = React.useState(initial);
	return (
		<Stream compact={compact}>
			<HandoverConsentElement
				agencyName={AGENCY}
				imprintUrl={IMPRINT_URL}
				privacyUrl={PRIVACY_URL}
				checked={checked}
				onChange={setChecked}
				{...props}
			/>
		</Stream>
	);
};

const meta: Meta<typeof HandoverConsentElement> = {
	title: 'Organisms/CaseHandover/HandoverConsentElement',
	component: HandoverConsentElement,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: [
					'Consent element for the case-handover look-in, shown **after a Beratungsstelle has accepted the case** (Frank, 2026-09-07).',
					'',
					'It carries an explanatory sentence, the **Impressum** and **Datenschutzerklärung of that Beratungsstelle**, and one switch whose meaning is spelled out by the sentence underneath it.',
					'',
					'### Why there are three wording variants',
					'',
					'The two sentences as specified are **not complements of each other**. Read literally,',
					'"Ich möchte immer meine Erlaubnis erteilen …" (on) is a standing grant and',
					'"Ich erlaube … ohne meine Einwilligung Einsicht zu nehmen" (off) is also a permission —',
					'so both positions permit look-in and the switch protects nothing. Only one of the two',
					'self-consistent readings can be built, and they disagree about which position is the',
					'privacy-friendly default:',
					'',
					'| Variant | On means | Off means | "Opt-in ⇒ off" is |',
					'| --- | --- | --- | --- |',
					'| `GRANT_ACCESS` | look-in permitted | look-in needs a separate ask | **correct** (no pre-ticked consent, GDPR Art. 4(11)/7(2)) |',
					'| `REQUIRE_ASKING` | ask me every time | look-in without asking | **backwards** (Art. 25(2) wants the protective state as default) |',
					'| `AS_SPECIFIED` | — | — | both positions permit look-in |',
					'',
					'### ADR boundaries',
					'',
					'- **ADR-022 decision 1 — exactly two gates, no third.** The explanatory text plus the two',
					'  Beratungsstelle links *is* gate 2, which `AnonymousConsentGate` already renders. This',
					'  element is therefore a system message in the stream, never a modal and never blocking.',
					'- **ADR-021 decision 7** — the imprint is an information duty, never part of the tick.',
					'- **ADR-002** — colleagues are already silent room members and the curtain is access',
					'  control, not cryptography, so the copy speaks of *Einsicht nehmen*, never of technical',
					'  unreadability.',
					'',
					'Storybook only — no app wiring. See `0 - Docs/VERDRAHTUNG-modul4-handover-consent-2026-09-07.md`.'
				].join('\n')
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof HandoverConsentElement>;

/* ------------------------------------------------------------- 1. baseline */

export const Default: Story = {
	name: 'Grundvariante — desktop',
	parameters: {
		docs: {
			description: {
				story: 'Explanatory text, the two Beratungsstelle links, the switch and the state sentence underneath it. The switch is live: flip it and the sentence changes.'
			}
		}
	},
	render: () => <Live initial={false} />
};

/* --------------------------------------------- 2. both positions, verbatim */

export const SwitchOn: Story = {
	name: 'Schalter EIN — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: "On, with Frank's sentence for the on position, verbatim."
			}
		}
	},
	render: () => <Live initial compact />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const control = canvas.getByTestId('handover-consent-switch');
		await expect(control).toBeChecked();
		/* The sentence is what carries the meaning, so the a11y wiring is
		   asserted rather than assumed: the switch must point at it. */
		const line = canvas.getByTestId('handover-consent-state-line');
		await expect(control).toHaveAttribute(
			'aria-describedby',
			line.getAttribute('id')
		);
		await expect(line).toHaveTextContent(/immer meine Erlaubnis erteilen/);
	}
};

export const SwitchOff: Story = {
	name: 'Schalter AUS — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: "Off, with Frank's sentence for the off position, verbatim. Compare it with the on story: both sentences permit look-in."
			}
		}
	},
	render: () => <Live initial={false} compact />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const control = canvas.getByTestId('handover-consent-switch');
		await expect(control).not.toBeChecked();
		await expect(
			canvas.getByTestId('handover-consent-state-line')
		).toHaveTextContent(/ohne meine Einwilligung/);
	}
};

/* --------------------------------------- 3. Träger preselection, both ways */

const TenantDefault = ({
	tenantDefault,
	wording,
	compact = false
}: {
	tenantDefault: HandoverConsentTenantDefault;
	wording: HandoverConsentWording;
	compact?: boolean;
}) => (
	<Live
		initial={initialHandoverConsentState(tenantDefault)}
		wording={wording}
		compact={compact}
	/>
);

export const TenantDefaultOptIn: Story = {
	name: 'Träger-Vorbelegung Opt-in — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'Träger set to **opt-in**, so the switch starts **off**, exactly as specified. Rendered in the `GRANT_ACCESS` reading, where off means "no look-in without asking me" — the state in which that rule is legally right.'
			}
		}
	},
	render: () => (
		<TenantDefault tenantDefault="OPT_IN" wording="GRANT_ACCESS" compact />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-switch')
		).not.toBeChecked();
	}
};

export const TenantDefaultOptOut: Story = {
	name: 'Träger-Vorbelegung Opt-out — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'Träger set to **opt-out**: look-in is the house default, so the switch starts **on** and the help-seeker turns it off to object.'
			}
		}
	},
	render: () => (
		<TenantDefault tenantDefault="OPT_OUT" wording="GRANT_ACCESS" compact />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-switch')
		).toBeChecked();
	}
};

export const TenantDefaultOptInReadingRequireAsking: Story = {
	name: 'Träger-Vorbelegung Opt-in, Lesart „vorher fragen" — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'The **same rule** ("opt-in ⇒ switch off") under the other reading. Here off means "look-in without asking me", so opt-in produces the *least* protective default — the contradiction that has to be decided before this can be wired.'
			}
		}
	},
	render: () => (
		<TenantDefault
			tenantDefault="OPT_IN"
			wording="REQUIRE_ASKING"
			compact
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-state-line')
		).toHaveTextContent(/ohne meine Einwilligung/);
	}
};

/* ------------------------------- 4. link / persistence states, phone first */

export const LinksLoading: Story = {
	name: 'Links noch nicht geladen — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'The department legal texts are still being resolved. The labels are shown but never as anchors — a link that does not go anywhere yet is worse than a visibly pending one.'
			}
		}
	},
	render: () => <Live initial={false} linksStatus="loading" compact />
};

export const LinksUnavailable: Story = {
	name: 'Links nicht auflösbar — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'Resolution produced nothing on any of the four levels. ADR-021 decision 7 makes imprint reachability a duty, so the failure is stated instead of the row being hidden.'
			}
		}
	},
	render: () => <Live initial={false} linksStatus="unavailable" compact />
};

export const Saving: Story = {
	name: 'Speichern läuft — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'While the preference is in flight the switch carries the native `disabled` attribute, so it really leaves the tab order instead of only looking greyed out.'
			}
		}
	},
	render: () => <Live initial saving compact />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-switch')
		).toBeDisabled();
	}
};

export const SaveFailed: Story = {
	name: 'Speichern fehlgeschlagen — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'Persisting failed. The alert says which position is actually in force, because a switch that silently sprang back would misinform the help-seeker about who can read the conversation.'
			}
		}
	},
	render: () => (
		<Live
			initial={false}
			compact
			error="Ihre Einstellung konnte nicht gespeichert werden. Es gilt weiterhin die vorherige Einstellung."
			onRetry={() => {}}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByTestId('handover-consent-error')
		).toHaveTextContent(/nicht gespeichert/);
	}
};

export const LegalTextsAsReader: Story = {
	name: 'Rechtstexte als Leser statt Link — phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'The shape the product actually has. `LegalLinksProvider` only carries deployment-wide URLs (`REACT_APP_LEGAL_IMPRINT_URL` / `REACT_APP_LEGAL_PRIVACY_URL`); the **Beratungsstelle** document arrives as a body from `GET /service/agencies/{agencyId}/topics/{topicId}/legal` and is read in `LegalLinkModal`. So the two entries are buttons that open the reader, not anchors — the other stories use URLs only because a Storybook mock has nowhere to open.'
			}
		}
	},
	render: () => <Live initial={false} compact onOpenDocument={() => {}} />
};

/* ------------------------------------------------- 5. the three readings, 1440 */

export const WordingComparison: Story = {
	name: 'Die drei Lesarten im Vergleich — desktop 1440',
	globals: desktop1440Globals,
	parameters: {
		docs: {
			description: {
				story: 'All three readings, both positions each, one screen. Row 1 is the wording as specified — read the two sentences against each other and note that both permit look-in. Rows 2 and 3 are the two self-consistent alternatives.'
			}
		}
	},
	render: () => {
		const rows: Array<{ wording: HandoverConsentWording; label: string }> =
			[
				{ wording: 'AS_SPECIFIED', label: 'Wortlaut wie vorgegeben' },
				{
					wording: 'GRANT_ACCESS',
					label: 'Lesart A — der Schalter IST die Einwilligung'
				},
				{
					wording: 'REQUIRE_ASKING',
					label: 'Lesart B — der Schalter fordert, gefragt zu werden'
				}
			];
		return (
			<div style={{ padding: 24, background: '#ffffff' }}>
				{rows.map((row) => (
					<section key={row.wording} style={{ marginBottom: 32 }}>
						<h3
							style={{
								font: '600 15px/22px system-ui, sans-serif',
								margin: '0 0 8px'
							}}
						>
							{row.label}
						</h3>
						{/* `flex: 1 1 0` with `min-width: 0`, so the two
						    positions really sit next to each other at 1440
						    instead of the 720px cards wrapping into six rows —
						    the whole point is reading them against each other. */}
						<div style={{ display: 'flex', gap: 24 }}>
							<div style={{ flex: '1 1 0', minWidth: 0 }}>
								<Live initial wording={row.wording} />
							</div>
							<div style={{ flex: '1 1 0', minWidth: 0 }}>
								<Live initial={false} wording={row.wording} />
							</div>
						</div>
					</section>
				))}
			</div>
		);
	}
};

export const DesktopFull: Story = {
	name: 'Grundvariante — desktop 1440',
	globals: desktop1440Globals,
	parameters: {
		docs: {
			description: {
				story: 'The element at the desktop evidence viewport required by the ORISO Storybook gate.'
			}
		}
	},
	render: () => <Live initial={false} />
};
