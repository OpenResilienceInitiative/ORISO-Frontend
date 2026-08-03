import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { AnonymousConsentGate } from './AnonymousConsentGate';
import {
	phone375Globals,
	phone390Globals,
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
 * ## Known deviations from the design (tracked in ORISO-Frontend#892)
 *
 * | | Figma | Shipped |
 * |---|---|---|
 * | Headline | "Herzlich Willkommen" | "Herzlich Willkommen**!**" |
 * | Modality | "einen **Chat** mit ihnen starten" | "einen **Video-Call** mit Ihnen starten" |
 * | Reject button | icon-only ✕ | "✕ Ich stimme nicht zu" with label |
 *
 * The "Video-Call" wording is the load-bearing one: this gate is what an
 * anonymous **chat** participant sees, so the shipped German *and* English copy
 * names the wrong modality. The text-labelled reject button is what makes the
 * row too wide — see the 375px story.
 *
 * It also carries `role="dialog" aria-modal="true"` while being rendered inline
 * by `SessionItemComponent`, which tells screen readers something that is not
 * true of its current placement.
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
	globals: phone390Globals,
	name: 'Mobile 390px — fits, without slack',
	render: (args) => (
		<div style={{ maxWidth: STORY_WIDTH_COMPACT }}>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: 'At 390px the two buttons still fit inside the card — but only just. Compare with the 375px story.'
			}
		}
	}
};

export const Mobile375LayoutDefect: Story = {
	globals: phone375Globals,
	name: 'Mobile 375px (iPhone SE) — LAYOUT DEFECT',
	render: (args) => (
		<div style={{ maxWidth: STORY_WIDTH_PHONE_SMALL }}>
			<AnonymousConsentGate {...args} />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: '**Two defects at 375px** — the iPhone SE / iPhone 8 width, still a real device.\n\n1. **The button row breaks out of the card**, starting left of the card edge instead of inside its padding. Per the house dialog rule the buttons should stack full-width below ~575px.\n2. **The headline breaks mid-word:** "Herzlich Willkomm|en!" — the shield icon keeps its fixed width and starves the headline column.\n\nRestoring the icon-only reject button from the design would likely resolve the first on its own. Tracked in ORISO-Frontend#892.'
			}
		}
	}
};

export const StackedButtonsTarget: Story = {
	globals: phone375Globals,
	name: 'Target: stacked buttons below ~575px',
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
		docs: {
			description: {
				story: '**Not the current behaviour — a target.** Applies the stacked arrangement via a story-local stylesheet so the intended result is visible next to the defect. Nothing here ships; the actual fix belongs in the component.'
			}
		}
	}
};
