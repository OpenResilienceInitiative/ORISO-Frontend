import {
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { useTenant } from '../../globalState/provider/TenantProvider';
import {
	apiGetCaseHandoverConsentPreference,
	apiSaveCaseHandoverConsentPreference,
	type CaseHandoverConsentPreference
} from '../../api/apiCaseHandover';

/** One conversation-scoped controller for every view of the same saved future preference.
 * It cannot decide an individual request or widen the counselling centre's access policy.
 */
export const useStandingAccessPreference = (
	sessionId?: number,
	autoLoad = false
) => {
	const tenant = useTenant();
	const { userData } = useContext(UserDataContext);
	const [preference, setPreference] =
		useState<CaseHandoverConsentPreference | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(false);
	const generation = useRef(0),
		sequence = useRef(0),
		savingRef = useRef(false),
		strengthened = useRef(false);
	useLayoutEffect(() => {
		generation.current += 1;
		sequence.current++;
		savingRef.current = false;
		strengthened.current = false;
		setPreference(null);
		setLoading(false);
		setSaving(false);
		setError(false);
		return () => {
			generation.current += 1;
		};
	}, [sessionId, tenant?.id, userData?.userId]);
	const checked = useCallback(
		(value: CaseHandoverConsentPreference) => {
			if (
				value?.sessionId !== sessionId ||
				typeof value.alwaysAskBeforeAdditionalAccess !== 'boolean'
			)
				throw new Error(
					'Preference response does not match conversation'
				);
			return value;
		},
		[sessionId]
	);
	const load = useCallback(async () => {
		if (!sessionId) return;
		const scope = generation.current,
			operation = ++sequence.current;
		const current = () =>
			scope === generation.current && operation === sequence.current;
		setLoading(true);
		setError(false);
		try {
			const saved = checked(
				await apiGetCaseHandoverConsentPreference(sessionId)
			);
			if (current()) setPreference(saved);
		} catch {
			if (current()) {
				setPreference(null);
				setError(true);
			}
		} finally {
			if (current()) setLoading(false);
		}
	}, [sessionId, checked]);
	useEffect(() => {
		if (autoLoad) void load();
	}, [autoLoad, load, tenant?.id, userData?.userId]);
	const save = async (alwaysAsk: boolean): Promise<boolean> => {
		if (!sessionId || !preference || savingRef.current)
			throw new Error('Preference is not ready');
		const scope = generation.current,
			operation = ++sequence.current;
		const current = () =>
			scope === generation.current && operation === sequence.current;
		const previous = preference.alwaysAskBeforeAdditionalAccess;
		savingRef.current = true;
		setSaving(true);
		setError(false);
		try {
			checked(
				await apiSaveCaseHandoverConsentPreference(sessionId, alwaysAsk)
			);
			const saved = checked(
				await apiGetCaseHandoverConsentPreference(sessionId)
			);
			if (
				!current() ||
				saved.alwaysAskBeforeAdditionalAccess !== alwaysAsk
			)
				throw new Error('Preference was not confirmed');
			strengthened.current = alwaysAsk && !previous;
			setPreference(saved);
			return saved.alwaysAskBeforeAdditionalAccess;
		} catch (failure) {
			if (current()) setError(true);
			throw failure;
		} finally {
			// Closing abandons the view, not the server mutation. A reopened view
			// must remain locked until this PUT and its readback have settled.
			if (scope === generation.current) {
				savingRef.current = false;
				setSaving(false);
				if (!current()) void load();
			}
		}
	};
	const invalidate = () => {
		sequence.current++;
		setLoading(false);
	};
	return {
		preference,
		loading,
		saving,
		error,
		load,
		save,
		invalidate,
		didStrengthen: () => strengthened.current
	};
};
