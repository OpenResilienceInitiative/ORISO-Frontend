// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionListItemMenu } from './SessionListItemMenu';
import { ChatroomSettingsMenuVisibility } from './chatroomSettingsMenu';

afterEach(cleanup);

// SVG icons that fight JSDOM
vi.mock('../../resources/img/icons', () => ({
	MenuVerticalIcon: () => <span data-testid="menu-vertical-icon" />
}));
vi.mock('../../resources/img/icons/inbox.svg', () => ({
	ReactComponent: () => <span data-testid="archive-icon" />
}));
vi.mock('../../resources/img/icons/trash.svg', () => ({
	ReactComponent: () => <span data-testid="trash-icon" />
}));
vi.mock('../../resources/img/icons/i.svg', () => ({
	ReactComponent: () => <span data-testid="help-icon" />
}));
vi.mock('../../resources/img/icons/gear.svg', () => ({
	ReactComponent: () => <span data-testid="edit-group-chat-icon" />
}));
vi.mock('../legalLinks/LegalLinkMenuIcon', () => ({
	LegalLinkMenuIcon: () => <span data-testid="legal-link-icon" />
}));
vi.mock('../legalLinks/LegalLinks', () => ({
	default: ({
		children,
		filter,
		legalLinks
	}: {
		children: (
			label: string,
			url: string,
			rawLabel: string
		) => React.ReactNode;
		filter?: (link: any) => boolean;
		legalLinks: any[];
	}) => {
		const links = (legalLinks || []).filter(filter || (() => true));
		return (
			<>
				{links.map((link: any) => (
					<span key={link.label}>
						{children?.(link.label, link.getUrl({}), link.label)}
					</span>
				))}
			</>
		);
	}
}));

const noop = vi.fn();
const VISIBILITY_ALL_HIDDEN: ChatroomSettingsMenuVisibility = {
	showChatSettings: false,
	showArchive: false,
	showDearchive: false,
	showDelete: false,
	showRequestHelp: false
};

const menuIconRef = { current: null } as React.RefObject<HTMLButtonElement>;
const dropdownRef = { current: null } as React.RefObject<HTMLDivElement>;

interface RenderProps {
	flyoutOpen?: boolean;
	isAsker?: boolean;
	visibility?: ChatroomSettingsMenuVisibility;
	onChatSettings?: () => void;
	onArchive?: () => void;
	legalLinks?: any[];
}

const renderMenu = ({
	flyoutOpen = false,
	isAsker = false,
	visibility = VISIBILITY_ALL_HIDDEN,
	onChatSettings = noop,
	onArchive = noop,
	legalLinks = []
}: RenderProps = {}) =>
	render(
		<MemoryRouter>
			<SessionListItemMenu
				flyoutOpen={flyoutOpen}
				dropdownPosition={{ top: 0, left: 0 }}
				menuIconRef={menuIconRef}
				dropdownRef={dropdownRef}
				dropdownId="test-menu"
				dropdownLabel="Chat options"
				translate={((key: string) => key) as never}
				onMenuClick={noop}
				onMenuKeyDown={noop}
				onDropdownKeyDown={noop}
				isAsker={isAsker}
				visibility={visibility}
				onChatSettings={onChatSettings}
				onArchive={onArchive}
				onDearchive={noop}
				onDelete={noop}
				onRequestHelp={noop}
				legalLinks={legalLinks}
				agencyId={undefined}
				onLegalLinkClick={noop}
			/>
		</MemoryRouter>
	);

describe('SessionListItemMenu', () => {
	describe('trigger button', () => {
		it('renders with aria-haspopup="dialog"', () => {
			renderMenu();
			const btn = screen.getByRole('button', { name: 'Chat options' });
			expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
		});

		it('reflects flyoutOpen=false in aria-expanded', () => {
			renderMenu({ flyoutOpen: false });
			const btn = screen.getByRole('button', { name: 'Chat options' });
			expect(btn.getAttribute('aria-expanded')).toBe('false');
		});

		it('reflects flyoutOpen=true in aria-expanded', () => {
			renderMenu({ flyoutOpen: true });
			const btn = screen.getByRole('button', { name: 'Chat options' });
			expect(btn.getAttribute('aria-expanded')).toBe('true');
		});

		it('does not render the dropdown when flyoutOpen is false', () => {
			renderMenu({ flyoutOpen: false });
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('renders the dropdown in document.body via portal when flyoutOpen is true', () => {
			renderMenu({ flyoutOpen: true });
			const dialog = screen.getByRole('dialog', { name: 'Chat options' });
			expect(dialog.parentElement).toBe(document.body);
		});
	});

	describe('showChatSettings flag', () => {
		it('renders the Chat settings option when showChatSettings is true', () => {
			renderMenu({
				flyoutOpen: true,
				visibility: { ...VISIBILITY_ALL_HIDDEN, showChatSettings: true }
			});
			expect(
				document.querySelector(
					'[data-cy="session-list-menu-chat-settings"]'
				)
			).not.toBeNull();
		});

		it('calls onChatSettings exactly once when the option is clicked', () => {
			const handler = vi.fn();
			renderMenu({
				flyoutOpen: true,
				visibility: {
					...VISIBILITY_ALL_HIDDEN,
					showChatSettings: true
				},
				onChatSettings: handler
			});
			const btn = document.querySelector(
				'[data-cy="session-list-menu-chat-settings"]'
			) as HTMLElement;
			expect(btn).not.toBeNull();
			fireEvent.click(btn);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('does not render Chat settings when showChatSettings is false but showArchive is true', () => {
			renderMenu({
				flyoutOpen: true,
				visibility: {
					...VISIBILITY_ALL_HIDDEN,
					showChatSettings: false,
					showArchive: true
				}
			});
			expect(
				document.querySelector(
					'[data-cy="session-list-menu-chat-settings"]'
				)
			).toBeNull();
			expect(
				document.querySelector('[data-cy="session-list-menu-archive"]')
			).not.toBeNull();
		});
	});

	describe('asker branch', () => {
		it('renders legal link buttons instead of consultant actions when isAsker is true', () => {
			renderMenu({
				flyoutOpen: true,
				isAsker: true,
				legalLinks: [
					{
						label: 'login.legal.infoText.dataprotection',
						getUrl: () => 'https://example.com/privacy'
					},
					{
						label: 'login.legal.infoText.impressum',
						getUrl: () => 'https://example.com/imprint'
					}
				],
				visibility: { ...VISIBILITY_ALL_HIDDEN, showChatSettings: true }
			});

			// Chat settings option must not appear for asker
			expect(
				document.querySelector(
					'[data-cy="session-list-menu-chat-settings"]'
				)
			).toBeNull();

			// At least one legal link button should be present (chatFlyout.privacyPolicy key)
			expect(
				screen.queryAllByText('chatFlyout.privacyPolicy').length
			).toBeGreaterThanOrEqual(1);
		});
	});
});
