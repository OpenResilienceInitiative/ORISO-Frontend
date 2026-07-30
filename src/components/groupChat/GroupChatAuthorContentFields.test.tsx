// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiTranslateGroupChatAuthorContent } from '../../api/apiGroupChatAuthorTranslation';
import { GroupChatAuthorContentDraft } from './groupChatAuthorContent';
import { GroupChatAuthorContentFields } from './GroupChatAuthorContentFields';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

// Vitest has no SVGR transform: stub the icons the rule editor renders.
vi.mock('../../resources/img/icons/close.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../resources/img/icons/plus-mui.svg', () => ({
	ReactComponent: () => null,
	default: () => null
}));
vi.mock('../../api/apiGroupChatAuthorTranslation', () => ({
	apiTranslateGroupChatAuthorContent: vi.fn()
}));

const draft = (hint = 'Willkommen'): GroupChatAuthorContentDraft => ({
	sourceLanguage: 'de',
	hintMessageTranslations: { de: hint },
	groupChatRulesTranslations: { de: ['Respektvoll bleiben'] }
});

describe('GroupChatAuthorContentFields', () => {
	afterEach(cleanup);

	it('keeps the selected language valid when active languages change', () => {
		const { rerender } = render(
			<GroupChatAuthorContentFields
				activeLanguages={['de', 'en']}
				value={draft()}
				onChange={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole('tab', { name: 'EN' }));

		rerender(
			<GroupChatAuthorContentFields
				activeLanguages={['de']}
				value={draft()}
				onChange={vi.fn()}
			/>
		);

		expect(
			screen
				.getByRole('tab', { name: 'DE' })
				.getAttribute('aria-selected')
		).toBe('true');
	});

	it('connects language tabs to their tab panel', () => {
		render(
			<GroupChatAuthorContentFields
				activeLanguages={['de', 'en']}
				value={draft()}
				onChange={vi.fn()}
			/>
		);

		const tab = screen.getByRole('tab', { name: 'DE' });
		const panel = screen.getByRole('tabpanel');
		expect(tab.getAttribute('aria-controls')).toBe(panel.id);
		expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
	});

	it('moves tab selection and focus with arrow keys', () => {
		render(
			<GroupChatAuthorContentFields
				activeLanguages={['de', 'en']}
				value={draft()}
				onChange={vi.fn()}
			/>
		);
		const german = screen.getByRole('tab', { name: 'DE' });
		const english = screen.getByRole('tab', { name: 'EN' });

		german.focus();
		fireEvent.keyDown(german, { key: 'ArrowRight' });

		expect(english.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(english);
	});

	it('ignores a translation response after the source content changes', async () => {
		let resolveTranslation!: (value: any) => void;
		vi.mocked(apiTranslateGroupChatAuthorContent).mockReturnValueOnce(
			new Promise((resolve) => {
				resolveTranslation = resolve;
			})
		);
		const onChange = vi.fn();
		const { rerender } = render(
			<GroupChatAuthorContentFields
				activeLanguages={['de', 'en']}
				value={draft()}
				onChange={onChange}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.create.authorContent.translate'
			})
		);

		rerender(
			<GroupChatAuthorContentFields
				activeLanguages={['de', 'en']}
				value={draft('Neu bearbeitet')}
				onChange={onChange}
			/>
		);
		resolveTranslation({ translations: { en: ['Stale'] } });
		await Promise.resolve();

		expect(onChange).not.toHaveBeenCalled();
	});

	it('shows an error when translation request construction fails synchronously', async () => {
		render(
			<GroupChatAuthorContentFields
				activeLanguages={['de', 'en']}
				value={
					{
						...draft(),
						hintMessageTranslations: null
					} as any
				}
				onChange={vi.fn()}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.create.authorContent.translate'
			})
		);

		expect(await screen.findByRole('alert')).toBeTruthy();
	});
});
