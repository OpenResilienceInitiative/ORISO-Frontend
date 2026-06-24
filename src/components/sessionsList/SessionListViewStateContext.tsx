import * as React from 'react';
import {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState
} from 'react';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';

type SessionListViewState = {
	ready: boolean;
	visibleSessionCount: number;
};

type SessionListViewStateByType = Partial<
	Record<SESSION_LIST_TYPES, SessionListViewState>
>;

type SessionListViewStateContextValue = {
	getSessionListViewState: (
		type: SESSION_LIST_TYPES
	) => SessionListViewState;
	setSessionListViewState: (
		type: SESSION_LIST_TYPES,
		state: SessionListViewState
	) => void;
};

const fallbackState: SessionListViewState = {
	ready: false,
	visibleSessionCount: 0
};

const SessionListViewStateContext =
	createContext<SessionListViewStateContextValue>({
		getSessionListViewState: () => fallbackState,
		setSessionListViewState: () => undefined
	});

export const SessionListViewStateProvider = ({
	children
}: {
	children: ReactNode;
}) => {
	const [stateByType, setStateByType] =
		useState<SessionListViewStateByType>({});

	const setSessionListViewState = useCallback(
		(type: SESSION_LIST_TYPES, state: SessionListViewState) => {
			if (!type) return;
			setStateByType((current) => ({
				...current,
				[type]: state
			}));
		},
		[]
	);

	const getSessionListViewState = useCallback(
		(type: SESSION_LIST_TYPES) => stateByType[type] || fallbackState,
		[stateByType]
	);

	const value = useMemo(
		() => ({
			getSessionListViewState,
			setSessionListViewState
		}),
		[getSessionListViewState, setSessionListViewState]
	);

	return (
		<SessionListViewStateContext.Provider value={value}>
			{children}
		</SessionListViewStateContext.Provider>
	);
};

export const useSessionListViewState = () =>
	useContext(SessionListViewStateContext);
