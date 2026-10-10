"""Regression tests for conservative cancelled-check supersession (#207)."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import pr_ready

HEAD = "a" * 40


def check(conclusion, start=1, end=2, name="ci", workflow="workflow-1", app="app-1", head=HEAD):
    return {"__typename": "CheckRun", "name": name, "detailsUrl": f"https://example.test/{name}/{start}",
            "status": "COMPLETED", "conclusion": conclusion,
            "startedAt": f"2026-10-10T12:00:{start:02}Z", "completedAt": f"2026-10-10T12:00:{end:02}Z",
            "checkSuite": {"app": {"id": app}, "commit": {"oid": head}, "workflowRun": {"workflow": {"id": workflow}}}}


def metadata(checks, head=HEAD, more=False):
    return {"data": {"repository": {"pullRequest": {"headRefOid": head, "commits": {"nodes": [{"commit": {
        "oid": head, "statusCheckRollup": {"contexts": {"pageInfo": {"hasNextPage": more}, "nodes": checks}}
    }}]}}}}}


class SupersededChecks(unittest.TestCase):
    def verdict(self, checks, proof=None):
        pr = {"number": 207, "url": "https://github.com/test/repo/pull/207", "state": "OPEN", "isDraft": False,
              "mergeable": "MERGEABLE", "headRefOid": HEAD, "statusCheckRollup": checks}
        with patch.object(pr_ready, "unresolved_threads", return_value=0), patch("lib.gh_json", return_value=proof or metadata(checks)):
            return pr_ready.verdict(Path.cwd(), pr)

    def test_later_success_clears_only_superseded_cancellation(self):
        self.assertEqual(self.verdict([check("CANCELLED"), check("SUCCESS", 3, 4)]), (0, "ready"))

    def test_existing_pass_conclusions_can_supersede_cancellation(self):
        for result in ["SUCCESS", "SKIPPED", "NEUTRAL"]:
            with self.subTest(result=result):
                self.assertEqual(self.verdict([check("CANCELLED"), check(result, 3, 4)]), (0, "ready"))

    def test_unordered_rollup_is_supported(self):
        self.assertEqual(self.verdict([check("SUCCESS", 3, 4), check("CANCELLED")]), (0, "ready"))

    def test_other_outcomes_cannot_replace_cancelled_check(self):
        for result in ["FAILURE", "TIMED_OUT", "UNKNOWN", None]:
            with self.subTest(result=result):
                self.assertEqual(self.verdict([check("CANCELLED"), check(result, 3, 4)])[0], 7)

    def test_real_failure_still_blocks_after_new_success(self):
        self.assertEqual(self.verdict([check("FAILURE"), check("SUCCESS", 3, 4)])[0], 7)

    def test_other_contexts_are_not_conflated(self):
        for fields in [{"workflow": "other"}, {"app": "other"}, {"head": "b" * 40}, {"name": "other"}]:
            with self.subTest(fields=fields):
                self.assertEqual(self.verdict([check("CANCELLED"), check("SUCCESS", 3, 4, **fields)])[0], 7)

    def test_earlier_or_simultaneous_success_does_not_clear_cancellation(self):
        for start, end in [(0, 1), (1, 2), (3, 1)]:
            with self.subTest(start=start, end=end):
                self.assertEqual(self.verdict([check("CANCELLED"), check("SUCCESS", start, end)])[0], 7)

    def test_pending_and_unknown_remain_blocking(self):
        for state in ["IN_PROGRESS", "QUEUED", None]:
            pending = check("SUCCESS", 5, 6, name="new-check")
            pending["status"] = state
            with self.subTest(state=state):
                self.assertEqual(self.verdict([check("CANCELLED"), check("SUCCESS", 3, 4), pending])[0], 8)

    def test_missing_or_invalid_evidence_fails_closed(self):
        for field, value in [("startedAt", None), ("completedAt", "bad"), ("checkSuite", {}), ("detailsUrl", "")]:
            cancelled = check("CANCELLED")
            cancelled[field] = value
            with self.subTest(field=field):
                self.assertEqual(self.verdict([cancelled, check("SUCCESS", 3, 4)])[0], 7)

    def test_changed_head_truncation_or_query_error_fails_closed(self):
        checks = [check("CANCELLED"), check("SUCCESS", 3, 4)]
        for proof in [metadata(checks, head="b" * 40), metadata(checks, more=True), {"errors": [{}]}]:
            with self.subTest(proof=proof):
                self.assertEqual(self.verdict(checks, proof)[0], 7)

    def test_success_must_exist_in_original_rollup_snapshot(self):
        cancelled = check("CANCELLED")
        self.assertEqual(self.verdict([cancelled], metadata([cancelled, check("SUCCESS", 3, 4)]))[0], 7)

    def test_snapshot_changes_fail_closed(self):
        checks = [check("CANCELLED"), check("SUCCESS", 3, 4)]
        pending = check(None, 5, 6, name="new-check")
        pending.update(status="IN_PROGRESS", completedAt=None)
        changed = check("SUCCESS", 3, 4)
        changed["status"] = "QUEUED"
        for fresh in [checks + [pending], checks + [check("FAILURE", 5, 6)], checks[1:],
                      [checks[0], changed], checks + [{"context": "new", "state": "PENDING"}]]:
            with self.subTest(fresh=fresh):
                self.assertEqual(self.verdict(checks, metadata(fresh))[0], 7)

    def test_ambiguous_run_identity_is_not_filtered(self):
        checks = [check("CANCELLED"), check("CANCELLED", app="other"), check("SUCCESS", 3, 4)]
        self.assertEqual(self.verdict(checks)[0], 7)

    def test_status_context_is_never_removed(self):
        checks = [check("CANCELLED"), check("SUCCESS", 3, 4), {"context": "ci", "state": "FAILURE"}]
        self.assertEqual(self.verdict(checks)[0], 7)


if __name__ == "__main__":
    unittest.main()
