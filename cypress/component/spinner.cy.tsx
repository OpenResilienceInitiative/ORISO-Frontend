import * as React from 'react';
import { mount } from 'cypress/react';
import { Spinner } from '../../src/components/spinner/Spinner';

describe('Spinner', () => {
	it('mounts an accessible loading status in the browser', () => {
		mount(<Spinner className="component-test-spinner" />);

		cy.get('[data-cy-root]')
			.find('[role="status"].component-test-spinner')
			.should('have.length', 1)
			.and('have.attr', 'aria-live', 'polite');
	});
});
