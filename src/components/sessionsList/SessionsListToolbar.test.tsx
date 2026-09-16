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
		MailFilterIcon: Icon,
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

		const createLink = screen.getByRole('link', {
			name: 'sessionList.createChat.buttonTitle'
		});

		expect(createLink).toBeTruthy();
		expect(createLink.classList).not.toContain(
			'sessionsListToolbar__chip--iconOnly'
		);
		expect(
			createLink.querySelector('.sessionsListToolbar__chipLabel')
				?.textContent
		).toBe('Create');
		expect(
			createLink
				.querySelector('.sessionsListToolbar__chipLabel')
				?.hasAttribute('aria-hidden')
		).toBe(false);
	});

	it('carries the product-tour anchor on the Create action', () => {
		renderToolbar(true);

		const createLink = screen.getByRole('link', {
			name: 'sessionList.createChat.buttonTitle'
		});

		expect(createLink.getAttribute('data-tour-target')).toBe(
			'groupchat-create-button'
		);
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

describe('agency counselling modality chip (ORISO-Frontend#985)', () => {
	it('labels the modality filter "Mail" even without a loaded translation', () => {
		renderToolbar(true);

		expect(screen.getByText('Mail')).toBeDefined();
		expect(screen.queryByText('Nearby')).toBeNull();
	});
});

describe('SessionsListToolbar display filter (#1377 slice 4)', () => {
	const renderWithDisplayFilter = (
		hiddenKindChips: Partial<Record<string, boolean>>,
		customised = false
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
					showCreateGroupChatAction={false}
					showSupervisionChip
					showGroupChip
					showInternalGroupChip
					showLiveChatChip
					createGroupChatPath="/sessions/create"
					archiveTabPath="/sessions/archive"
					archiveTabActive={false}
					createGroupChatActive={false}
					hiddenKindChips={hiddenKindChips}
					displayFilter={{
						label: 'Anzeige-Filter',
						customisedLabel: 'Filter angepasst',
						customised,
						open: false,
						controlsId: 'dialog-id',
						onOpen: vi.fn()
					}}
				/>
			</MemoryRouter>
		);
	const chip = (container: HTMLElement, id: string) =>
		container.querySelector(`[data-cy="sessions-list-chip-${id}"]`);

	it('renders the pinned tune button outside the scrolling chips', () => {
		const { container } = renderWithDisplayFilter({}, true);
		const button = screen.getByRole('button', { name: 'Anzeige-Filter' });
		expect(button.getAttribute('aria-controls')).toBe('dialog-id');
		expect(
			container
				.querySelector('.filterChipRow__trailing')
				?.contains(button)
		).toBe(true);
		expect(
			container
				.querySelector('[data-cy="sessions-list-chips"]')
				?.contains(button)
		).toBe(false);
		expect(
			button.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
	});

	it('suppresses kind chips the display filter gates, never unread/drafts', () => {
		const { container } = renderWithDisplayFilter({
			groups: true,
			supervision: true
		});
		expect(chip(container, 'groups')).toBeNull();
		expect(chip(container, 'supervision')).toBeNull();
		expect(chip(container, 'internal-group')).not.toBeNull();
		expect(chip(container, 'unread')).not.toBeNull();
		expect(chip(container, 'drafts')).not.toBeNull();
	});
});

describe('SessionsListToolbar chip menu (Frank 2026-09-16)', () => {
	const renderMenu = (
		props: Partial<React.ComponentProps<typeof SessionsListToolbar>>
	) =>
		render(
			<MemoryRouter>
				<SessionsListToolbar
					translate={(key, fallback) => fallback ?? key}
					searchValue=""
					onSearchChange={vi.fn()}
					activeChip={null}
					onChipToggle={vi.fn()}
					showConsultantActions
					showCreateGroupChatAction={false}
					showSupervisionChip
					showGroupChip={false}
					showInternalGroupChip
					showLiveChatChip
					createGroupChatPath="/sessions/create"
					archiveTabPath="/sessions/archive"
					archiveTabActive={false}
					createGroupChatActive={false}
					chipCounts={{ unread: 0, drafts: 3, nearby: 2, groups: 1 }}
					{...props}
				/>
			</MemoryRouter>
		);
	const chipNames = (container: HTMLElement) =>
		Array.from(
			container.querySelectorAll('[data-cy^="sessions-list-chip-"]')
		).map((el) =>
			el.getAttribute('data-cy')!.replace('sessions-list-chip-', '')
		);

	it('shows a Träger-deactivated kind chip locked even though its module is off, and routes its click to the notice', () => {
		const onChipToggle = vi.fn();
		const onDeactivatedChipClick = vi.fn();
		const { container } = renderMenu({
			onChipToggle,
			deactivatedKindChips: { groups: true },
			deactivatedChipLabel: (name) => `${name} (vom Träger abgeschaltet)`,
			onDeactivatedChipClick
		});
		const groups = screen.getByRole('button', {
			name: 'Conversation circle (1) (vom Träger abgeschaltet)'
		});
		expect(groups.getAttribute('aria-disabled')).toBe('true');
		groups.click();
		expect(onChipToggle).not.toHaveBeenCalled();
		expect(onDeactivatedChipClick).toHaveBeenCalledWith('groups');
		expect(chipNames(container)).toContain('groups');
	});

	it('floats chips with unread items left when auto-sort is on; drafts never count as unread', () => {
		const { container } = renderMenu({
			chipAutoSort: true,
			chipCounts: { unread: 0, drafts: 3, nearby: 2, supervision: 1 }
		});
		// nearby (2) and supervision (1) first, then the rest in toolbar order
		expect(chipNames(container).slice(0, 2)).toEqual([
			'nearby',
			'supervision'
		]);
		expect(chipNames(container)).toContain('drafts');
		expect(chipNames(container).indexOf('drafts')).toBeGreaterThan(1);
	});

	it('renders compact text chips without icons in the text view', () => {
		const { container } = renderMenu({ chipView: 'text' });
		const mail = screen.getByRole('button', { name: 'Mail (2)' });
		expect(mail.className).toContain('sessionsListToolbar__chip--text');
		expect(mail.textContent).toContain('Mail');
		expect(
			container.querySelectorAll(
				'[data-cy="sessions-list-chips"] .sessionsListToolbar__chipIconSvg'
			).length
		).toBe(0);
	});
});
