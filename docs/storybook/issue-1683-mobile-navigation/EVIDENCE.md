# #1683 mobile navigation evidence

Local Storybook, Node22.23.3, Chrome 375×812 viewport. Runtime consultant navigation uses production NavigationBar and styles; page heading and build identity 2.9.14-abc1234 are fixtures. No live backend or Dev environment verified.

- 01-before-375-shell.jpg: build identity overlaps the mobile bar labels.
- 02-after-375-actions.jpg: build identity clears bar; scrolled actions show language and focused logout.

Automated Storybook play test proves 375px scrollport containment, non-overlapping version, horizontally scrollable content, language/logout bounds after scrolling, and logout activation by Enter. Existing desktop stories also pass. Screenshots alone do not prove keyboard activation.
