#!/usr/bin/env python3
"""Print the standard tree hash of a launch or preview folder.

The official command, run inside the tree, is:

    find . -type f -printf '%P\\n' | LC_ALL=C sort | xargs sha256sum | sha256sum

This script runs that same pipeline and also prints the file count:

    python3 scripts/hash_tree.py /workspace/agecalculator-launch
    # files N sha256 HEX
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] in {"-h", "--help"}:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    root = Path(argv[1]).resolve()
    if not root.is_dir():
        print(f"not a directory: {root}", file=sys.stderr)
        return 2
    count = subprocess.check_output(["bash", "-lc", "find . -type f | wc -l"], cwd=root, text=True).strip()
    digest = subprocess.check_output(
        ["bash", "-lc", "find . -type f -printf '%P\\n' | LC_ALL=C sort | xargs sha256sum | sha256sum"],
        cwd=root,
        text=True,
    ).strip()
    hexdigest = digest.split()[0]
    print(f"files {count} sha256 {hexdigest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
