import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAgencyConsultantList } from '../../api/apiGetAgencyConsultantList';
import type { Consultant } from '../../api/apiGetAgencyConsultantList';
import type { SessionSupervisor } from '../../api/apiGetSessionSupervisors';
import type { SupervisorDirectoryState } from './SupervisorConsultantPicker';
import { filterEligibleSupervisorConsultants } from './supervisorDirectory';

type SupervisorReference = Pick<SessionSupervisor, 'supervisorConsultantId'>;

type DirectorySnapshot = {
	key: string | null;
	state: SupervisorDirectoryState;
	consultants: Consultant[];
};

type UseSupervisorConsultantDirectoryOptions = {
	isOpen: boolean;
	sessionId?: number | null;
	agencyId: string | null;
	currentConsultantId?: string | null;
	supervisorState: SupervisorDirectoryState;
	supervisors: SupervisorReference[];
	onLoadError: () => void;
};

const EMPTY_SNAPSHOT: DirectorySnapshot = {
	key: null,
	state: 'loading',
	consultants: []
};

export const useSupervisorConsultantDirectory = ({
	isOpen,
	sessionId,
	agencyId,
	currentConsultantId,
	supervisorState,
	supervisors,
	onLoadError
}: UseSupervisorConsultantDirectoryOptions) => {
	const directoryKey =
		isOpen && sessionId && agencyId ? `${sessionId}:${agencyId}` : null;
	const [snapshot, setSnapshot] = useState<DirectorySnapshot>(EMPTY_SNAPSHOT);
	const [selectedConsultantId, setSelectedConsultantId] = useState('');
	const onLoadErrorRef = useRef(onLoadError);
	useEffect(() => {
		onLoadErrorRef.current = onLoadError;
	}, [onLoadError]);

	useEffect(() => {
		setSelectedConsultantId('');

		if (!directoryKey || !agencyId) {
			setSnapshot({
				key: directoryKey,
				state: isOpen ? 'error' : 'loading',
				consultants: []
			});
			return;
		}

		let cancelled = false;
		setSnapshot({ key: directoryKey, state: 'loading', consultants: [] });

		void fetchAgencyConsultantList(agencyId)
			.then((consultants) => {
				if (cancelled) return;
				setSnapshot({
					key: directoryKey,
					state: 'ready',
					consultants
				});
			})
			.catch(() => {
				if (cancelled) return;
				setSnapshot({
					key: directoryKey,
					state: 'error',
					consultants: []
				});
				onLoadErrorRef.current();
			});

		return () => {
			cancelled = true;
		};
	}, [agencyId, directoryKey, isOpen]);

	const currentSnapshot =
		snapshot.key === directoryKey
			? snapshot
			: {
					key: directoryKey,
					state: directoryKey ? ('loading' as const) : snapshot.state,
					consultants: []
				};

	const state =
		supervisorState === 'ready' ? currentSnapshot.state : supervisorState;
	const consultants = useMemo(
		() =>
			supervisorState === 'ready' && currentSnapshot.state === 'ready'
				? filterEligibleSupervisorConsultants({
						consultants: currentSnapshot.consultants,
						currentConsultantId,
						currentSupervisorIds: supervisors.map(
							(supervisor) => supervisor.supervisorConsultantId
						)
					})
				: [],
		[
			currentConsultantId,
			currentSnapshot.consultants,
			currentSnapshot.state,
			supervisors,
			supervisorState
		]
	);
	const selectedConsultant =
		consultants.find(
			(consultant) => consultant.consultantId === selectedConsultantId
		) ?? null;

	useEffect(() => {
		if (selectedConsultantId && !selectedConsultant) {
			setSelectedConsultantId('');
		}
	}, [selectedConsultant, selectedConsultantId]);

	return {
		state,
		consultants,
		directoryConsultants: currentSnapshot.consultants,
		selectedConsultantId,
		selectedConsultant,
		setSelectedConsultantId
	};
};
