import type { Meta, StoryObj } from '@storybook/react';

import { AUTHORITIES } from '../../globalState';
import type { UserDataInterface } from '../../globalState/interfaces';
import { FurtherSteps } from './FurtherSteps';
import { mockUserData } from './MessageItemComponent.mocks';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageContexts
} from './messageStoryShell';
import './furtherSteps.styles.scss';

/**
 * The "So geht es weiter" card: three illustrated steps, plus up to two
 * optional calls to action.
 *
 * ## Why this component has no props
 *
 * Everything it shows is derived from `UserDataContext`:
 *
 * - `showAddEmail = !userData.email`
 * - `is2faEnabledAndNotActive = twoFactorAuth.isEnabled && !twoFactorAuth.isActive`
 * - `isConsultant` swaps the CTAs for an explanatory hint
 *
 * So the stories vary the mocked user, not the args. That is also the pattern
 * ADR-018 keeps for the Erstantwort Bausteine: an action block owns no state of
 * its own, it reads state that already exists and hides its button once the
 * thing is done.
 *
 * ## Status
 *
 * **This component does not currently reach anybody.** It renders only for
 * `alias.messageType === 'FURTHER_STEPS'`, and no Matrix code path produces an
 * `alias` object. It is kept here as the visual reference for the Erstantwort
 * rebuild (ORISO-Frontend#772), not as documentation of live behaviour.
 */
const meta = {
	title: 'Components/Chat/FurtherSteps',
	component: FurtherSteps,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		userData: mockUserData({
			grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
			userId: 'asker-storybook',
			displayName: 'sanftes Alpaka Mika'
		}),
		docs: {
			description: {
				component:
					'Post-enquiry card with three steps and two optional CTAs (leave an e-mail, protect the account). Not currently reachable in the product — see the component docblock.'
			}
		}
	},
	decorators: [
		(Story, ctx) =>
			withMessageContexts(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof FurtherSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

const asker = (overrides: Partial<UserDataInterface> = {}) =>
	mockUserData({
		grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
		userId: 'asker-storybook',
		displayName: 'sanftes Alpaka Mika',
		...overrides
	});

export const BothCallsToAction: Story = {
	name: 'Advice seeker — both CTAs',
	parameters: {
		userData: asker({
			twoFactorAuth: {
				isEnabled: true,
				isActive: false,
				isShown: true,
				secret: '',
				qrCode: ''
			}
		}),
		docs: {
			description: {
				story: 'No e-mail on file and 2FA available but not switched on: both offers are shown. This is the state a freshly registered advice seeker is in.'
			}
		}
	}
};

export const EmailAlreadyGiven: Story = {
	name: 'E-mail already given — only 2FA CTA',
	parameters: {
		userData: asker({
			email: 'someone@example.org',
			twoFactorAuth: {
				isEnabled: true,
				isActive: false,
				isShown: true,
				secret: '',
				qrCode: ''
			}
		}),
		docs: {
			description: {
				story: 'The e-mail block disappears the moment an address exists — regardless of *how* it was added. That retroactive "already done" behaviour is intentional (ADR-018 §4).'
			}
		}
	}
};

export const TwoFactorAlreadyActive: Story = {
	name: '2FA already active — only e-mail CTA',
	parameters: {
		userData: asker({
			twoFactorAuth: {
				isEnabled: true,
				isActive: true,
				isShown: true,
				secret: '',
				qrCode: ''
			}
		})
	}
};

export const NothingLeftToDo: Story = {
	name: 'Nothing left to do — steps only',
	parameters: {
		userData: asker({
			email: 'someone@example.org',
			twoFactorAuth: {
				isEnabled: true,
				isActive: true,
				isShown: true,
				secret: '',
				qrCode: ''
			}
		}),
		docs: {
			description: {
				story: 'Both offers satisfied. Worth pinning: the card must still read as a complete message, not as an empty shell with a dangling headline.'
			}
		}
	}
};

export const ConsultantView: Story = {
	name: 'Counsellor view — hint instead of CTAs',
	parameters: {
		userData: mockUserData(),
		docs: {
			description: {
				story: 'A counsellor sees the same three steps plus `furtherSteps.consultant.info`, and neither CTA — the offers belong to the advice seeker.'
			}
		}
	}
};

export const NoEmailTrägerOptOut: Story = {
	name: 'E-mail invitation switched off (U25 case)',
	parameters: {
		userData: asker({
			email: 'suppressed@example.org',
			twoFactorAuth: {
				isEnabled: true,
				isActive: false,
				isShown: true,
				secret: '',
				qrCode: ''
			}
		}),
		docs: {
			description: {
				story: 'Approximates what a Träger that forbids e-mail collection should see: no e-mail invitation, 2FA still offered. **Today this state is not reachable by configuration** — the e-mail block is gated only on "has none yet" (`FurtherSteps.tsx:159`). The switch that would produce it is ORISO-Admin#602.'
			}
		}
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px) — both CTAs',
	globals: phone390Globals,
	parameters: {
		...mobileParameters,
		userData: asker({
			twoFactorAuth: {
				isEnabled: true,
				isActive: false,
				isShown: true,
				secret: '',
				qrCode: ''
			}
		}),
		docs: {
			description: {
				story: 'At 390px the three-step row with its arrow illustrations is the tightest part of this card. Check that the arrows do not collapse the step text into a narrow column.'
			}
		}
	}
};
