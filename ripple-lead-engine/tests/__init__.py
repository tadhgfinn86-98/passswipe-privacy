"""Test package. Keeps pipeline logging out of the test output."""

import logging

logging.getLogger("ripple").setLevel(logging.CRITICAL)
