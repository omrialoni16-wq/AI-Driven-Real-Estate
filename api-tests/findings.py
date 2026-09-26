"""The marker for tests that document a known bug listed in FINDINGS.md."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

FINDINGS_FILE = Path(__file__).resolve().parent / "FINDINGS.md"

# Finding ids with a section in FINDINGS.md, from headings like "### F13: Logout doesn't ...".
DOCUMENTED = set(re.findall(r"^### (F\d+):", FINDINGS_FILE.read_text(encoding="utf-8"), flags=re.MULTILINE))


def known_bug(finding: str, summary: str) -> pytest.MarkDecorator:
    """A strict xfail for a documented finding.

    strict=True        : the day the bug is fixed, the test passes, and the run
                         fails until someone removes the marker (and the finding).
    raises=AssertionError : only a failed assertion counts as the known bug. A
                         fixture error, a connection error, or a KeyError is
                         reported as a real error instead of hiding behind the marker.

    Refuses ids that FINDINGS.md doesn't document, so the report and the tests
    can't drift apart. The check runs when the test file is imported, so a
    missing entry stops collection with this message.
    """
    if finding not in DOCUMENTED:
        raise ValueError(f"known_bug({finding!r}): no '### {finding}:' section in {FINDINGS_FILE.name}")
    return pytest.mark.xfail(strict=True, raises=AssertionError, reason=f"FINDINGS {finding}: {summary}")
