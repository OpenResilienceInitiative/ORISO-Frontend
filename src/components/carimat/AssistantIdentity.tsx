import decodeTenantAsset from '../../utils/decodeTenantAsset';
import React from 'react';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { ReactComponent as Robot7341990 } from '../../resources/img/icons/assistant/robot-7341990-400.svg';
import { ReactComponent as Robot1184077 } from '../../resources/img/icons/assistant/robot-1184077-400.svg';
import { ReactComponent as Robot3548536 } from '../../resources/img/icons/assistant/robot-3548536-400.svg';
import { ReactComponent as Robot5475944 } from '../../resources/img/icons/assistant/robot-5475944-400.svg';

export function useAssistantIdentity() {
	const tenant = useTenant();
	return {
		name: tenant?.theming?.assistantName?.trim()
			? tenant.theming.assistantName
			: 'Carimat',
		icon: decodeTenantAsset(tenant?.theming?.assistantIcon) || 'default'
	};
}

const DefaultRobotIcon: React.FC = () => (
	<svg
		width="32"
		height="36"
		viewBox="0 0 32 36"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path
			d="M0 36V26C0 24.9 0.391667 23.9583 1.175 23.175C1.95833 22.3917 2.9 22 4 22H28C29.1 22 30.0417 22.3917 30.825 23.175C31.6083 23.9583 32 24.9 32 26V36H0ZM10 20C7.23333 20 4.875 19.025 2.925 17.075C0.975 15.125 0 12.7667 0 10C0 7.23333 0.975 4.875 2.925 2.925C4.875 0.975 7.23333 0 10 0H22C24.7667 0 27.125 0.975 29.075 2.925C31.025 4.875 32 7.23333 32 10C32 12.7667 31.025 15.125 29.075 17.075C27.125 19.025 24.7667 20 22 20H10ZM4 32H28V26H4V32ZM10 16H22C23.6667 16 25.0833 15.4167 26.25 14.25C27.4167 13.0833 28 11.6667 28 10C28 8.33333 27.4167 6.91667 26.25 5.75C25.0833 4.58333 23.6667 4 22 4H10C8.33333 4 6.91667 4.58333 5.75 5.75C4.58333 6.91667 4 8.33333 4 10C4 11.6667 4.58333 13.0833 5.75 14.25C6.91667 15.4167 8.33333 16 10 16ZM11.425 11.425C11.8083 11.0417 12 10.5667 12 10C12 9.43333 11.8083 8.95833 11.425 8.575C11.0417 8.19167 10.5667 8 10 8C9.43333 8 8.95833 8.19167 8.575 8.575C8.19167 8.95833 8 9.43333 8 10C8 10.5667 8.19167 11.0417 8.575 11.425C8.95833 11.8083 9.43333 12 10 12C10.5667 12 11.0417 11.8083 11.425 11.425ZM23.425 11.425C23.8083 11.0417 24 10.5667 24 10C24 9.43333 23.8083 8.95833 23.425 8.575C23.0417 8.19167 22.5667 8 22 8C21.4333 8 20.9583 8.19167 20.575 8.575C20.1917 8.95833 20 9.43333 20 10C20 10.5667 20.1917 11.0417 20.575 11.425C20.9583 11.8083 21.4333 12 22 12C22.5667 12 23.0417 11.8083 23.425 11.425Z"
			fill="currentColor"
		/>
	</svg>
);

const presets = {
	'robot-7341990': Robot7341990,
	'robot-1184077': Robot1184077,
	'robot-3548536': Robot3548536,
	'robot-5475944': Robot5475944
};

export const CarimatRobotIcon: React.FC = () => {
	const { icon } = useAssistantIdentity();
	if (
		/^data:image\/(png|svg\+xml);base64,/.test(icon) &&
		icon.length <= 700000
	) {
		return (
			<img
				src={icon}
				width="32"
				height="36"
				alt=""
				style={{ objectFit: 'contain' }}
			/>
		);
	}
	const Preset = presets[icon];
	return Preset ? (
		<Preset width="32" height="36" aria-hidden="true" />
	) : (
		<DefaultRobotIcon />
	);
};
