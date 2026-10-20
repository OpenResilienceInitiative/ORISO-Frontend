import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '../Switch';
import './caseHandoverClientCards.styles.scss';

export interface StandingAccessPreferenceProps {
	conversationId: string | number;
	/** Persisted preference, separate from any individual request decision. */
	alwaysAsk: boolean;
	/** Returns the value read back from the server after saving. Omit for read-only. */
	onSave?: (alwaysAsk: boolean) => Promise<boolean>;
	onSaved?: (alwaysAsk: boolean) => void;
	disabled?: boolean;
}

/** Body-only control: the host supplies the existing chat or dialog shell. */
export const StandingAccessPreference = ({
	conversationId,
	alwaysAsk,
	onSave,
	onSaved,
	disabled = false
}: StandingAccessPreferenceProps) => {
	const { t } = useTranslation();
	const operation = useRef(0);
	const saving = useRef(false);
	const [confirmed, setConfirmed] = useState(alwaysAsk);
	const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
		'idle'
	);
	useLayoutEffect(() => {
		operation.current += 1;
		saving.current = false;
		setState('idle');
		return () => {
			operation.current += 1;
		};
		// Scope changes abandon only this UI continuation, not the server operation.
	}, [conversationId]);
	useEffect(() => {
		if (!saving.current) setConfirmed(alwaysAsk);
	}, [conversationId, alwaysAsk]);
	const save = async (requested: boolean) => {
		if (!onSave || disabled || saving.current) return;
		const current = ++operation.current;
		saving.current = true;
		setState('saving');
		try {
			const readback = await onSave(requested);
			if (operation.current !== current) return;
			setConfirmed(readback);
			if (readback !== requested) {
				setState('error');
				return;
			}
			setState('saved');
			onSaved?.(readback);
		} catch {
			if (operation.current === current) setState('error');
		} finally {
			if (operation.current === current) saving.current = false;
		}
	};
	return (
		<section
			className="caseHandoverConsentInfo"
			aria-label={t('caseHandover.standingPreference.label')}
		>
			<div className="caseHandoverMessage__optOutSwitch">
				<span>{t('caseHandover.standingPreference.label')}</span>
				<Switch
					className="caseHandoverConsentInfo__switch"
					aria-label={t('caseHandover.standingPreference.label')}
					checked={confirmed}
					onChange={(value) => void save(value)}
					disabled={disabled || !onSave || state === 'saving'}
				/>
			</div>
			<p>{t('caseHandover.standingPreference.description')}</p>
			<p>{t('caseHandover.standingPreference.baselineDescription')}</p>
			{state === 'saving' && (
				<p role="status">
					{t('caseHandover.standingPreference.saving')}
				</p>
			)}
			{state === 'saved' && (
				<p role="status">
					{t('caseHandover.standingPreference.saved')}
				</p>
			)}
			{state === 'error' && (
				<p role="alert">
					{t('caseHandover.standingPreference.saveFailed')}
				</p>
			)}
		</section>
	);
};
