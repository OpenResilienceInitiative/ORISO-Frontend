import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SkfLogo } from '../../resources/img/logos/01_skf.svg';
import { ReactComponent as CaritasLogo } from '../../resources/img/logos/02_caritas.svg';
import { ReactComponent as SkmLogo } from '../../resources/img/logos/03_skm.svg';
import { ReactComponent as InViaLogo } from '../../resources/img/logos/04_via.svg';
import { ReactComponent as KreuzbundLogo } from '../../resources/img/logos/05_kreuzbund.svg';
import { ReactComponent as RaphaelswerkLogo } from '../../resources/img/logos/06_raphael.svg';
import { ReactComponent as MalteserLogo } from '../../resources/img/logos/07_malteser.svg';
import type { CarrierId } from './lampMap/carrierPresence';

/**
 * The partner marks shown on the stage, in the order of the design.
 *
 * ## Third-party branding — read before changing
 *
 * These are other organisations' marks. FE-H05 (#178) removed them because a
 * tenant that is not part of this family would have been showing them anyway,
 * which is a wrong disclosure. They are back as an *opt-out* set: the tenant
 * decides in the admin panel which of them appear (`theming.associationLogos`).
 * Until that field is delivered, every tenant shows all of them — see the
 * comment on {@link visibleCarriers}.
 */
const CARRIERS: {
	id: CarrierId;
	name: string;
	Logo: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
}[] = [
	{ id: 'skf', name: 'SkF', Logo: SkfLogo },
	{ id: 'caritas', name: 'Caritas', Logo: CaritasLogo },
	{ id: 'skm', name: 'SkM', Logo: SkmLogo },
	{ id: 'malteser', name: 'Malteser', Logo: MalteserLogo },
	{ id: 'kreuzbund', name: 'Kreuzbund', Logo: KreuzbundLogo },
	{ id: 'raphael', name: 'Raphaelswerk', Logo: RaphaelswerkLogo },
	{ id: 'via', name: 'IN VIA', Logo: InViaLogo }
];

export const ALL_CARRIER_IDS = CARRIERS.map(({ id }) => id);

/**
 * `undefined` means the backend does not deliver the setting yet, and every
 * mark is shown — today's behaviour. An empty array means the tenant switched
 * them all off, and nothing is rendered. Unknown ids are ignored rather than
 * rendered blank.
 */
export const visibleCarriers = (allowed?: readonly string[] | null) =>
	allowed == null
		? CARRIERS
		: CARRIERS.filter(({ id }) => allowed.includes(id));

export interface StageCarrierLogosProps {
	/** `theming.associationLogos` from the tenant, when the backend has it. */
	allowed?: readonly string[] | null;
	/** Highlights this organisation's locations on the lamp map. */
	onHighlight?: (carrier: CarrierId | null) => void;
}

/**
 * Hovering — or focusing, so this works from the keyboard too — a mark lights
 * up where that organisation is present on the stage lamp map.
 *
 * The buttons carry no action of their own; when the lamp map never loads
 * (mobile, reduced motion) they are inert decoration with an accessible name.
 */
export const StageCarrierLogos = ({
	allowed,
	onHighlight
}: StageCarrierLogosProps) => {
	const { t: translate } = useTranslation();
	const carriers = visibleCarriers(allowed);

	if (carriers.length === 0) {
		return null;
	}

	return (
		<ul className="stage__logos" data-cy="stage-carrier-logos">
			{carriers.map(({ id, name, Logo }) => (
				<li key={id}>
					<button
						type="button"
						className="stage__logo"
						aria-label={translate('app.stage.carrierLogoAlt', {
							name
						})}
						onMouseEnter={() => onHighlight?.(id)}
						onMouseLeave={() => onHighlight?.(null)}
						onFocus={() => onHighlight?.(id)}
						onBlur={() => onHighlight?.(null)}
					>
						<Logo aria-hidden="true" focusable="false" />
					</button>
				</li>
			))}
		</ul>
	);
};
