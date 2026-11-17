"""Every local href/src in the built preview docs must resolve to a file."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_copy import DOCS, verify_local_refs

if __name__ == "__main__":
    verify_local_refs(DOCS)
