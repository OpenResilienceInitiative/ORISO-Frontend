// @vitest-environment jsdom
/**
 * #576 — Figma "Configure your notifications" dialog body: three area tabs
 * (Termine disabled), per-kind sound dropdown + send-by-email, tab switching.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	configure,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { NotificationConfigView } from './NotificationConfigDialog';
import { DEFAULT_NOTIFICATION_CONFIG } from '../../../utils/notificationSettings/notificationConfig';

// The component tags nodes with data-cy (Cypress convention); make getByTestId use it.
configure({ testIdAttribute: 'data-cy' });

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) =>
			opts && 'number' in opts ? `${key}:${opts.number}` : key
	})
}));

// vitest has no svgr plugin — stub the icon ReactComponent exports.
vi.mock('../../../resources/img/icons/notification_settings.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/notification_audio_off.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/play-circle.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/keyboard_arrow_up.svg', () => ({
	ReactComponent: () => null
}));
vi.mock('../../../resources/img/icons/keyboard_arrow_down.svg', () => ({
	ReactComponent: () => null
}));

const baseProps = {
	config: DEFAULT_NOTIFICATION_CONFIG,
	activeArea: 'requests' as const,
	onAreaChange: vi.fn(),
	onChange: vi.fn(),
	onPreview: vi.fn()
};

describe('NotificationConfigView', () => {
	afterEach(cleanup);

	it('renders the three harmonised area tabs, all enabled', () => {
		render(<NotificationConfigView {...baseProps} />);
		expect(screen.getByTestId('notif-tab-requests')).toBeTruthy();
		expect(screen.getByTestId('notif-tab-conversations')).toBeTruthy();
		expect(
			(screen.getByTestId('notif-tab-timeCritical') as HTMLButtonElement)
				.disabled
		).toBe(false);
	});

	it('conversations tab shows the handover row; time-critical shows call+appointment and the wecker card', () => {
		const { rerender } = render(
			<NotificationConfigView {...baseProps} activeArea="conversations" />
		);
		expect(
			screen.getByTestId('notif-row-conversations-handover')
		).toBeTruthy();
		rerender(
			<NotificationConfigView {...baseProps} activeArea="timeCritical" />
		);
		expect(screen.getByTestId('notif-row-timeCritical-call')).toBeTruthy();
		expect(
			screen.getByTestId('notif-row-timeCritical-appointment')
		).toBeTruthy();
		expect(screen.getByTestId('notif-wecker-card')).toBeTruthy();
		// voting is a dummy: any vote flips to the thanks note
		fireEvent.click(screen.getByTestId('notif-wecker-up'));
		expect(screen.getByTestId('notif-wecker-thanks')).toBeTruthy();
	});

	it('reports a banner toggle', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('notif-banner-requests-new'));
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'banner',
			false
		);
	});

	it('renders the three kind rows for the active area', () => {
		render(<NotificationConfigView {...baseProps} />);
		expect(screen.getByTestId('notif-row-requests-new')).toBeTruthy();
		expect(screen.getByTestId('notif-row-requests-standard')).toBeTruthy();
		expect(screen.getByTestId('notif-row-requests-mention')).toBeTruthy();
	});

	it('reports a sound change with the chosen tone', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		const select = screen
			.getByTestId('notif-row-requests-new')
			.querySelector('select') as HTMLSelectElement;
		fireEvent.change(select, { target: { value: 'ton-3' } });
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'sound',
			'ton-3'
		);
	});

	it('reports an email toggle', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('notif-email-requests-mention'));
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'mention',
			'email',
			true
		);
	});

	it('switches area via a tab click', () => {
		const onAreaChange = vi.fn();
		render(
			<NotificationConfigView
				{...baseProps}
				onAreaChange={onAreaChange}
			/>
		);
		fireEvent.click(screen.getByTestId('notif-tab-conversations'));
		expect(onAreaChange).toHaveBeenCalledWith('conversations');
	});

	it('offers Sound #1..#12 plus No Sound plus the ring tone', () => {
		render(<NotificationConfigView {...baseProps} />);
		const select = screen
			.getByTestId('notif-row-requests-new')
			.querySelector('select') as HTMLSelectElement;
		// "no sound" + ring + 12 tones
		expect(select.options.length).toBe(14);
		expect(select.options[0].value).toBe('none');
		expect(select.options[1].value).toBe('ring');
		expect(select.options[2].value).toBe('ton-1');
	});

	it('shows the muted icon and no play button when no sound is chosen', () => {
		render(<NotificationConfigView {...baseProps} />);
		expect(screen.queryByTestId('notif-muted-requests-new')).toBeTruthy();
		expect(screen.queryByTestId('notif-play-requests-new')).toBeNull();
	});

	it('shows a play button (not the muted icon) when a tone is chosen, and previews at volume', () => {
		const onPreview = vi.fn();
		const config = {
			...DEFAULT_NOTIFICATION_CONFIG,
			requests: {
				...DEFAULT_NOTIFICATION_CONFIG.requests,
				new: { sound: 'ton-5', email: true, volume: 0.75 }
			}
		};
		render(
			<NotificationConfigView
				{...baseProps}
				config={config as never}
				onPreview={onPreview}
			/>
		);
		expect(screen.queryByTestId('notif-muted-requests-new')).toBeNull();
		fireEvent.click(screen.getByTestId('notif-play-requests-new'));
		expect(onPreview).toHaveBeenCalledWith('ton-5', 0.75);
	});

	it('volume arrows change the volume', () => {
		const onChange = vi.fn();
		render(<NotificationConfigView {...baseProps} onChange={onChange} />);
		fireEvent.click(screen.getByTestId('notif-volume-up-requests-new'));
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'volume',
			0.75
		);
		fireEvent.click(screen.getByTestId('notif-volume-down-requests-new'));
		expect(onChange).toHaveBeenCalledWith(
			'requests',
			'new',
			'volume',
			0.25
		);
	});
});
