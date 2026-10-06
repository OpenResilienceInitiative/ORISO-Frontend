import * as React from 'react';
import { useTranslation } from 'react-i18next';
import './accountSetupField.styles.scss';

/**
 * The chrome both account-setup dialogs share: the two-step progress row at the
 * top and the icon-tile header below it. Drawn here rather than imported as
 * assets so the stroke weight and the 28px box match the approved artboards.
 */

export type AccountSetupStepKey = 'password' | 'twoFactor';

const STROKE_PROPS = {
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 2,
	strokeLinecap: 'round' as const,
	strokeLinejoin: 'round' as const,
	viewBox: '0 0 24 24'
};

export const CheckMarkIcon = ({ size = 14 }: { size?: number }) => (
	<svg
		{...STROKE_PROPS}
		aria-hidden="true"
		height={size}
		width={size}
		className="twoFactorSetupDialog__strokeIcon"
	>
		<path d="M5 12.5l4.5 4.5L19 7.5" />
	</svg>
);

export const AlertIcon = ({ size = 16 }: { size?: number }) => (
	<svg
		{...STROKE_PROPS}
		aria-hidden="true"
		height={size}
		width={size}
		className="twoFactorSetupDialog__strokeIcon"
	>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7.5v5.5M12 16.5v.5" />
	</svg>
);

export const PendingDotIcon = ({ size = 16 }: { size?: number }) => (
	<svg
		{...STROKE_PROPS}
		aria-hidden="true"
		height={size}
		width={size}
		className="twoFactorSetupDialog__strokeIcon"
	>
		<circle cx="12" cy="12" r="3.5" />
	</svg>
);

const HEADER_ICONS = {
	key: <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />,
	phone: <path d="M11 18.5h2" />,
	envelope: <path d="M3 7l9 6 9-6" />
};

const HEADER_ICON_FRAMES = {
	key: <circle cx="8" cy="15" r="4" />,
	phone: <rect x="7" y="2.5" width="10" height="19" rx="2.5" />,
	envelope: <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
};

export type AccountSetupHeaderIcon = keyof typeof HEADER_ICONS;

interface AccountSetupProgressProps {
	active: AccountSetupStepKey;
}

/** Two steps, so nobody reads the password dialog as the whole of setup. */
export const AccountSetupProgress = ({ active }: AccountSetupProgressProps) => {
	const { t: translate } = useTranslation();
	const steps: { key: AccountSetupStepKey; labelKey: string }[] = [
		{ key: 'password', labelKey: 'accountSetup.progress.password' },
		{ key: 'twoFactor', labelKey: 'accountSetup.progress.twoFactor' }
	];
	const activeIndex = steps.findIndex((step) => step.key === active);

	return (
		<div
			aria-label={translate('accountSetup.progress.label')}
			className="twoFactorSetupDialog__progress"
			role="group"
		>
			{steps.map((step, index) => {
				const isActive = index === activeIndex;
				const isDone = index < activeIndex;

				return (
					<React.Fragment key={step.key}>
						{index > 0 && (
							<span
								aria-hidden="true"
								className="twoFactorSetupDialog__progressRule"
							/>
						)}
						<span
							className={[
								'twoFactorSetupDialog__progressStep',
								isActive &&
									'twoFactorSetupDialog__progressStep--active',
								isDone &&
									'twoFactorSetupDialog__progressStep--done'
							]
								.filter(Boolean)
								.join(' ')}
						>
							<span
								aria-hidden="true"
								className="twoFactorSetupDialog__progressMarker"
							>
								{isDone ? <CheckMarkIcon /> : index + 1}
							</span>
							<span className="twoFactorSetupDialog__progressLabel">
								{translate(step.labelKey)}
								{isDone && (
									<span className="twoFactorSetupDialog__srOnly">
										{` ${translate('accountSetup.progress.done')}`}
									</span>
								)}
							</span>
						</span>
					</React.Fragment>
				);
			})}
		</div>
	);
};

interface AccountSetupHeaderProps {
	descriptionId?: string;
	icon: AccountSetupHeaderIcon;
	subtitle?: React.ReactNode;
	title: string;
	titleId?: string;
}

export const AccountSetupHeader = ({
	descriptionId,
	icon,
	subtitle,
	title,
	titleId
}: AccountSetupHeaderProps) => (
	<div className="twoFactorSetupDialog__header">
		<span aria-hidden="true" className="twoFactorSetupDialog__headerTile">
			<svg {...STROKE_PROPS} height={28} width={28}>
				{HEADER_ICON_FRAMES[icon]}
				{HEADER_ICONS[icon]}
			</svg>
		</span>
		<div className="twoFactorSetupDialog__headerText">
			<h2 className="twoFactorSetupDialog__title" id={titleId}>
				{title}
			</h2>
			{subtitle && (
				<p className="twoFactorSetupDialog__copy" id={descriptionId}>
					{subtitle}
				</p>
			)}
		</div>
	</div>
);

interface AccountSetupFieldProps {
	/** Rendered inside the box, after the input — the password eye toggle. */
	adornment?: React.ReactNode;
	autoComplete?: string;
	autoFocus?: boolean;
	errorMessage?: string;
	hint?: string;
	id: string;
	inputMode?: 'email' | 'numeric' | 'text';
	label: string;
	maxLength?: number;
	name: string;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	pattern?: string;
	successMessage?: string;
	type?: string;
	value: string;
}

/**
 * Every text input in the account-setup dialogs: label above the box, the
 * state in the border, and the reason underneath it.
 */
export const AccountSetupField = ({
	adornment,
	autoComplete = 'off',
	autoFocus,
	errorMessage,
	hint,
	id,
	inputMode,
	label,
	maxLength,
	name,
	onChange,
	pattern,
	successMessage,
	type = 'text',
	value
}: AccountSetupFieldProps) => {
	const state = errorMessage ? 'error' : successMessage ? 'ok' : '';
	// The hint explains what belongs in the field, so it stays while the
	// message below says whether what is in there works.
	const describedBy = [
		hint && `${id}-hint`,
		errorMessage && `${id}-error`,
		!errorMessage && successMessage && `${id}-ok`
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div className="setupField">
			<label className="setupField__label" htmlFor={id}>
				{label}
			</label>
			<div
				className={[
					'setupField__box',
					state && `setupField__box--${state}`
				]
					.filter(Boolean)
					.join(' ')}
			>
				<input
					aria-describedby={describedBy || undefined}
					aria-invalid={state === 'error' || undefined}
					autoComplete={autoComplete}
					autoFocus={autoFocus}
					className="setupField__control"
					id={id}
					inputMode={inputMode}
					maxLength={maxLength}
					name={name}
					onChange={onChange}
					pattern={pattern}
					type={type}
					value={value}
				/>
				{adornment}
			</div>
			{hint && (
				<p className="setupField__hint" id={`${id}-hint`}>
					{hint}
				</p>
			)}
			{errorMessage && (
				<p
					className="setupField__message setupField__message--error"
					id={`${id}-error`}
					role="alert"
				>
					<AlertIcon />
					<span>{errorMessage}</span>
				</p>
			)}
			{!errorMessage && successMessage && (
				<p
					className="setupField__message setupField__message--ok"
					id={`${id}-ok`}
				>
					<CheckMarkIcon size={16} />
					<span>{successMessage}</span>
				</p>
			)}
		</div>
	);
};
