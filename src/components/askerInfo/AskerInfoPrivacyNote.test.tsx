// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	ActiveSessionContext,
	AUTHORITIES,
	UserDataContext
} from '../../globalState';
import { getCachedDepartmentLegal } from '../../api/apiGetDepartmentLegal';
import { AskerInfoPrivacyNote } from './AskerInfoPrivacyNote';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../api/apiGetDepartmentLegal', () => ({
	getCachedDepartmentLegal: vi.fn()
}));

const legal = (content: string | null) => ({
	dpp: { content, consentText: null },
	imprint: { content: null, consentText: null }
});

const renderNote = ({
	authority = AUTHORITIES.CONSULTANT_DEFAULT,
	isGroup = false,
	topic = { id: 14 } as { id: number } | null,
	mainTopicId
}: {
	authority?: string;
	isGroup?: boolean;
	topic?: { id: number } | null;
	mainTopicId?: number;
} = {}) =>
	render(
		<UserDataContext.Provider
			value={{ userData: { grantedAuthorities: [authority] } } as any}
		>
			<ActiveSessionContext.Provider
				value={
					{
						activeSession: {
							isGroup,
							item: { id: 41, agencyId: 3, topic, mainTopicId }
						}
					} as any
				}
			>
				<AskerInfoPrivacyNote />
			</ActiveSessionContext.Provider>
		</UserDataContext.Provider>
	);

describe('AskerInfoPrivacyNote', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(cleanup);

	it('tells the counsellor when the centre has no stored privacy notice', async () => {
		vi.mocked(getCachedDepartmentLegal).mockResolvedValue(legal(null));
		renderNote();
		expect(
			await screen.findByText('askerInfo.noPrivacyNotice.title')
		).toBeTruthy();
		expect(getCachedDepartmentLegal).toHaveBeenCalledWith(3, 14);
	});

	it('falls back to mainTopicId when the topic object is absent', async () => {
		vi.mocked(getCachedDepartmentLegal).mockResolvedValue(legal(null));
		renderNote({ topic: null, mainTopicId: 22 });
		expect(
			await screen.findByText('askerInfo.noPrivacyNotice.title')
		).toBeTruthy();
		expect(getCachedDepartmentLegal).toHaveBeenCalledWith(3, 22);
	});

	it('stays silent when a privacy notice is stored', async () => {
		vi.mocked(getCachedDepartmentLegal).mockResolvedValue(
			legal('{"de":"<p>Text</p>"}')
		);
		renderNote();
		await waitFor(() =>
			expect(getCachedDepartmentLegal).toHaveBeenCalled()
		);
		expect(
			screen.queryByText('askerInfo.noPrivacyNotice.title')
		).toBeNull();
	});

	it('stays silent when the lookup failed or answered nothing', async () => {
		vi.mocked(getCachedDepartmentLegal).mockResolvedValue(null);
		renderNote();
		await waitFor(() =>
			expect(getCachedDepartmentLegal).toHaveBeenCalled()
		);
		expect(
			screen.queryByText('askerInfo.noPrivacyNotice.title')
		).toBeNull();
	});

	it('is never shown to the advice seeker, and issues no request for them', () => {
		vi.mocked(getCachedDepartmentLegal).mockResolvedValue(legal(null));
		renderNote({ authority: AUTHORITIES.ASKER_DEFAULT });
		expect(
			screen.queryByText('askerInfo.noPrivacyNotice.title')
		).toBeNull();
		expect(getCachedDepartmentLegal).not.toHaveBeenCalled();
	});

	it('is not shown for group chats or sessions without a topic', () => {
		vi.mocked(getCachedDepartmentLegal).mockResolvedValue(legal(null));
		renderNote({ isGroup: true });
		cleanup();
		renderNote({ topic: null });
		expect(
			screen.queryByText('askerInfo.noPrivacyNotice.title')
		).toBeNull();
		expect(getCachedDepartmentLegal).not.toHaveBeenCalled();
	});
});
