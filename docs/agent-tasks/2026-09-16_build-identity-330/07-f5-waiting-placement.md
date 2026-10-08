# F5 — nested waiting identity placement

The real GroupWaitingRoom under AuthenticatedBuildIdentityBoundary had one build
identity, but its fixed shell position was behind the fixed Join bar. Root's
390/820/1440 screenshots and hit tests are the rendered RED. The earlier 108-case
ordinary/isolated authenticated matrix does not accept this composition.

The authenticated boundary still renders exactly one identity. StageLayout now
supplies a footer target through the existing ownership context, and the boundary
portals that identity into it with the stage variant. The existing stage content
column, foreground and registration-footer clearance govern placement. No CSS,
bar controls, GroupWaitingRoom, auth gates or runtime/build identity accessors
change. The callback ref is stable; leaving the stage restores shell placement.
Loading, missing and failed entry routes have no stage and keep the shell label.

Two new tests failed on the prior production source, then passed with the fix:
actual waiting with Join/calendar must place the single identity outside the bar
in the stage footer; transitions inside the same boundary (also in StrictMode)
must restore shell placement when the stage unmounts. Existing uniqueness and
entry-state tests remain; their placement assertions now reflect this contract.
This component evidence cannot prove CSS geometry or browser visibility.

The original harness now has real nested waiting stories with and without a
calendar. Its existing assertions remain, supplemented by 9-point paint-order
hit tests for identity and actual controls, required waiting bar/control presence,
and identity/control rectangle separation. Existing screenshot contrast sampling
continues on all surfaces. The suite has 162 cases (6 surfaces × 9 widths × 3
locales). It scrolls to the document footer as before: acceptance does not prove
that a flow footer is visible in the initial viewport. Root must also inspect the
initial waiting view and scroll reachability, especially the new calendar story.

The worker did not launch or control any browser. Rendered acceptance and a
separate F5 review remain OPEN. All previous manifests, RED/GREEN files and root
port6034 fixture/probe remain historical inputs. ART/330-frontend-f5 contains the
exact prior 23 files, new RED test, validation logs and final source freeze. Final
results and limitations are in ART/implementation-330-frontend-f5.md and
ART/330-frontend-f5-ready.json. This is a local uncommitted candidate only.
