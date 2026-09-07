// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageDisplayName } from './MessageDisplayName';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback: string) => fallback
	})
}));

afterEach(cleanup);

const baseProps = {
	isUser: false,
	isMyMessage: false,
	type: 'consultant' as const,
	userId: '@spider.pig:oriso.example',
	username: 'spider pig',
	displayName: 'spider pig'
};

describe('MessageDisplayName', () => {
	it('groups a counsellor name and agency into one two-row identity block', () => {
		const { container } = render(
			<MessageDisplayName
				{...baseProps}
				subtitle="14055 Caritasverband Musterstadt Schuldnerberatung Mitte"
			/>
		);

		const identity = container.querySelector(
			'.messageItem__senderIdentity'
		);
		expect(identity).toBeTruthy();
		expect(identity?.children).toHaveLength(2);
		expect(identity?.children[0]?.textContent).toBe('spider pig');
		expect(identity?.children[1]?.textContent).toBe(
			'14055 Caritasverband Musterstadt Schuldnerberatung Mitte'
		);
	});

	it('keeps an advice-seeker identity to a single name row', () => {
		const { container } = render(
			<MessageDisplayName {...baseProps} type="user" subtitle="" />
		);

		const identity = container.querySelector(
			'.messageItem__senderIdentity'
		);
		expect(identity).toBeTruthy();
		expect(identity?.children).toHaveLength(1);
		expect(screen.queryByText(/Caritasverband/)).toBeNull();
	});
});
