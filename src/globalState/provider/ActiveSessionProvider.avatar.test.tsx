// @vitest-environment jsdom
import * as React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ActiveSessionProvider } from './ActiveSessionProvider';
import { UserDataContext } from '..';
import { apiGetChatMembers } from '../../api/apiGetChatMembers';
import {
	mockActiveSessionGroup,
	mockUserData
} from '../../components/message/MessageItemComponent.mocks';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('../../api/apiGetChatMembers', () => ({ apiGetChatMembers: vi.fn() }));
afterEach(cleanup);
it('keeps group list-row providers passive instead of fetching every listed group', () => {
	const userData = mockUserData();
	render(
		<UserDataContext.Provider
			value={{
				userData,
				setUserData: () => {},
				reloadUserData: () => Promise.resolve(userData)
			}}
		>
			<ActiveSessionProvider activeSession={mockActiveSessionGroup()}>
				<span>First row</span>
			</ActiveSessionProvider>
			<ActiveSessionProvider activeSession={mockActiveSessionGroup()}>
				<span>Second row</span>
			</ActiveSessionProvider>
		</UserDataContext.Provider>
	);
	expect(apiGetChatMembers).not.toHaveBeenCalled();
});
