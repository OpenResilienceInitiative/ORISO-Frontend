import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { a11yExcept } from '../../../../.storybook/a11yExceptions';
import { phone390Globals } from '../../message/messageStoryShell';
import { PANEL_WIDTH_STORAGE_KEY } from '../stageLayout';
import { ConsultantSessionStage } from './ConsultantSessionStage';
import { stageRoute } from './chatStageFixtures';
import '../chatStage.styles.scss';

const meta = {
	title: 'Templates/ConversationComposer',
	component: ConsultantSessionStage,
	beforeEach: () => window.localStorage.removeItem(PANEL_WIDTH_STORAGE_KEY),
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		a11y: a11yExcept({
			'target-size': [
				'.sessionMenu__videoCallButtons .button__item',
				'.sessionMenu__icon'
			]
		})
	}
} satisfies Meta<typeof ConsultantSessionStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'desktop1440' } };
const getPaneEditor = (canvasElement: HTMLElement, pane: 'main' | 'side') => {
	const paneElement = canvasElement.querySelector<HTMLElement>(
		pane === 'main' ? '[data-cy="stage-main"]' : '[data-cy="stage-panel"]'
	);
	const composer = paneElement?.querySelector<HTMLElement>('form.textarea');
	const editor = composer?.querySelector<HTMLElement>(
		'[role="textbox"][contenteditable="true"]'
	);
	if (!composer || !editor) {
		throw new Error(`The ${pane} pane's composer is not ready`);
	}
	return { composer, editor };
};

const typeDraft = async (
	pane: ReturnType<typeof getPaneEditor>,
	text: string
) => {
	await userEvent.click(pane.editor);
	await userEvent.keyboard(text);
	await expect(pane.editor).toHaveTextContent(text);
	const send = within(pane.composer).getByRole('button', {
		name: /Nachricht senden|Send message/i
	});
	await waitFor(async () => {
		await expect(send).toBeVisible();
		await expect(send).toBeEnabled();
		await expect(send).toHaveAttribute('aria-disabled', 'false');
	});
};

export const SinglePane: Story = {
	globals: desktop,
	args: { panel: null },
	play: async ({ canvasElement }) => {
		const main = await waitFor(() => getPaneEditor(canvasElement, 'main'));
		await expect(
			canvasElement.querySelectorAll('form.textarea')
		).toHaveLength(1);
		await typeDraft(main, 'Draft in the main conversation');
	}
};

export const SplitPane: Story = {
	globals: desktop,
	args: { panel: 'supervision' },
	play: async ({ canvasElement }) => {
		const main = await waitFor(() => getPaneEditor(canvasElement, 'main'));
		const side = await waitFor(() => getPaneEditor(canvasElement, 'side'));
		await expect(
			canvasElement.querySelectorAll('form.textarea')
		).toHaveLength(2);

		await typeDraft(main, 'Draft in the main conversation');
		await expect(side.editor.textContent).toBe('');
		await typeDraft(side, 'Draft for supervision');
		await expect(main.editor).toHaveTextContent(
			'Draft in the main conversation'
		);
		await expect(main.editor).not.toHaveTextContent(
			'Draft for supervision'
		);
	}
};

export const Phone: Story = {
	globals: phone390Globals,
	args: { panel: 'supervision', phone: 'main' },
	play: async ({ canvasElement }) => {
		const main = await waitFor(() => getPaneEditor(canvasElement, 'main'));
		await expect(
			canvasElement.querySelectorAll('form.textarea')
		).toHaveLength(1);
		await typeDraft(main, 'Draft on the phone');
		await expect(
			main.composer.querySelector('[data-cy="composer-scroll-to-newest"]')
		).toBeVisible();
	}
};
