import * as React from 'react';
import { useTranslation } from 'react-i18next';

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
	phone: <path d="M11 18.5h2" />
};

const HEADER_ICON_FRAMES = {
	key: <circle cx="8" cy="15" r="4" />,
	phone: <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
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
