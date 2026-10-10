# Windows backend claim

Worker: `astra-windows-backend`, GPT-6 Astra, Windows; base specification `6ecec2d`.
Windows owns backend implementation in `app/api/workspace/`, `lib/workspace/`, `db/schema/workspace.ts`, and the feature's tests.
Claude owns all frontend work, including first-visit initialization, invite UI and the no-recovery notice. Windows will not edit `app/invite/` or root UI files.
The draft `feat(guest-workspace)` PR is the shared claim. Frontend integration and real Neon verification remain required before feature completion.
Parent handles GitHub coordination and verification; one GPT-6 Astra builder implements backend code, with a separate read-only review.
