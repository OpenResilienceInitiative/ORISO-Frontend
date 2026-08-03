import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { AnonymousConsentGate } from './AnonymousConsentGate';
import {
	STORY_WIDTH_COMPACT,
	STORY_WIDTH_PHONE_SMALL,
	STORY_WIDTH_WIDE
} from '../message/messageStoryShell';

/**
 * The data-protection consent gate.
 *
 * **This is a dialog, not a chat message** — a card over a dimmed screen, shown
 * before an anonymous participant may write. It is filed under `Dialog` beside
 * `Atoms/Modal` rather than under `Chat` for that reason. Design reference:
 * [CAR02 2183-14718](https://www.figma.com/design/NEdjgOkKRrCyWVjRjBruXH/CAR02-live-chat_ORISO?node-id=2183-14718).
 *
 * ## Fixed in ORISO-Frontend#892
 *
 * - **Modality.** The copy said "einen **Video-Call** mit Ihnen starten" in all
 *   seven locales, although this gate is what an anonymous **chat** participant
 *   sees. Now "einen Chat mit Ihnen beginnen".
 * - **Wording.** Reformulated gender-neutrally per ADR-018 §7 — "eine beratende
 *   Person" rather than either "Berater_innen" or "Beraterinnen oder Berater".
 * - **Headline.** Exclamation mark dropped, matching the design.
 * - **Layout below 575px.** Buttons now stack full-width inside the card, and
 *   the headline no longer breaks mid-word.
 *
 * **Tigrinya is deliberately untouched** and still names a video call. Editing
 * safety-relevant consent copy in a language nobody on the team reads would be
 * guessing; it needs a native check.
 *
 * ## Still open
 *
 * The reject button keeps its text label where the design has an icon-only ✕,
 * and the component carries `role="dialog" aria-modal="true"` while being
 * rendered inline by `SessionItemComponent` — the ARIA cleanup is tracked in
 * ORISO-UserService#927.
 */
const meta = {
	title: 'Components/Dialog/AnonymousConsentGate',
	component: AnonymousConsentGate,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Consent dialog shown before an anonymous participant may write. `consentLabelHtml` is injected as HTML so the privacy-policy link resolves to the tenant’s own document.'
			}
		}
	},
	args: {
		consentLabelHtml:
			'Ich habe die <a href="#privacy">Datenschutzbestimmung</a> zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Website Cookies.',
		onAccept: () => {}
	}
} satisfies Meta<typeof AnonymousConsentGate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopSideBySide: Story = {
	name: 'Desktop (≥900px) — buttons side by side',
	render: (args) => (
		<div style={{ maxWidth: STORY_WIDTH_WIDE }}>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: 'At desktop width the two buttons sit on one row, which is the intended arrangement above the ~575px dialog breakpoint.'
			}
		}
	}
};

export const Busy: Story = {
	name: 'Accepting (busy)',
	args: { busy: true },
	render: (args) => (
		<div style={{ maxWidth: STORY_WIDTH_WIDE }}>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: 'In-flight state. If the request fails the gate simply stays up — it has no error state of its own, which matters when the server-side check lands (ORISO-UserService#927).'
			}
		}
	}
};

export const Mobile390: Story = {
	name: 'Mobile 390px — fits, without slack',
	render: (args) => (
		<div style={{ maxWidth: STORY_WIDTH_COMPACT }}>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		viewport: { defaultViewport: 'mobile1' },
		docs: {
			description: {
				story: 'At 390px the two buttons still fit inside the card — but only just. Compare with the 375px story.'
			}
		}
	}
};

export const Mobile375LayoutDefect: Story = {
	name: 'Mobile 375px (iPhone SE)',
	render: (args) => (
		<div style={{ maxWidth: STORY_WIDTH_PHONE_SMALL }}>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		viewport: { defaultViewport: 'mobile1' },
		docs: {
			description: {
				story: 'Regression pin for ORISO-Frontend#892 at the iPhone SE / iPhone 8 width. Two defects used to appear here and must not come back: the button row broke out of the card, and the headline split mid-word into "Herzlich Willkomm|en!". Root causes were a missing stacked-button rule below 575px, a global `word-break: break-word` from `sanitize.css`, and 112px of horizontal padding on a 375px screen.'
			}
		}
	}
};

export const StackedButtonsTarget: Story = {
	name: 'Reference: the stacked arrangement, forced',
	render: (args) => (
		<div
			style={{ maxWidth: STORY_WIDTH_PHONE_SMALL }}
			className="sb-consent-stacked-preview"
		>
			<style>{`
				/* Preview only — not shipped styling. Shows the arrangement the
				   house dialog rule asks for below ~575px, so the fix in
				   ORISO-Frontend#892 has something to be compared against. */
				.sb-consent-stacked-preview .anonymousConsentGate__actions {
					flex-direction: column;
					align-items: stretch;
					gap: 8px;
				}
				.sb-consent-stacked-preview .anonymousConsentGate__actions button {
					width: 100%;
				}
			`}</style>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		viewport: { defaultViewport: 'mobile1' },
		docs: {
			description: {
				story: 'Forces the stacked arrangement via a story-local stylesheet. Since ORISO-Frontend#892 the component does this by itself below 575px, so this story should now look identical to the 375px one — if it does not, the media query has regressed.'
			}
		}
	}
};
