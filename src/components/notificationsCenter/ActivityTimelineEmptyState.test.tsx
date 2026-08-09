// @vitest-environment jsdom

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityTimelineEmptyState } from './ActivityTimelineEmptyState';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key
	})
}));

vi.mock('../emptyState/EmptyState', () => ({
	EmptyState: ({ headline, variant, className }: any) => (
		<div
			data-testid="empty-state"
			data-variant={variant}
			className={className}
		>
			{headline}
		</div>
	)
}));

describe('ActivityTimelineEmptyState', () => {
	it('uses the established illustrated all-caught-up placeholder', () => {
		render(<ActivityTimelineEmptyState />);

		const emptyState = screen.getByTestId('empty-state');
		expect(emptyState.getAttribute('data-variant')).toBe(
			'conversation-nothing-to-do'
		);
		expect(emptyState.className).toContain(
			'notificationsCenter__fullEmptyState'
		);
		expect(emptyState.textContent).toBe('No notifications yet.');
	});
});
