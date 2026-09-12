// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupChatInfoDialog } from './GroupChatInfoDialog';
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
afterEach(cleanup);
describe('GroupChatInfoDialog', () => {
	it('names the modal and retains metadata and participant actions', () => {
		render(
			<GroupChatInfoDialog
				title="Circle"
				active
				onClose={vi.fn()}
				settings={[{ label: 'Agency', value: 'Team' }]}
				participants={<button>Manage participant</button>}
			/>
		);
		expect(
			screen.getByRole('dialog', {
				name: 'groupChat.info.dialog.circleTitle'
			})
		).toBeTruthy();
		expect(screen.getByText('Circle')).toBeTruthy();
		expect(screen.getByText('groupChat.listItem.activeLabel')).toBeTruthy();
		expect(screen.getByText('Team')).toBeTruthy();
		expect(
			screen.getByRole('button', { name: 'Manage participant' })
		).toBeTruthy();
	});

	it('explains read-only active settings without promising inline editing', () => {
		render(
			<GroupChatInfoDialog
				title="Circle"
				active
				onClose={vi.fn()}
				settings={[]}
				participants={null}
			/>
		);
		expect(
			screen.getByText('groupChat.info.dialog.circleDescription')
		).toBeTruthy();
		expect(
			screen.getByText('groupChat.info.dialog.activeSettings')
		).toBeTruthy();
		expect(
			screen.queryByText('groupChat.info.dialog.editableSettings')
		).toBeNull();
	});
	it('explains the existing editor when its action is available', () => {
		render(
			<GroupChatInfoDialog
				title="Circle"
				onClose={vi.fn()}
				settings={[]}
				participants={null}
				editAction={<button>Edit</button>}
			/>
		);
		expect(
			screen.getByText('groupChat.info.dialog.editableSettings')
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
	});
	it('names an internal group without describing it as a self-help circle', () => {
		render(
			<GroupChatInfoDialog
				title="Team"
				kind="team"
				onClose={vi.fn()}
				settings={[]}
				participants={null}
			/>
		);
		expect(
			screen.getByRole('dialog', {
				name: 'groupChat.info.dialog.teamTitle'
			})
		).toBeTruthy();
		expect(
			screen.getByText('groupChat.info.dialog.teamDescription')
		).toBeTruthy();
	});
	it('closes with Escape and the explicit close control', () => {
		const close = vi.fn();
		render(
			<GroupChatInfoDialog
				title="Circle"
				onClose={close}
				settings={[]}
				participants={null}
			/>
		);
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(close).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByTestId('m3-dialog-close'));
		expect(close).toHaveBeenCalledTimes(2);
	});
});
