import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stage } from './stage';
import type { CarrierId } from './lampMap/carrierPresence';
import { useLampMap } from './lampMap/useLampMap';

const meta: Meta<typeof Stage> = {
	title: 'Login/Stage',
	component: Stage,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component: [
					'The red login stage with the lamp map (design 5b).',
					'',
					'### Load order',
					'The login screen is the first thing anyone sees, so none of this',
					'sits in the critical path:',
					'',
					'1. markup, type, form, buttons and legal links render first — the',
					'   effect is only reachable through a dynamic `import()` and is',
					'   therefore a separate chunk;',
					'2. the chunk is fetched only on a desktop viewport, without',
					'   `prefers-reduced-motion`, with the stage near the viewport,',
					'   and only when the browser is idle;',
					'3. the wandering dot starts after the resting map has painted;',
					'4. the carrier schedules — the expensive part — are built on the',
					'   first hover and pre-warmed during idle time.',
					'',
					'On a phone none of it goes over the wire at all: the stage is not',
					'rendered below `$fromXLarge`, and the mobile hero is plain CSS.',
					'',
					'### The coverage map is schematic',
					'`carrierPresence.ts` describes each carrier the way design 5b',
					'paints it — a nationwide share of the dots, a few regional',
					'clusters, and the seed cities its wave of lights spreads from —',
					'**not** the platform’s own agency records. Caritas lights up',
					'nearly the whole country from eighteen cities at once; a',
					'specialist service stays a handful of islands and comes on slowly.',
					'',
					'The live path is **not built yet**: there is no public endpoint',
					'that enumerates agency postcodes. `apiGetAgenciesByTenant` takes a',
					'postcode as *input*; the data exists server-side',
					'(`AgencyService.postcode`, `UserService.PostcodeRangeDTO`) but',
					'nothing aggregates it. `loadCarrierPresence()` is the single seam',
					'where that endpoint gets plugged in.'
				].join('\n')
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof Stage>;

export const Default: Story = {
	render: () => (
		<div style={{ height: '100vh' }}>
			<Stage hasAnimation={false} isReady />
		</div>
	)
};

const CARRIERS: CarrierId[] = [
	'caritas',
	'malteser',
	'kreuzbund',
	'skf',
	'skm',
	'via',
	'raphael'
];

/**
 * Drives `setCarrier` directly so the coverage of each organisation can be
 * reviewed without the stage logos.
 */
export const CoverageExplorer: Story = {
	render: function CoverageStory() {
		const containerRef = React.useRef<HTMLDivElement>(null);
		const { canvasRef, isReady, setCarrier } = useLampMap({ containerRef });
		const [active, setActive] = useState<CarrierId | null>(null);

		const pick = (carrier: CarrierId | null) => {
			setActive(carrier);
			setCarrier(carrier);
		};

		return (
			<div style={{ display: 'flex', height: '100vh' }}>
				<div
					ref={containerRef}
					style={{
						position: 'relative',
						flex: '0 0 480px',
						overflow: 'hidden',
						background:
							'linear-gradient(152deg, #da2530 0%, #c0121f 46%, #7c0d15 100%)'
					}}
				>
					<canvas
						ref={canvasRef}
						style={{
							position: 'absolute',
							inset: 0,
							width: '100%',
							height: '100%'
						}}
					/>
				</div>
				<div style={{ padding: 24, fontFamily: 'system-ui' }}>
					<p>
						{isReady
							? 'Effect loaded.'
							: 'Waiting for the gate (desktop width, motion allowed, idle)…'}
					</p>
					{[null, ...CARRIERS].map((carrier) => (
						<button
							key={carrier ?? 'none'}
							type="button"
							onClick={() => pick(carrier)}
							style={{
								display: 'block',
								margin: '4px 0',
								fontWeight: active === carrier ? 700 : 400
							}}
						>
							{carrier ?? 'none'}
						</button>
					))}
				</div>
			</div>
		);
	}
};
