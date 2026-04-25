import React from 'react';
import type { AnimalType } from '../../utils/pseudonymGenerator';

interface AnimalAvatarProps {
	animalType: AnimalType;
	/** Outer circle size in px (Figma default = 108) */
	size?: number;
}

/**
 * Cat face — exact 4-path composition from Figma node 1320:38837.
 * Four absolutely-positioned vectors compose the cat inside a 96×96 box.
 */
const CatFaceFigma: React.FC = () => (
	<>
		<svg
			width="6"
			height="6"
			viewBox="0 0 6 6"
			fill="none"
			style={{ position: 'absolute', left: 35, top: 41 }}
			aria-hidden="true"
		>
			<path
				d="M5.84376 2.922C5.84376 4.5356 4.53552 5.844 2.92188 5.844C1.30824 5.844 0 4.5356 0 2.922C0 1.3084 1.30824 0 2.92188 0C4.53552 0 5.84376 1.3084 5.84376 2.922Z"
				fill="#1A1A1A"
			/>
		</svg>
		<svg
			width="6"
			height="6"
			viewBox="0 0 6 6"
			fill="none"
			style={{ position: 'absolute', left: 55, top: 41 }}
			aria-hidden="true"
		>
			<path
				d="M5.844 2.922C5.844 4.5356 4.5356 5.844 2.922 5.844C1.3084 5.844 0 4.5356 0 2.922C0 1.3084 1.3084 0 2.922 0C4.5356 0 5.844 1.3084 5.844 2.922Z"
				fill="#1A1A1A"
			/>
		</svg>
		<svg
			width="29"
			height="20"
			viewBox="0 0 29 20"
			fill="none"
			style={{ position: 'absolute', left: 34, top: 54 }}
			aria-hidden="true"
		>
			<path
				d="M16.2251 16.6548C15.6751 16.3796 15.5547 15.4172 15.5547 14.644V10.1408C18.9063 9.6596 21.4155 7.5968 21.4155 5.122C21.4155 2.286 18.1327 0 14.0935 0C10.0547 0 6.77188 2.3032 6.77188 5.122C6.77188 7.5968 9.28108 9.6764 12.6327 10.1408V14.644C12.6327 15.4172 12.5123 16.3796 11.9623 16.6548C10.1751 17.5312 4.8468 14.4032 1.82188 12.0312L0 14.3344C1.27188 15.3484 7.08108 19.6968 11.2751 19.6968C11.9799 19.6968 12.6499 19.5768 13.2343 19.2844C13.5095 19.1468 13.8015 18.958 14.0939 18.7C14.3687 18.958 14.6611 19.1468 14.9531 19.2844C15.5375 19.5768 16.2079 19.6968 16.9127 19.6968C21.1063 19.6968 26.9159 15.3312 28.1875 14.3344L26.3831 12.0312C23.3407 14.4204 18.0131 17.5312 16.2251 16.6548Z"
				fill="#1A1A1A"
			/>
		</svg>
		<svg
			width="65"
			height="65"
			viewBox="0 0 65 65"
			fill="none"
			style={{ position: 'absolute', left: 16, top: 16 }}
			aria-hidden="true"
		>
			<path
				d="M64.4525 41.0104V38.0884H62.8369C62.9401 37.126 62.9917 36.1464 62.9917 35.1664C62.9917 29.6664 61.3589 24.5272 58.5745 20.1272C59.0385 18.821 61.5305 11.3617 61.5305 1.47856V0.0347605L60.0869 0.0176001C59.6573 0.0176001 50.8749 0.0519609 43.1057 7.8034C39.7197 6.58304 36.0761 5.8784 32.2437 5.8784C28.4113 5.8784 24.7673 6.58308 21.3815 7.8034C13.5957 0.034441 4.8126 0 4.38288 0L2.93908 0.0171604V1.46096C2.93908 11.3441 5.43124 18.8028 5.89528 20.1096C3.09376 24.5096 1.46092 29.6488 1.46092 35.1488C1.46092 36.1456 1.51248 37.1084 1.6156 38.0708H0V40.9928H2.07964C2.30308 42.0068 2.56088 42.9864 2.88748 43.9488H0V46.8708H4.0562C8.81716 57.1828 19.6454 64.4196 32.2097 64.4196C44.7737 64.4196 55.6013 57.1836 60.3629 46.8708H64.4193V43.9488H61.5317C61.8581 42.9864 62.1333 42.0068 62.3397 40.9928H64.4537L64.4525 41.0104ZM58.5745 3.0602C58.4025 9.28212 57.2165 14.4042 56.4433 17.1366C53.6589 13.7506 50.1009 10.9662 46.0445 9.0068C50.8913 4.6068 56.0997 3.38676 58.5745 3.0602ZM5.8778 3.0602C8.3528 3.38676 13.561 4.60712 18.4244 9.00712C14.351 10.9665 10.8102 13.7509 8.02576 17.1368C7.25232 14.404 6.06688 9.2818 5.8778 3.0602ZM58.4197 43.9664H49.7913V46.8884H57.0961C52.5241 55.5336 43.1053 61.5144 32.2081 61.5144C21.3107 61.5144 11.8926 55.5504 7.3202 46.8884H14.6249V43.9664H5.99648C5.63552 43.004 5.32616 42.024 5.08552 41.01H14.6247V38.0884H4.57C4.44968 37.1256 4.38092 36.146 4.38092 35.1664C4.38092 20.6258 16.8593 8.80076 32.2073 8.80076C47.5553 8.80076 60.0513 20.6258 60.0513 35.1496C60.0513 36.1464 59.9825 37.1088 59.8621 38.0712H49.7905V40.9932H59.3297C59.0889 42.0244 58.7805 43.0036 58.4197 43.9664Z"
				fill="#1A1A1A"
			/>
		</svg>
	</>
);

