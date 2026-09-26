import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import messageMeta, { GroupIncoming } from './MessageItemComponent.stories';
import { mockUserData } from './MessageItemComponent.mocks';
import { saveMenuEffects } from '../../features/menu-effects/useMenuEffects';

const meta = {
	...messageMeta,
	title: 'Messages/Menu keyboard regression'
} satisfies Meta<typeof messageMeta.component>;
export default meta;
export const WithoutEffects: StoryObj<typeof meta> = {
	...GroupIncoming,
	play: async ({ canvasElement }) => {
		saveMenuEffects(false, mockUserData().userId);
		try {
			const trigger = canvasElement.querySelector<HTMLButtonElement>(
				'.messageItem__kebabButton'
			)!;
			await userEvent.click(trigger);
			const body = within(canvasElement.ownerDocument.body);
			await waitFor(() =>
				expect(body.getAllByRole('menuitem')[0]).toHaveFocus()
			);
			await userEvent.keyboard('{ArrowDown}');
			expect(body.getAllByRole('menuitem')[1]).toHaveFocus();
			await userEvent.keyboard('{Escape}');
			await waitFor(() => expect(trigger).toHaveFocus());
			expect(body.queryByRole('menu')).not.toBeInTheDocument();
			await userEvent.click(trigger);
			await waitFor(() =>
				expect(body.getAllByRole('menuitem')[0]).toHaveFocus()
			);
			await userEvent.click(canvasElement);
			await waitFor(() => expect(trigger).toHaveFocus());
			expect(body.queryByRole('menu')).not.toBeInTheDocument();
		} finally {
			saveMenuEffects(true, mockUserData().userId);
		}
	}
};
