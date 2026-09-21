"""Test-facing re-export of the offline client.

The implementation lives in ripple/offline.py so the web app's Demo mode can
use it too, without the package importing from the test tree.
"""

from pathlib import Path

from ripple.offline import DEMO_WEBSITES, OfflineClient, load  # noqa: F401

FIXTURES = Path(__file__).parent.parent / "ripple" / "sample_data"
