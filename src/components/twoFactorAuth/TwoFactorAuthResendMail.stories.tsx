import type { Meta, StoryObj } from '@storybook/react-vite';
import { TwoFactorAuthResendMail } from './TwoFactorAuthResendMail';

/**
 * The "send me a new code" link under the one-time-code field on the login
 * screen (ORISO-UserService#1338).
 *
 * Four states, and the reason each one exists:
 *
 * - **Ready** — the link is clickable.
 * - **Waiting** — the realm refuses another mail for a few seconds, so the link
 *   counts down instead of inviting a click that does nothing. The code already
 *   in the user's inbox stays valid while it waits.
 * - **Sent** — shown only after the server has answered. Before this change it
 *   appeared the moment the button was clicked, so a failed send looked exactly
 *   like a successful one.
 * - **Failed** — a send that did not get through says so.
 *
 * The line about only the newest code being valid is always visible: starting a
 * second login silently kills the code from the first mail, and nothing used to
 * tell anyone that.
 */
const meta: Meta<typeof TwoFactorAuthResendMail> = {
	title: 'Login/Resend code link',
	component: TwoFactorAuthResendMail,
	parameters: {
		layout: 'centered'
	}
};

export default meta;
type Story = StoryObj<typeof TwoFactorAuthResendMail>;

export const Ready: Story = {
	args: {
		resendHandler: (callback) =>
			new Promise<void>((resolve) =>
				window.setTimeout(() => {
					callback();
					resolve();
				}, 600)
			)
	}
};

export const WaitingForTheCooldown: Story = {
	args: {
		cooldownSeconds: 30,
		resendHandler: (callback) => callback()
	}
};

export const SendFailed: Story = {
	args: {
		resendHandler: () => Promise.reject(new Error('smtp down'))
	}
};
