// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsListToolbar } from './SessionsListToolbar';

afterEach(cleanup);

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

const renderToolbar = (
	showCreateGroupChatAction: boolean,
	{
		showGroupChip = true,
		showInternalGroupChip = true
	}: { showGroupChip?: boolean; showInternalGroupChip?: boolean } = {}
) =>
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
				showGroupChip={showGroupChip}
				showInternalGroupChip={showInternalGroupChip}
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

	it('hides group filters when their tenant modules are disabled', () => {
		renderToolbar(false, {
			showGroupChip: false,
			showInternalGroupChip: false
		});

		expect(
			screen.queryByRole('button', {
				name: 'Conversation circle'
			})
		).toBeNull();
		expect(
			screen.queryByRole('button', {
				name: 'Internal group chat'
			})
		).toBeNull();
	});

	it('shows group filters when their tenant modules are enabled', () => {
		renderToolbar(true, {
			showGroupChip: true,
			showInternalGroupChip: true
		});

		expect(
			screen.getByRole('button', {
				name: 'Conversation circle'
			})
		).toBeTruthy();
		expect(
			screen.getByRole('button', {
				name: 'Internal group chat'
			})
		).toBeTruthy();
	});
});
