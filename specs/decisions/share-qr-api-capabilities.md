# Share capability and revocation boundaries

kiro-agent-1: generate 16 cryptographically random bytes as a canonical 22-character base64url token; persist only its SHA-256 hash. Strict canonical decoding rejects alternate encodings. POST accepts only snapshotId within the existing bounded JSON reader, requires same-origin workspace membership, and authorizes the snapshot within the INSERT SELECT. Each create returns 201 {token,url}; the URL is /s/<token> on the request's app origin, never a supplied URL or forwarded header. A rare unique collision fails safely; it never replaces another share.

GET is a public capability read. It performs no session lookup, sets no cookies, and returns only frozen snapshot data with no-store headers. A single query reads revocation and snapshot data; revoked rows select null data and return exact 410 {error:"revoked"}. Malformed and unknown tokens return 404. Unexpected failures return sanitized 503, without token/database details.

DELETE requires same-origin membership in the snapshot's owning workspace. Both workspace members qualify: no owner-role column exists. Authorization and revocation occur in one UPDATE. Repeated authorized revocation returns 204 without changing the original revoked_at. Unknown and foreign tokens both return 404, avoiding ownership disclosure. No workspace identity is granted by possession of a share token.

A response read before revocation commits cannot be recalled. Reads beginning after commit see 410; no-store prevents deliberate application caching. Snapshot/workspace deletion cascades share deletion. Tokens/URLs are bearer capabilities and must not appear in saved tests, traces or logs; retain sanitized statuses and non-capability record identities instead. QR generation belongs to the frontend feature.

Undo: coordinate token format/URL changes with share consumers. Expiry, recovery and role-based ownership are outside this contract. Mocked tests do not replace canonical real-Neon create/read/revoke verification.
