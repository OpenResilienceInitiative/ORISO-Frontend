import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ErstantwortSequence } from './ErstantwortSequence';
import { SaveCredentialsCard } from './SaveCredentialsCard';
import {
	ERSTANTWORT_PAYLOAD_VERSION,
	SYSTEM_NOTIFICATION_FIRST_RESPONSE
} from './erstantwortPayload';
import { resolveErstantwortBausteine } from './erstantwortResolve';
import { SYSTEM_NOTIFICATION_PREFIX } from '../message/messageConstants';
import { phone390Globals } from '../message/messageStoryShell';
import './ErstantwortSequence.styles.scss';

/**
 * **Erstantwort** — what the platform itself says to a ratsuchende person around
 * their first contact (ADR-018).
 *
 * One persisted `[SYSTEM_NOTIFICATION]` event with a versioned payload, rendered
 * here as a staged sequence of Carimat bubbles with typing dots between them.
 * **Carimat is a rendering identity, not a Matrix account** — nothing in these
 * stories corresponds to a room member, and no bot holds a Megolm key.
 *
 * These stories are the review surface for the whole sequence: reviewing it in
 * the running app needs an enquiry, a counsellor and a backend that emits the
 * event, and reviewing the *animation* there is close to impossible.
 *
 * Two properties worth checking in every story:
 *
 * - **No gendered notation anywhere.** ADR-018 §7 makes the platform voice
 *   gender-neutral by reformulation — "eine passende Ansprechperson", never
 *   `Berater*in` / `Berater_innen` / `Berater:innen`. `erstantwortCatalogue.test.ts`
 *   pins this; the stories are where it is seen.
 * - **An action Baustein carries no state of its own.** Its button disappears
 *   once the underlying state is satisfied — compare `PlatformDefaults` with
 *   `EverythingAlreadyDone` below.
 */
const meta = {
	title: 'Components/Chat/Erstantwort',
	component: ErstantwortSequence,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'The Erstantwort Baustein sequence: one persisted event, staged Carimat bubbles, actions that read live state.'
			}
		}
	},
	/* Action buttons only render when a handler exists — no handler, no no-op
	   button. In the app `ErstantwortMessage` always supplies one, so the
	   stories do too, otherwise they would show a version of the sequence
	   nobody ever sees. */
	args: { onAction: () => undefined },
	argTypes: {
		staggerMs: {
			control: { type: 'range', min: 200, max: 3000, step: 100 },
			description:
				'Delay between two bubbles, and the duration of the typing dots that stand in for the next one.'
		},
		skipAnimation: {
			control: 'boolean',
			description:
				'Render the whole sequence at once — what a re-render of chat history does.'
		}
	}
} satisfies Meta<typeof ErstantwortSequence>;

export default meta;
type Story = StoryObj<typeof meta>;

const translate = (_key: string, defaultValue?: string) => defaultValue ?? '';

const platformDefaults = (state: {
	hasEmail: boolean;
	isTwoFactorEnabled: boolean;
	isTwoFactorActive: boolean;
	isAskerEmailEnabled?: boolean;
}) =>
	resolveErstantwortBausteine({
		trigger: 'AFTER_FIRST_MESSAGE',
		context: { conversationType: 'AGENCY_COUNSELLING' },
		translate,
		state
	}).bausteine;

const OPEN_STATE = {
	hasEmail: false,
	isTwoFactorEnabled: true,
	isTwoFactorActive: false
};

/**
 * The full platform-default sequence, staged. This is what an advice seeker in
 * Agency Counselling sees after sending the first message, before any Träger has
 * authored anything (the Admin editor is ORISO-Admin#601).
 *
 * Note the ordering, which is platform-owned and not configurable: the two
 * safety-bearing Bausteine — "send us no personal data" and the emergency
 * numbers — come **before** every optional action, because consent has to
 * precede data transmission.
 */
export const PlatformDefaults: Story = {
	args: {
		bausteine: platformDefaults(OPEN_STATE),
		staggerMs: 1400,
		skipAnimation: false
	}
};

/**
 * The same sequence with the stagger switched off — how it looks when chat
 * history re-renders and nobody should sit through the animation twice.
 */
export const AllAtOnce: Story = {
	args: { ...PlatformDefaults.args, skipAnimation: true }
};

/**
 * **Live Chat.** The modality assignment removes what cannot be true there:
 * Live Chat has neither teams nor case handover, so "who reads along" has
 * nothing to render, and it is synchronous, so a reply deadline would be a
 * promise the system cannot keep. The two safety Bausteine stay — they apply
 * everywhere.
 */
export const LiveChat: Story = {
	args: {
		bausteine: resolveErstantwortBausteine({
			trigger: 'AFTER_FIRST_MESSAGE',
			context: { conversationType: 'LIVE_CHAT' },
			translate,
			state: OPEN_STATE
		}).bausteine,
		skipAnimation: true
	}
};

