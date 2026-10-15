// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TopicTag } from './TopicTag';

afterEach(cleanup);

describe('TopicTag', () => {
	it('renders the topic with the shared class and the caller layout class', () => {
		render(
			<TopicTag className="sessionInfo__x">Familienberatung</TopicTag>
		);
		const tag = screen.getByText('Familienberatung');
		expect(tag.classList.contains('topicTag')).toBe(true);
		expect(tag.classList.contains('sessionInfo__x')).toBe(true);
		expect(tag.classList.contains('topicTag--emphasis')).toBe(false);
	});

	it('marks the emphasised state for selected or hovered cards', () => {
		render(<TopicTag emphasis>Schuldnerberatung</TopicTag>);
		expect(
			screen
				.getByText('Schuldnerberatung')
				.classList.contains('topicTag--emphasis')
		).toBe(true);
	});

	it.each([undefined, null, ''])('renders nothing for %p', (value) => {
		const { container } = render(<TopicTag>{value}</TopicTag>);
		expect(container.innerHTML).toBe('');
	});
});
