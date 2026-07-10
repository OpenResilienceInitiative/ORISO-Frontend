// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SessionsListToolbar } from './SessionsListToolbar';

vi.mock('./SessionToolbarFilterIcons', () => {
	const Icon = () => <span aria-hidden />;
	return {
		ArchiveFilterIcon: Icon,
		CreateChatFilterIcon: Icon,
		DraftFilterIcon: Icon,
		GroupFilterIcon: Icon,
		InternalGroupFilterIcon: Icon,
		LiveChatFilterIcon: Icon,
		NearbyFilterIcon: Icon,
		SupervisionFilterIcon: Icon,
		UnreadFilterIcon: Icon
	};
});

const renderToolbar = (showCreateGroupChatAction: boolean) =>
	render(
		<MemoryRouter>
			<SessionsListToolbar
				translate={(key) => key}
				searchValue=""
				onSearchChange={vi.fn()}
				activeChip={null}
				onChipToggle={vi.fn()}
				showConsultantActions
				showCreateGroupChatAction={showCreateGroupChatAction}
				showSupervisionChip={false}
				createGroupChatPath="/sessions/create"
				archiveTabPath="/sessions/archive"
				archiveTabActive={false}
				createGroupChatActive={false}
			/>
		</MemoryRouter>
	);

describe('SessionsListToolbar group-chat feature gate', () => {
	it('hides Create while preserving ordinary consultant actions when disabled', () => {
		renderToolbar(false);

		expect(
			screen.queryByRole('link', {
				name: 'sessionList.createChat.buttonTitle'
			})
		).toBeNull();
		expect(
			screen.getByRole('link', {
				name: 'sessionList.view.archive.tab'
			})
		).toBeTruthy();
	});

	it('shows Create when the tenant enables the feature', () => {
		renderToolbar(true);

		expect(
			screen.getByRole('link', {
				name: 'sessionList.createChat.buttonTitle'
			})
		).toBeTruthy();
	});
});
