import caritas from '../../../../resources/img/logos/carriers/02_caritas.svg';
import skf from '../../../../resources/img/logos/carriers/01_skf.svg';
import skm from '../../../../resources/img/logos/carriers/03_skm.svg';
import via from '../../../../resources/img/logos/carriers/04_via.svg';
import kreuzbund from '../../../../resources/img/logos/carriers/05_kreuzbund.svg';
import raphael from '../../../../resources/img/logos/carriers/06_raphael.svg';
import malteser from '../../../../resources/img/logos/carriers/07_malteser.svg';

export interface Carrier {
	/** Key into `CARRIER_COVERAGE`. */
	id: string;
	name: string;
	logo: string;
	/** Raphaelswerk's mark carries less ink, so it needs a little more room. */
	size: number;
}

/**
 * The carriers whose logos sit on the login stage.
 *
 * Only used by the "Connected Dots" effect, and only in the Storybook preview
 * today — on the real login screen the logos are tenant data (FE-H05 #178:
 * a third party's branding must not appear on every ORISO login screen).
 * Which of these a tenant actually shows is its own decision.
 */
export const CARRIERS: Carrier[] = [
	{ id: 'caritas', name: 'Caritas', logo: caritas, size: 42 },
	{ id: 'skf', name: 'SkF', logo: skf, size: 42 },
	{ id: 'skm', name: 'SkM', logo: skm, size: 42 },
	{ id: 'malteser', name: 'Malteser', logo: malteser, size: 42 },
	{ id: 'kreuzbund', name: 'Kreuzbund', logo: kreuzbund, size: 42 },
	{ id: 'raphael', name: 'Raphaelswerk', logo: raphael, size: 48 },
	{ id: 'via', name: 'IN VIA', logo: via, size: 42 }
];
