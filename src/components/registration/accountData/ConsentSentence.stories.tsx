import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { Box, Checkbox, FormControlLabel, FormGroup } from '@mui/material';
import { ConsentSentence } from './ConsentSentence';
import {
	LegalLinksContext,
	TProvidedLegalLink
} from '../../../globalState/provider/LegalLinksProvider';

/**
 * The sentence a help-seeker ticks at registration.
 *
 * Until EPIC ORISO-AgencyService#250 it was static frontend i18n assembled from
 * three fragments. `ADR-021` makes it a **field of the Beratungsstelle's
 * data-protection policy** that the Träger authors, with the substitution split
 * by who owns the data: the server replaces `{{Beratungsstelle}}` and
 * `{{Thema}}`, the client replaces `{{legal_links}}` — the link targets come
 * from this frontend's deployment configuration and the backend does not know
 * them.
 *
 * Three things these stories exist to show:
 *
 * 1. **Fallback is unchanged.** No consent text configured — and the vast
 *    majority of Träger will not have one on day one — renders exactly the
 *    pre-#250 sentence, cookie notice included, in its own `suffix`.
 * 2. **A Träger sentence replaces it** (`ADR-021` decision 2 — one sentence,
 *    one checkbox), with the agency name and topic already substituted and the
 *    links clickable.
 * 3. **The fixed addendum survives the replacement.** The cookie/authentication
 *    notice is rendered beneath the Träger text and is not editable, which is
 *    what keeps the platform's mandatory disclosure in place when the Träger
 *    text replaces the platform one.
 */
const legalLinks: TProvidedLegalLink[] = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.example/datenschutz'
	} as TProvidedLegalLink,
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.example/impressum'
	} as TProvidedLegalLink
];

const CheckboxRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<Box sx={{ maxWidth: 540, p: 2 }}>
		<FormGroup>
			<FormControlLabel
				sx={{ alignItems: 'flex-start' }}
				control={<Checkbox sx={{ mt: '-9px' }} />}
				label={children}
			/>
		</FormGroup>
	</Box>
);

const meta = {
	title: 'Components/Registration/ConsentSentence',
	component: ConsentSentence,
	tags: ['autodocs'],
	parameters: { layout: 'padded' },
	decorators: [
		(Story) => (
			<LegalLinksContext.Provider value={legalLinks}>
				<CheckboxRow>
					<Story />
				</CheckboxRow>
			</LegalLinksContext.Provider>
		)
	],
	args: { consentText: null }
} satisfies Meta<typeof ConsentSentence>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FallbackUnchanged: Story = {
	name: 'Fallback — today’s sentence, unchanged',
	args: { consentText: null },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Exactly two links, both registration-relevant, and no second cookie
		// sentence: the fallback carries the notice inside its own suffix, so
		// the fixed addendum must not be stacked on top of it.
		await expect(await canvas.findAllByRole('link')).toHaveLength(2);
		await expect(
			canvasElement.querySelector('[data-cy="consent-cookie-notice"]')
		).toBeNull();
	},
	parameters: {
		docs: {
			description: {
				story: 'What every Träger without an authored consent text keeps seeing. Byte-for-byte the pre-#250 markup — three i18n fragments around `<LegalLinks>`, `filter` restricted to the registration links.'
			}
		}
	}
};

export const TraegerSentence: Story = {
	name: 'Träger sentence — agency and topic substituted server-side',
	args: {
		consentText: {
			sentence:
				'Ich willige ein, dass die <strong>Beratungsstelle Musterstadt</strong> meine Angaben zum Thema <em>Suchtberatung</em> nach Maßgabe der {{legal_links}} verarbeitet.',
			versionId: 'v-7',
			cookieNotice: null
		}
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The name and the topic arrive already substituted — the client never
		// sees {{Beratungsstelle}} or {{Thema}} (ADR-021 decision 5).
		await expect(canvasElement.textContent?.includes('{{')).toBeFalsy();
		const policyLink = await canvas.findByRole('link', {
			name: /datenschutz/i
		});
		await expect(policyLink).toHaveAttribute(
			'href',
			'https://oriso.example/datenschutz'
		);
		await expect(policyLink).toHaveAttribute('target', '_blank');
		// The fixed addendum sits beneath the Träger text.
		await expect(
			canvasElement.querySelector('[data-cy="consent-cookie-notice"]')
		).not.toBeNull();
	},
	parameters: {
		docs: {
			description: {
				story: 'The Träger text **replaces** the platform sentence (`ADR-021` decision 2 — one sentence, one checkbox), and the cookie/authentication notice is rendered beneath it as a fixed, non-editable addendum. `{{legal_links}}` became real anchors that open in a new tab.'
			}
		}
	}
};

export const TraegerSentenceSanitized: Story = {
	name: 'Träger sentence with an XSS payload — stripped',
	args: {
		consentText: {
			sentence: [
				'Ich willige in die Verarbeitung nach {{legal_links}} ein.',
				'<script>window.__consentXss = true;</script>',
				'<img src="https://oriso.example/x.png" onerror="window.__consentXss = true">'
			].join(''),
			versionId: null,
			cookieNotice: null
		}
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvasElement.querySelector('script')).toBeNull();
		await expect(canvasElement.innerHTML).not.toContain('onerror');
		// …while the links the sentence consents to still work.
		await expect(await canvas.findAllByRole('link')).toHaveLength(2);
	},
	parameters: {
		docs: {
			description: {
				story: 'Backend-provided HTML goes through `sanitizeConsentHtml` — the allowlist every other authored legal text uses (`LegalContentRenderer`), minus `class`. The consent variant drops the attribute because `htmlParser` deletes any node classed `remove`, which would let an author publish a sentence that passes the mandatory-token validation and still shows no links (shared with the anonymous consent gate). The `<script>` and the `onerror` handler never reach the DOM; `a[href,target,rel]` does. The broken-image glyph is the point, not a defect: `<img>` is on the allowlist because authored legal texts legitimately embed images, so the element survives — stripped of its handler and pointing at a host that does not exist.'
			}
		}
	}
};

export const MissingMandatoryToken: Story = {
	name: 'Sentence without {{legal_links}} — links appended anyway',
	args: {
		consentText: {
			sentence:
				'Ich willige in die Verarbeitung meiner Angaben durch die Beratungsstelle Musterstadt ein.',
			versionId: null,
			cookieNotice: null
		}
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(await canvas.findAllByRole('link')).toHaveLength(2);
	},
	parameters: {
		docs: {
			description: {
				story: '`ADR-021` decision 2 makes the token mandatory at publication time, validated server-side. The client does not depend on that validator having run: a consent sentence that silently lost its link to the policy it consents to would be the worst failure mode here, so the links are appended instead of dropped.'
			}
		}
	}
};
