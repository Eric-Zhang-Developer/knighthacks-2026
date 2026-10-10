# Workspace restore response and revocation

The canonical spec defines a share ID as the first sixteen hexadecimal characters of its stored hash. A prefix
collision is unlikely but must not revoke multiple links. Count only matching rows in the caller's workspace:
zero returns 404, one is atomically revoked, and two return 409 without changing either. Repeated revocation
returns HTTP 200 `{revokedAt}` with the original timestamp. The POST accepts no body; its path identifies the link.
These reversible response choices add no table, token recovery, or new capability.

The original spec described `/s/:token` as returning HTTP 410. Inspection of the existing page and
`components/share/SharedSnapshot.tsx` shows that it is a client shell which reads `/api/shares/:token` and renders
its revoked state on that API's 410. Validation now names both existing boundaries accurately and tests both;
no share-page behavior or acceptance requirement to revoke access is removed.

All state lists are newest first with stable identifier tie-breaks and capped at fifty. Latest challenge sessions
are selected per saved version before the session cap; their rounds retain their stored order and nullable fields.
The state query uses one database snapshot and explicit public projections. Share metadata contains neither the
token nor its full hash. To change these choices, update this feature's spec, implementation and contract tests.
