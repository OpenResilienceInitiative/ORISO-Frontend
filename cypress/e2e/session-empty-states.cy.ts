import {
	closeWebSocketServer,
	mockWebSocket,
	startWebSocketServer
} from '../support/websocket';
import { USER_CONSULTANT } from '../support/commands/mockApi';

describe('Session empty states', () => {
	before(() => {
		startWebSocketServer();
	});

	after(() => {
		closeWebSocketServer();
	});

	beforeEach(() => {
		mockWebSocket();
	});

	it('renders themed one-shot empty states on desktop and mobile', () => {
		cy.viewport(1200, 800);

		cy.fastLogin({
			userId: USER_CONSULTANT
		});

		cy.visit('/sessions/consultant/sessionPreview');
		cy.wait('@consultantEnquiriesBase');

		cy.get('[data-cy=empty-state][data-empty-state=inquiry]').should(
			'be.visible'
		);
		cy.get(
			'[data-cy=empty-state][data-empty-state=conversation-nothing-to-do]'
		)
			.should('be.visible')
			.and('contain.text', 'Kurz durchatmen.')
			.and('contain.text', 'Alles erledigt.');
		cy.contains('Bitte wählen Sie eine Nachricht aus').should(
			'not.exist'
		);
		cy.get('a[href="/sessions/consultant/sessionPreview"]')
			.find('.navigation__title--figma')
			.invoke('text')
			.should('equal', 'Anfra-\ngen');
		cy.get('a[href="/sessions/consultant/sessionView"]')
			.find('.navigation__title--figma')
			.invoke('text')
			.should('equal', 'Gesprä-\nche');
		cy.get('a[href="/notifications"]')
			.should('have.attr', 'aria-label', 'Zeitstrahl')
			.find('.navigation__title--figma')
			.invoke('text')
			.should('equal', 'Zeit-\nstrahl');

		cy.get('[data-cy=empty-state-animation]').each(($animation) => {
			const primaryFixedDim = getComputedStyle(
				$animation[0].ownerDocument.documentElement
			)
				.getPropertyValue('--m3-primary-fixed-dim')
				.trim()
				.toLowerCase();

			expect($animation.attr('data-loop')).to.equal('false');
			expect($animation.attr('data-speed')).to.equal('0.5');
			expect($animation.attr('data-accent-color')).to.equal(
				primaryFixedDim
			);
			expect($animation.attr('data-accent-color')).not.to.equal(
				'#cc1e1c'
			);
			expect($animation.attr('data-secondary-color')).to.equal('#646d78');

			const rect = $animation[0].getBoundingClientRect();
			expect(Math.round(rect.width)).to.equal(176);
			expect(Math.round(rect.height)).to.equal(176);
			expect(
				getComputedStyle($animation.children()[0]).transform
			).to.contain('0.75');
		});

		cy.get('.session--empty').should(($sessionEmpty) => {
			const styles = getComputedStyle($sessionEmpty[0]);

			expect(styles.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
			expect(styles.borderTopWidth).to.equal('0px');
			expect(styles.borderRadius).to.equal('0px');
			expect(styles.marginTop).to.equal('0px');
		});

		cy.get('[data-cy=empty-state-animation] svg', {
			timeout: 8000
		}).should(($svgs) => {
			expect($svgs.length).to.be.greaterThan(1);

			const markup = Array.from($svgs)
				.map((svg) => svg.outerHTML.toLowerCase())
				.join('');

			expect(markup).not.to.contain('#33cccc');
			expect(markup).not.to.contain('#34cccc');
			expect(markup).not.to.contain('#000000');
		});

		cy.get('[data-cy=empty-state-animation][data-empty-state=inquiry]', {
			timeout: 9000
		}).should('have.attr', 'data-complete', 'true');
		cy.get(
			'[data-cy=empty-state-animation][data-empty-state=conversation-nothing-to-do]',
			{ timeout: 9000 }
		).should('have.attr', 'data-complete', 'true');

		cy.get(
			'[data-cy=empty-state-animation][data-empty-state=inquiry]'
		).then(($leftAnimation) => {
			const leftRect = $leftAnimation[0].getBoundingClientRect();
			const leftCenter = leftRect.top + leftRect.height / 2;

			cy.get(
				'[data-cy=empty-state-animation][data-empty-state=conversation-nothing-to-do]'
			).then(($rightAnimation) => {
				const rightRect = $rightAnimation[0].getBoundingClientRect();
				const rightCenter = rightRect.top + rightRect.height / 2;

				expect(Math.abs(leftCenter - rightCenter)).to.be.lessThan(8);
			});
		});

		cy.get(
			'[data-cy=empty-state][data-empty-state=conversation-nothing-to-do]'
		).then(($emptyState) => {
			const emptyRect = $emptyState[0].getBoundingClientRect();
			const animationRect = $emptyState
				.find('[data-cy=empty-state-animation]')[0]
				.getBoundingClientRect();
			const headlineRect = $emptyState
				.find('.emptyState__headline')[0]
				.getBoundingClientRect();
			const groupTop = Math.min(animationRect.top, headlineRect.top);
			const groupBottom = Math.max(
				animationRect.bottom,
				headlineRect.bottom
			);
			const groupCenter = groupTop + (groupBottom - groupTop) / 2;
			const emptyCenter = emptyRect.top + emptyRect.height / 2;

			expect(Math.abs(groupCenter - emptyCenter)).to.be.lessThan(8);
			expect(Math.round(animationRect.width)).to.equal(176);
		});

		cy.get('.sessionsList__resizeHandle').should(
			'have.attr',
			'data-scrollable',
			'false'
		);
		cy.get('.sessionsList__resizeHandlePill').then(($pillBefore) => {
			const beforeRect = $pillBefore[0].getBoundingClientRect();

			cy.get('a[href="/sessions/consultant/sessionView"]').click();
			cy.location('pathname').should(
				'equal',
				'/sessions/consultant/sessionView'
			);
			cy.contains('Bitte wählen Sie eine Nachricht aus').should(
				'not.exist'
			);
			cy.get('.sessionsList__resizeHandle').should(
				'have.attr',
				'data-scrollable',
				'false'
			);
			cy.get('.sessionsList__resizeHandlePill').should(($pillAfter) => {
				const afterRect = $pillAfter[0].getBoundingClientRect();

				expect(Math.abs(afterRect.top - beforeRect.top)).to.be.lessThan(
					1
				);
				expect(Math.abs(afterRect.height - beforeRect.height)).to.be.lessThan(
					1
				);
			});
		});

		cy.get('a[href="/sessions/consultant/sessionPreview"]').click();
		cy.location('pathname').should(
			'equal',
			'/sessions/consultant/sessionPreview'
		);

		cy.viewport(390, 844);
		cy.get('[data-cy=empty-state]').should('be.visible');
		cy.get('[data-cy=empty-state][data-empty-state=inquiry]').then(
			($emptyState) => {
				const viewportHeight =
					$emptyState[0].ownerDocument.defaultView?.innerHeight ?? 0;
				const animation = $emptyState
					.find('[data-cy=empty-state-animation]')[0]
					.getBoundingClientRect();
				const headline = $emptyState
					.find('.emptyState__headline')[0]
					.getBoundingClientRect();
				const groupTop = Math.min(animation.top, headline.top);
				const groupBottom = Math.max(
					animation.bottom,
					headline.bottom
				);
				const groupCenter = groupTop + (groupBottom - groupTop) / 2;

				expect(Math.round(animation.width)).to.equal(176);
				expect(Math.round(animation.height)).to.equal(176);
				expect(Math.abs(groupCenter - viewportHeight / 2)).to.be.lessThan(
					8
				);
			}
		);
		cy.window().then((win) => {
			expect(win.document.documentElement.scrollWidth).to.be.lessThan(
				win.innerWidth + 2
			);
		});
	});
});
