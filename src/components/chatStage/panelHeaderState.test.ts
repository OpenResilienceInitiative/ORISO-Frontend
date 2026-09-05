import { describe, expect, it } from 'vitest';
import {
	derivePanelChannelMenu,
	PANEL_KIND_LABEL_MIN_WIDTH,
	resolvePanelKindLabel
} from './panelHeaderState';
import type { SecondaryChannel } from './channelSwitcherState';

const supervision: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: 'Bettina B.',
	unread: 1
};
const thread1: SecondaryChannel = {
	id: '$thread-1',
	kind: 'thread',
	label: 'Thread #1'
};
const thread2: SecondaryChannel = {
	id: '$thread-2',
	kind: 'thread',
	label: 'Thread #2'
};

describe('derivePanelChannelMenu (T15: jump between channels from the panel header)', () => {
	it('lists every secondary channel of the session, the shown one included', () => {
		const menu = derivePanelChannelMenu(
			[thread2, thread1, supervision],
			'$thread-1'
		);
		expect(menu.items.map((item) => item.id)).toEqual([
			'$thread-2',
			'$thread-1',
			'supervision'
		]);
		expect(menu.activeId).toBe('$thread-1');
	});

	it('marks the shown channel as active on its item', () => {
		const menu = derivePanelChannelMenu(
			[thread1, supervision],
			'supervision'
		);
		expect(
			menu.items.find((item) => item.id === 'supervision')?.active
		).toBe(true);
		expect(menu.items.find((item) => item.id === '$thread-1')?.active).toBe(
			false
		);
	});

	it('is switchable only when another channel exists', () => {
		expect(
			derivePanelChannelMenu([supervision], 'supervision').switchable
		).toBe(false);
		expect(
			derivePanelChannelMenu([supervision, thread1], 'supervision')
				.switchable
		).toBe(true);
		expect(derivePanelChannelMenu([], 'supervision').switchable).toBe(
			false
		);
	});

	it('keeps the unread counts so the menu can badge them', () => {
		const menu = derivePanelChannelMenu(
			[thread1, supervision],
			'$thread-1'
		);
		expect(
			menu.items.find((item) => item.id === 'supervision')?.unread
		).toBe(1);
	});
});

describe('resolvePanelKindLabel (T15: participant count instead of the label when the header is tight)', () => {
	it('shows the channel word when the title column has room', () => {
		expect(
			resolvePanelKindLabel({
				titleWidth: PANEL_KIND_LABEL_MIN_WIDTH,
				label: 'Supervision',
				participantCount: 2
			})
		).toEqual({ mode: 'label', text: 'Supervision' });
	});

	it('falls back to the participant count below the minimum width', () => {
		expect(
			resolvePanelKindLabel({
				titleWidth: PANEL_KIND_LABEL_MIN_WIDTH - 1,
				label: 'Supervision',
				participantCount: 3
			})
		).toEqual({ mode: 'count', text: '3' });
	});

	it('keeps the label while the width is unknown (first render) or nobody is listed', () => {
		expect(
			resolvePanelKindLabel({
				titleWidth: null,
				label: 'Thread',
				participantCount: 2
			}).mode
		).toBe('label');
		expect(
			resolvePanelKindLabel({
				titleWidth: 10,
				label: 'Thread',
				participantCount: 0
			}).mode
		).toBe('label');
	});
});
