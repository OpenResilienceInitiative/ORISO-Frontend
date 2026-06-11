import React from 'react';
import { ReactComponent as CatSvg } from './animals/cat.svg';
import { ReactComponent as RabbitSvg } from './animals/rabbit.svg';
import { ReactComponent as FoxSvg } from './animals/fox.svg';
import { ReactComponent as OwlSvg } from './animals/owl.svg';
import { ReactComponent as HedgehogSvg } from './animals/hedgehog.svg';
import { ReactComponent as DolphinSvg } from './animals/dolphin.svg';
import { ReactComponent as PenguinSvg } from './animals/penguin.svg';
import { ReactComponent as KoalaSvg } from './animals/koala.svg';
import { ReactComponent as PandaSvg } from './animals/panda.svg';
import { ReactComponent as OtterSvg } from './animals/otter.svg';
import { ReactComponent as SquirrelSvg } from './animals/squirrel.svg';
import { ReactComponent as TurtleSvg } from './animals/turtle.svg';
import { ReactComponent as ButterflySvg } from './animals/butterfly.svg';
import { ReactComponent as HummingbirdSvg } from './animals/hummingbird.svg';
import { ReactComponent as SeashoreSvg } from './animals/seahorse.svg';
import { ReactComponent as ChameleonSvg } from './animals/chameleon.svg';
import { ReactComponent as FireflySvg } from './animals/firefly.svg';
import { ReactComponent as BearSvg } from './animals/bear.svg';
import { ReactComponent as SwanSvg } from './animals/swan.svg';
import { ReactComponent as FrogSvg } from './animals/frog.svg';
import type { AnimalType } from '../../utils/pseudonymGenerator';

interface AnimalAvatarProps {
	animalType: AnimalType;
	/** Background color for the avatar circle. Defaults to '#FFD9D9'. */
	avatarColor?: string;
	/** Outer circle size in px (Figma default = 108) */
	size?: number;
}

type SvgComponent = React.FC<React.SVGProps<SVGSVGElement>>;

/** Wraps an imported SVG so it fills the inner avatar box absolutely. */
const svgIcon =
	(Svg: SvgComponent): React.FC =>
	() => (
		<Svg
			width="100%"
			height="100%"
			style={{ position: 'absolute', inset: 0 }}
			aria-hidden="true"
		/>
	);

const ANIMAL_COMPONENTS: Record<AnimalType, React.FC> = {
	cat: svgIcon(CatSvg),
	rabbit: svgIcon(RabbitSvg),
	fox: svgIcon(FoxSvg),
	owl: svgIcon(OwlSvg),
	hedgehog: svgIcon(HedgehogSvg),
	dolphin: svgIcon(DolphinSvg),
	penguin: svgIcon(PenguinSvg),
	koala: svgIcon(KoalaSvg),
	panda: svgIcon(PandaSvg),
	otter: svgIcon(OtterSvg),
	bear: svgIcon(BearSvg),
	squirrel: svgIcon(SquirrelSvg),
	turtle: svgIcon(TurtleSvg),
	butterfly: svgIcon(ButterflySvg),
	hummingbird: svgIcon(HummingbirdSvg),
	seahorse: svgIcon(SeashoreSvg),
	swan: svgIcon(SwanSvg),
	chameleon: svgIcon(ChameleonSvg),
	firefly: svgIcon(FireflySvg),
	frog: svgIcon(FrogSvg)
};

/**
 * Circular avatar (108×108 default) displaying the animal icon on a
 * per-animal background color from ANIMAL_COLORS.
 */
export const AnimalAvatar: React.FC<AnimalAvatarProps> = ({
	animalType,
	avatarColor = '#FFD9D9',
	size = 108
}) => {
	const AnimalInner = ANIMAL_COMPONENTS[animalType] || ANIMAL_COMPONENTS.cat;
	const innerSize = size - 12; // 6px padding on each side

	return (
		<div
			style={{
				display: 'flex',
				padding: 6,
				justifyContent: 'center',
				alignItems: 'center',
				borderRadius: size / 2,
				background: avatarColor,
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
