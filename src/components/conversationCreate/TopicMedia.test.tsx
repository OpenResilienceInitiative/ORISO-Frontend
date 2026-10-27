// @vitest-environment oriso-jsdom
import * as React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { TopicMedia } from './TopicMedia';
import { CompactFormatRow } from './CompactFormatRow';
import { InternalChatCreateCard } from './internal/InternalChatCreateCard';
import { INTERNAL_CHAT_ARTWORK } from '../../resources/img/topics';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

describe('approved conversation artwork media', () => {
	it('offers both approved WebP widths and declares a 16:9 intrinsic size', () => {
		render(<TopicMedia topic="Migration" alt="Migration" />);
		const image = screen.getByRole('img', { name: 'Migration' });
		expect(image.getAttribute('src')).toContain('/640/03-migration.webp');
		expect(image.getAttribute('srcset')).toContain(
			'/640/03-migration.webp 640w'
		);
		expect(image.getAttribute('srcset')).toContain(
			'/1280/03-migration.webp 1280w'
		);
		expect(image.getAttribute('sizes')).toBeTruthy();
		expect(
			Number(image.getAttribute('width')) /
				Number(image.getAttribute('height'))
		).toBe(16 / 9);
	});

	it('keeps compact artwork decorative and the format row selectable', () => {
		const onSelect = vi.fn();
		const { container } = render(
			<CompactFormatRow
				icon={null}
				title="Interna besprechen"
				subtitle="Team"
				image={INTERNAL_CHAT_ARTWORK}
				onSelect={onSelect}
			/>
		);
		const image = container.querySelector('img');
		expect(image?.getAttribute('srcset')).toContain(
			'06-interner-gruppenchat.webp 1280w'
		);
		expect(image?.getAttribute('sizes')).toBe('84px');
		expect(image?.getAttribute('alt')).toBe('');
		expect(image?.getAttribute('aria-hidden')).toBe('true');
		fireEvent.click(
			screen.getByRole('button', { name: 'Interna besprechen Team' })
		);
		expect(onSelect).toHaveBeenCalledOnce();
	});

	it('keeps selected people removable above the approved internal artwork', () => {
		const onDraftChange = vi.fn();
		const { container } = render(
			<InternalChatCreateCard
				people={[{ id: 'bob', label: 'Bob' }]}
				draft={{ name: 'Team', selectedIds: ['bob'] }}
				onDraftChange={onDraftChange}
				onCreate={() => undefined}
			/>
		);
		const image = screen.getByRole('img', {
			name: 'groupChat.internal.title'
		});
		expect(image.getAttribute('src')).toContain(
			'/640/06-interner-gruppenchat.webp'
		);
		expect(image.getAttribute('srcset')).toContain(
			'/1280/06-interner-gruppenchat.webp 1280w'
		);
		expect(
			container.querySelector('.formatCard__mediaContent--dimmed')
		).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.internal.removePerson'
			})
		);
		expect(onDraftChange).toHaveBeenCalledWith({
			name: 'Team',
			selectedIds: []
		});
	});
});
