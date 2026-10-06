"""Host Python JSON conformance only; this is not a pod runtime or validator."""
import json
import sys

message = json.load(sys.stdin)
assert isinstance(message["sequence"], str)
assert 0 <= int(message["sequence"]) <= 2**64 - 1
if message["kind"] == "command" and message["command"]["lease"] is not None:
    assert int(message["command"]["lease"]["fence"]) == 9007199254740993
json.dump(message, sys.stdout, allow_nan=False, separators=(",", ":"))