/* Simple rabbit silhouette inside 96×96 box */
const RabbitFigma: React.FC = () => (
	<svg
		width="96"
		height="96"
		viewBox="0 0 96 96"
		fill="none"
		style={{ position: 'absolute', inset: 0 }}
		aria-hidden="true"
	>
		<ellipse cx="48" cy="60" rx="22" ry="20" fill="#1A1A1A" />
		<path
			d="M32 40c-2-12-4-26 0-30 3-3 7 0 10 6M64 40c2-12 4-26 0-30-3-3-7 0-10 6"
			stroke="#1A1A1A"
			strokeWidth="4"
			strokeLinecap="round"
			fill="none"
		/>
		<circle cx="41" cy="58" r="3" fill="#FFFFFF" />
		<circle cx="55" cy="58" r="3" fill="#FFFFFF" />
		<ellipse cx="48" cy="66" rx="3.5" ry="2.5" fill="#FFFFFF" />
	</svg>
);

/* Simple fox head inside 96×96 box */
const FoxFigma: React.FC = () => (
	<svg
		width="96"
		height="96"
		viewBox="0 0 96 96"
		fill="none"
		style={{ position: 'absolute', inset: 0 }}
		aria-hidden="true"
	>
		<path
			d="M48 30c-10 0-20 8-22 20-1 4-1 8 0 12 3 16 14 22 22 22s19-6 22-22c1-4 1-8 0-12-2-12-12-20-22-20Z"
			fill="#1A1A1A"
		/>
		<path
			d="M26 40l-8-22 16 14M70 40l8-22-16 14"
			stroke="#1A1A1A"
			strokeWidth="4"
			strokeLinecap="round"
			strokeLinejoin="round"
			fill="none"
		/>
		<circle cx="40" cy="54" r="3" fill="#FFFFFF" />
		<circle cx="56" cy="54" r="3" fill="#FFFFFF" />
		<path
			d="M44 64c2 2 6 2 8 0"
			stroke="#FFFFFF"
			strokeWidth="2.5"
			strokeLinecap="round"
			fill="none"
		/>
	</svg>
);

const ANIMAL_COMPONENTS: Record<AnimalType, React.FC> = {
	cat: CatFaceFigma,
	rabbit: RabbitFigma,
	fox: FoxFigma,
	owl: CatFaceFigma,
	hedgehog: CatFaceFigma,
	dolphin: RabbitFigma,
	penguin: RabbitFigma,
	koala: CatFaceFigma,
	panda: CatFaceFigma,
	otter: FoxFigma
};

/**
 * Pink circular avatar (108×108 default) with the animal composed inside a
 * 96×96 relative inner box, exactly as exported from Figma.
 */
export const AnimalAvatar: React.FC<AnimalAvatarProps> = ({
	animalType,
	size = 108
}) => {
	const AnimalInner = ANIMAL_COMPONENTS[animalType] || CatFaceFigma;
	const innerSize = size - 12; // p-1.5 = 6px on each side

	return (
		<div
			style={{
				display: 'flex',
				padding: 6,
				justifyContent: 'center',
				alignItems: 'center',
				borderRadius: size / 2,
				background: '#FFD9D9',
				width: size,
				height: size,
				boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.10)',
				overflow: 'hidden',
				flexShrink: 0
			}}
		>
			<div
				style={{
					width: innerSize,
					height: innerSize,
					position: 'relative',
					overflow: 'hidden'
				}}
			>
				<AnimalInner />
			</div>
		</div>
	);
};
