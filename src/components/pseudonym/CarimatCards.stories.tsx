import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import type { Pseudonym } from '../../utils/pseudonymGenerator';
import { AnonymousConsentGate } from './AnonymousConsentGate';
import { PrivacyMessageCard } from './PrivacyMessageCard';
import { PseudonymCard } from './PseudonymCard';
import './PseudonymCard.styles.scss';

/**
 * The Carimat bubbles that exist in the product today.
 *
 * Carimat is the platform's own voice: a name, a robot avatar and a kicker line
 * above the bubble. It is a **rendering identity, not a Matrix account**
 * (ADR-018 §3) — nothing here corresponds to a room member.
 *
 * Grouped in one file because the three cards share one visual grammar and are
 * meant to be compared: the kicker + bubble layout must stay identical across
 * them, otherwise the sequence reads as three different senders.
 *
 * Two things to look for in every story:
 *
 * 1. **The kicker line.** "Carimat" is currently a **hardcoded JSX string**, not
 *    an i18n key, in all three components. Switching the locale in the toolbar
 *    changes the subtitle but never the name.
 * 2. **The consent gate names the wrong modality.** The shipped copy
 *    (`anonymousConsent.description`) reads "Danach dürfen unsere Beraterinnen
 *    oder Berater einen **Video-Call** mit Ihnen starten" — but this gate is
 *    what an anonymous **chat** participant sees. English has the same defect
 *    ("start a video call with you"). Note that the gendered `Berater_innen`
 *    string in the component source is only the untranslated fallback and never
 *    reaches a user; the shipped text uses the doubled form.
 */
const meta = {
	title: 'Components/Carimat/Cards',
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'The shipped Carimat bubbles: choose-a-name, privacy notice, consent gate. Shared kicker + bubble grammar; see the docblock for the two known defects these stories make visible.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pseudonym: Pseudonym = {
	displayName: 'sanftes Alpaka Mika',
	animalLabel: 'Alpaka',
	name: 'Mika',
	avatar: {
		file: 'alpaca.svg',
		bg: '#E8DEF8',
		iconColor: '#1D1B20'
	}
};

const longPseudonym: Pseudonym = {
	displayName: 'außerordentlich nachdenkliches Schnabeltier Alexandra',
	animalLabel: 'Schnabeltier',
	name: 'Alexandra',
	avatar: {
		file: 'platypus.svg',
		bg: '#21005D',
		iconColor: '#FFFFFF'
	}
};

const consentLabelHtml =
	'Ich habe die <a href="#privacy">Datenschutzbestimmung</a> gelesen und bin einverstanden.';

export const ChooseDisplayName: Story = {
	name: 'Pseudonym card — typing animation',
	render: () => <PseudonymCard pseudonym={pseudonym} />,
	parameters: {
		docs: {
			description: {
				story: 'First Carimat bubble. Plays the typing dots, then writes the message. Reload the story to replay the animation.'
			}
		}
	}
};

export const ChooseDisplayNameStatic: Story = {
	name: 'Pseudonym card — no animation (skipTyping)',
	render: () => <PseudonymCard pseudonym={pseudonym} skipTyping />,
	parameters: {
		docs: {
			description: {
				story: 'The re-render state. This is the variant to use for visual regression, since the animated one is time-dependent.'
			}
		}
	}
};

export const ChooseDisplayNameLongName: Story = {
	name: 'Pseudonym card — long generated name',
	render: () => <PseudonymCard pseudonym={longPseudonym} skipTyping />,
	parameters: {
		docs: {
			description: {
				story: 'The generator produces long German compounds. The name must not overflow the bubble or collide with the avatar.'
			}
		}
	}
};

export const ChooseDisplayNameMobile: Story = {
	name: 'Pseudonym card — mobile (390px)',
	render: () => (
		<div style={{ maxWidth: 390 }}>
			<PseudonymCard pseudonym={longPseudonym} skipTyping />
		</div>
	),
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};

export const PrivacyNotice: Story = {
	name: 'Privacy card — typing animation',
	render: () => <PrivacyMessageCard />
};

export const PrivacyNoticeStatic: Story = {
	name: 'Privacy card — no animation',
	render: () => <PrivacyMessageCard skipTyping />
};

export const PrivacyNoticeMobile: Story = {
	name: 'Privacy card — mobile (390px)',
	render: () => (
		<div style={{ maxWidth: 390 }}>
			<PrivacyMessageCard skipTyping />
		</div>
	),
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};

export const TwoCardStack: Story = {
	name: 'Sequence — pseudonym then privacy',
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<PseudonymCard pseudonym={pseudonym} skipTyping />
			<PrivacyMessageCard skipTyping />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: 'How the two cards stack in `SessionItemComponent` once the pseudonym is confirmed. This is the existing precedent for rendering several bubbles from one step — the shape the Erstantwort generalises.'
			}
		}
	}
};

export const ConsentGate: Story = {
	name: 'Consent gate — idle',
	render: () => (
		<AnonymousConsentGate
			consentLabelHtml={consentLabelHtml}
			onAccept={() => {}}
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'The gate that blocks the composer until data-protection consent is confirmed. Two defects visible here: it carries `role="dialog" aria-modal="true"` although it is an inline card, and the copy promises a **video call** although this gate is what an anonymous *chat* participant sees. Tracked in ORISO-UserService#927.'
			}
		}
	}
};

export const ConsentGateBusy: Story = {
	name: 'Consent gate — accepting (busy)',
	render: () => (
		<AnonymousConsentGate
			consentLabelHtml={consentLabelHtml}
			onAccept={() => {}}
			busy
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'In-flight state. If the request fails the gate stays up — there is no error state of its own, which is worth remembering when wiring the server-side check.'
			}
		}
	}
};

export const ConsentGateMobile: Story = {
	name: 'Consent gate — mobile (390px)',
	render: () => (
		<div style={{ maxWidth: 390 }}>
			<AnonymousConsentGate
				consentLabelHtml={consentLabelHtml}
				onAccept={() => {}}
			/>
		</div>
	),
	parameters: {
		viewport: { defaultViewport: 'mobile1' },
		docs: {
			description: {
				story: 'At 390px the two buttons still fit inside the card, but only just — there is no slack left. See the 375px story below, where they break out.'
			}
		}
	}
};

export const ConsentGateIPhoneSE: Story = {
	name: 'Consent gate — 375px (iPhone SE) — LAYOUT DEFECT',
	render: () => (
		<div style={{ maxWidth: 375 }}>
			<AnonymousConsentGate
				consentLabelHtml={consentLabelHtml}
				onAccept={() => {}}
			/>
		</div>
	),
	parameters: {
		viewport: { defaultViewport: 'mobile1' },
		docs: {
			description: {
				story: '**Two layout defects at 375px** — the iPhone SE / iPhone 8 width, still a real device.\n\n1. **The button row breaks out of the card.** It starts left of the card edge instead of inside its padding. Per the house dialog rule the buttons should stack full-width below ~575px rather than staying side by side.\n2. **The headline breaks mid-word:** "Herzlich Willkomm|en!". The shield icon keeps its fixed width, leaving the headline column too narrow to fit "Willkommen".\n\n390px (previous story) still fits, so the breaking point sits between the two widths. Tracked in ORISO-UserService#927.'
			}
		}
	}
};