/**
 * **Actions already satisfied.** The person already has an e-mail address and
 *2FA is active, so both buttons are gone — while the wording stays, because it
 * is part of what they were told. Completion is read live from state that
 * already exists; no Baustein stores a "done" flag (ADR-018 §4).
 */
export const EverythingAlreadyDone: Story = {
	args: {
		bausteine: platformDefaults({
			hasEmail: true,
			isTwoFactorEnabled: true,
			isTwoFactorActive: true
		}),
		skipAnimation: true
	}
};

/**
 * **Träger switched the e-mail invitation off** (ORISO-Admin#602 switch 2).
 * The whole Baustein disappears, not just its button — leaving the prose would
 * reproduce exactly the contradiction the switch exists to remove: the chat
 * inviting an address the Träger has decided not to collect. U25 is the
 * reference case for this configuration.
 */
export const EmailInvitationSwitchedOff: Story = {
	args: {
		bausteine: platformDefaults({
			...OPEN_STATE,
			isAskerEmailEnabled: false
		}),
		skipAnimation: true
	}
};

/**
 * **Post-dispatch Bausteine** (ORISO-Frontend#825), offered in Agency
 * Counselling and Self-Help Groups and never in Live Chat. Credential saving is
 * the only remaining safety net for a Träger that switches the e-mail
 * invitation off, which makes it more important there, not less.
 */
export const AfterEnquiryDispatched: Story = {
	args: {
		bausteine: resolveErstantwortBausteine({
			trigger: 'AFTER_ENQUIRY_DISPATCHED',
			context: { conversationType: 'AGENCY_COUNSELLING' },
			translate,
			state: OPEN_STATE
		}).bausteine,
		skipAnimation: true,
		slots: {
			saveCredentials: <SaveCredentialsCard userName="katze_mika_1234" />
		}
	}
};

/**
 * **Credential saving, close up.** Three things to check, each a decision
 * rather than a detail:
 *
 * - **No download anywhere.** A `zugangsdaten.txt` in the download folder is a
 *   lasting trace on a device somebody else may use — hence the shared-device
 *   warning too.
 * - **The password is not shown, and is not claimed to be.** It is hashed in
 *   Keycloak and gone from the browser after the post-registration redirect;
 *   "Passwort jetzt setzen" reaches the existing profile flow, where the person
 *   chooses one they actually know and Keycloak overwrites the generated one.
 * - **The login name field carries `name="username"` and
 *   `autocomplete="username"`**, which is what lets a password manager
 *   associate the credential. The Credential Management API is Chromium-only
 *   and is deliberately *not* the mechanism.
 */
export const SaveCredentials: Story = {
	args: {
		skipAnimation: true,
		bausteine: resolveErstantwortBausteine({
			trigger: 'AFTER_ENQUIRY_DISPATCHED',
			context: { conversationType: 'AGENCY_COUNSELLING' },
			translate,
			state: OPEN_STATE
		}).bausteine.filter((baustein) => baustein.id === 'saveCredentials'),
		slots: {
			saveCredentials: <SaveCredentialsCard userName="katze_mika_1234" />
		}
	}
};

/**
 * **A single Baustein with derived link targets.** Derived content is rendered
 * from configuration, never from a text field, so the department's privacy
 * policy and imprint cannot be contradicted by something a Träger typed.
 */
export const DerivedLinks: Story = {
	args: {
		skipAnimation: true,
		bausteine: [
			{
				id: 'dataProtection',
				body: 'Wie wir mit Ihren Daten umgehen, steht in der Datenschutzerklärung.',
				links: [
					{
						label: 'Datenschutzerklärung',
						url: 'https://example.test/datenschutz'
					},
					{
						label: 'Impressum',
						url: 'https://example.test/impressum'
					}
				]
			}
		]
	}
};

/**
 * **An event from a newer server.** The payload declares a version this
 * frontend does not know, so nothing renders at all rather than a
 * half-understood sequence. The event stays persisted; a later frontend renders
 * it correctly.
 */
export const UnsupportedPayloadVersion: Story = {
	args: {
		skipAnimation: true,
		bausteine: resolveErstantwortBausteine({
			rawMessage: `${SYSTEM_NOTIFICATION_PREFIX}${JSON.stringify({
				type: SYSTEM_NOTIFICATION_FIRST_RESPONSE,
				version: ERSTANTWORT_PAYLOAD_VERSION + 1,
				bausteine: [{ id: 'greeting', body: 'Aus der Zukunft.' }]
			})}`,
			translate,
			state: OPEN_STATE
		}).bausteine
	},
	parameters: {
		docs: {
			description: {
				story: 'Renders nothing. That is the correct outcome, not a broken story.'
			}
		}
	}
};

/** The sequence at phone width — the majority surface for advice seekers. */
export const Mobile: Story = {
	args: { ...PlatformDefaults.args, skipAnimation: true },
	globals: phone390Globals
};
