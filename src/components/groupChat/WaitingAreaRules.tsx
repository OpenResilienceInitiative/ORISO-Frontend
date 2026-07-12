import * as React from 'react';
import { useCyclingIndex } from './useCyclingIndex';

const RULE_CYCLE_INTERVAL_MS = 4000;

interface WaitingAreaRulesProps {
	rules: string[];
	ariaLabel?: string;
}

/**
 * The waiting-area netiquette rules. One rule is visually spotlighted at a time and
 * the spotlight advances every ~4s (ADR-012). All rules are always present in the DOM
 * so screen readers get the whole list at once, and `prefers-reduced-motion` shows them
 * all statically (handled in joinChat.styles.scss) — motion is never required to read a rule.
 */
export const WaitingAreaRules = ({ rules, ariaLabel }: WaitingAreaRulesProps) => {
	const activeIndex = useCyclingIndex(rules.length, RULE_CYCLE_INTERVAL_MS);

	if (rules.length === 0) {
		return null;
	}

	return (
		<ul className="joinChat__rules" aria-label={ariaLabel}>
			{rules.map((rule, index) => (
				<li
					key={index}
					className={
						index === activeIndex
							? 'joinChat__rule joinChat__rule--active'
							: 'joinChat__rule'
					}
				>
					{rule}
				</li>
			))}
		</ul>
	);
};
