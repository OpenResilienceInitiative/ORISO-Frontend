import * as React from 'react';
import { useState } from 'react';
import {
	CaseHandoverCurtainStep,
	CaseHandoverCurtainView
} from '../CaseHandoverCurtain';
import type { CaseHandoverReason } from '../../../api/apiCaseHandover';

// The four neutral codes UserService serves (#1536).
const reasons: CaseHandoverReason[] = [
	{
		code: 'PLANNED_ABSENCE',
		label: 'Planned absence',
		clientConsentRequired: false
	},
	{
		code: 'UNPLANNED_ABSENCE',
		label: 'Unplanned absence',
		clientConsentRequired: false
	},
	{
		code: 'ASSIGNMENT_ENDED',
		label: 'Assignment ended',
		clientConsentRequired: false
	},
	{
		code: 'ADVICE_REQUESTED',
		label: 'Advice requested',
		clientConsentRequired: true
	}
];

const shell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	padding: 16,
	height: '100vh',
	boxSizing: 'border-box'
};

type PlaygroundProps = {
	framed?: boolean;
	initialStep?: CaseHandoverCurtainStep;
	initialReasonCode?: string;
	initialExplanation?: string;
	error?: string;
	topicLabel?: string;
	/** Simulates an empty reason list from the server (FE#1725 US26). */
	noReasons?: boolean;
	/** Simulates a failed reasons request; Retry then loads them. */
	reasonsFail?: boolean;
};

export function CurtainPlayground({
	framed = true,
	initialStep = 'intro',
	initialReasonCode = '',
	initialExplanation = '',
	error,
	topicLabel = 'Schwangerschaftsberatung',
	noReasons = false,
	reasonsFail = false
}: PlaygroundProps) {
	const [failed, setFailed] = useState(reasonsFail);
	const [step, setStep] = useState<CaseHandoverCurtainStep>(initialStep);
	const [reasonCode, setReasonCode] = useState(initialReasonCode);
	const [explanation, setExplanation] = useState(initialExplanation);

	const curtain = (
		<CaseHandoverCurtainView
			step={step}
			topicLabel={topicLabel}
			reasons={noReasons || failed ? [] : reasons}
			reasonsUnavailable={noReasons}
			reasonsLoadFailed={failed}
			onRetryReasons={() => setFailed(false)}
			reasonCode={reasonCode}
			explanation={explanation}
			error={error}
			onStart={() => setStep('reason')}
			onBack={() => setStep('reason')}
			onNext={() => setStep('describe')}
			onReasonSelect={setReasonCode}
			onExplanationChange={setExplanation}
			onSubmit={() => setStep('pending')}
		/>
	);
	return framed ? <div style={shell}>{curtain}</div> : curtain;
}
