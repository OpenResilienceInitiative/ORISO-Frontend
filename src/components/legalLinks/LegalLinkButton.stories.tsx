import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LegalLinkButton } from './LegalLinkButton';
import '../stageLayout/StageLayout.styles.scss';

/**
 * The Imprint / Privacy entries in the login stage footer.
 *
 * Before this, they were `window.open(url, '_blank')`: the configured legal URL
 * points at `/impressum` and `/datenschutz`, which are routes of this very app,
 * so clicking one booted the whole SPA a second time in a new tab. They now open
 * the shared {@link ../m3Dialog/M3Dialog}, the Admin panel's dialog anatomy, and
 * the "open the full text" link inside it is a router navigation whenever the
 * target is same-origin.
 *
 * Click an entry in the story to see the dialog — it is the real component, with
 * the real platform-level placeholder text from the translation catalogue.
 */
const meta = {
	title: 'Login/Legal link button',
	component: LegalLinkButton,
	parameters: { layout: 'centered' },
	/* No router here: `.storybook/preview.tsx` already wraps every story in one,
	   and a nested router throws. That is also why the in-app navigation below
	   is live in Storybook rather than degrading to a plain link. */
	decorators: [
		(Story) => (
			/* The footer strip's own class is `position: absolute` inside the
			   stage; reproducing only its typography keeps the entry clickable
			   in isolation. */
			<div
				className="stageLayout__legalLinks"
				style={{ display: 'flex', gap: '8px', padding: '16px' }}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof LegalLinkButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Imprint: Story = {
	args: {
		label: 'Impressum',
		rawLabel: 'login.legal.infoText.impressum',
		url: '/impressum',
		textClassName: 'stageLayout__legalLinksItem'
	}
};

export const Privacy: Story = {
	args: {
		label: 'Datenschutzerklärung',
		rawLabel: 'login.legal.infoText.dataprotection',
		url: '/datenschutz',
		textClassName: 'stageLayout__legalLinksItem'
	}
};

/**
 * A deployment that points `REACT_APP_LEGAL_IMPRINT_URL` at the operator's own
 * website. That is genuinely somewhere else, so it still opens a new tab.
 */
export const ExternalTarget: Story = {
	args: {
		label: 'Impressum',
		rawLabel: 'login.legal.infoText.impressum',
		url: 'https://traeger.example/impressum',
		textClassName: 'stageLayout__legalLinksItem'
	}
};
