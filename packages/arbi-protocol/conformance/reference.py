"""Independent offline Linux/Python fixture consumer; no Pi or hardware I/O.

This checks the reference subset, not every production schema/admission rule.
Configuration digest inputs here are the committed ASCII/integer fixture subset.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys


def fail(code):
    raise ValueError(code)


def equal(actual, expected, code):
    if actual != expected:
        fail(code)


def close(actual, expected):
    if not math.isfinite(actual) or not math.isfinite(expected):
        fail("RESULT_MISMATCH")
    if abs(actual - expected) > 1e-7 + 1e-12 * abs(expected):
        fail("RESULT_MISMATCH")


def counter(value):
    if not isinstance(value, str) or not re.fullmatch(r"0|[1-9][0-9]{0,19}", value):
        fail("COUNTER_MISMATCH")
    result = int(value)
    if result > 2**64 - 1:
        fail("COUNTER_MISMATCH")
    return result


def digest(value):
    # No floating-point JSON canonicalization is promised by this host subset.
    def subset(v):
        if isinstance(v, dict):
            for key, child in v.items():
                if not key.isascii():
                    fail("INVALID_CONFIGURATION")
                subset(child)
        elif isinstance(v, list):
            for child in v:
                subset(child)
        elif isinstance(v, str):
            if not v.isascii():
                fail("INVALID_CONFIGURATION")
        elif v is not None and not isinstance(v, (int, bool)):
            fail("INVALID_CONFIGURATION")
    subset(value)
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    return hashlib.sha256(data.encode()).hexdigest()


def check(root, vector_file):
    def read(path):
        return json.loads((root / path).read_text())

    vectors = json.loads(vector_file.read_text())
    identity = vectors["identity"]
    equal(vectors["fixtureVersion"], "arbi.reference/1.0", "VERSION_MISMATCH")
    equal(identity["protocol"]["version"], "arbi/1.0", "VERSION_MISMATCH")
    equal(identity["configurationSchema"]["version"], "arbi.configuration/1.0", "VERSION_MISMATCH")
    equal(vectors["units"], {"position": "mm", "angle": "deg", "speed": "mm/s", "acceleration": "mm/s^2", "force": "N", "time": "ms"}, "UNIT_MISMATCH")
    for key, path, schema_id in [
        ("protocol", "schema/message.schema.json", "https://arbi.gredice.com/schemas/protocol/1.0/message.schema.json"),
        ("configurationSchema", "schema/configuration.schema.json", "https://arbi.gredice.com/schemas/configuration/1.0/configuration.schema.json"),
    ]:
        content = (root / path).read_bytes()
        equal(identity[key]["id"], schema_id, "SCHEMA_MISMATCH")
        equal(json.loads(content)["$id"], schema_id, "SCHEMA_MISMATCH")
        equal(hashlib.sha256(content).hexdigest(), identity[key]["sha256"], "SCHEMA_MISMATCH")
    config = read("fixtures/configuration.json")["valid"]["configuration"]
    equal(digest(config), identity["configurationDigest"], "IDENTITY_MISMATCH")
    equal(config["schemaVersion"], identity["configurationSchema"]["version"], "VERSION_MISMATCH")
    geometry, calibration = config["geometry"], config["calibration"]
    for actual, expected in [(config["revision"], identity["configurationRevision"]), (geometry["revision"], identity["geometryRevision"]), (calibration["revision"], identity["calibrationRevision"]), (config["executionMode"], "simulation"), (calibration["scope"], "simulation"), (geometry["convention"], "right-handed-x-y-z-mm-deg")]:
        equal(actual, expected, "IDENTITY_MISMATCH")
    equal(geometry["siteFrame"], identity["siteFrame"], "FRAME_MISMATCH")
    equal(geometry["gimbalFrame"], identity["gimbalFrame"], "FRAME_MISMATCH")
    equal(geometry["siteFrame"]["name"], "site", "FRAME_MISMATCH")
    equal(geometry["gimbalFrame"]["name"], "pod-gimbal", "FRAME_MISMATCH")
    anchors = {a["line"]: a["positionMm"] for a in geometry["anchors"]}
    if len(geometry["anchors"]) != 4 or set(anchors) != set("abcd"):
        fail("GEOMETRY_MISMATCH")
    a, b, c, d = (anchors[line] for line in "abcd")
    if not (a["x"] < b["x"] and a["y"] < d["y"] and a["y"] == b["y"] and b["x"] == c["x"] and c["y"] == d["y"] and d["x"] == a["x"] and all(p["z"] == a["z"] for p in [b, c, d])):
        fail("GEOMETRY_MISMATCH")
    message = read("fixtures/contracts.json")["valid"]["move"]
    equal(message["protocol"], identity["protocol"]["version"], "VERSION_MISMATCH")
    equal(message["command"]["configRevision"], config["revision"], "IDENTITY_MISMATCH")
    equal(message["body"]["frame"], geometry["siteFrame"], "FRAME_MISMATCH")
    equal(message["executionMode"], "simulation", "IDENTITY_MISMATCH")
    equal(message["siteId"], config["siteId"], "IDENTITY_MISMATCH")
    equal(message["realm"], config["realm"], "IDENTITY_MISMATCH")
    counter(message["sequence"])
    counter(message["command"]["lease"]["fence"])
    equal(json.loads(json.dumps(message, allow_nan=False)), message, "SERIALIZATION_MISMATCH")
    for key in ["counters", "conversions", "transforms", "geometry", "offsets"]:
        if not vectors[key]:
            fail("INVALID_VECTORS")
    for row in vectors["counters"]:
        value = counter(row["value"])
        expected = None if value == 2**64 - 1 else str(value + 1)
        equal(row["successor"], expected, "COUNTER_MISMATCH")
        if expected is not None:
            counter(row["successor"])
    for row in vectors["conversions"]:
        pair = (row["from"], row["to"])
        if pair in [("m", "mm"), ("s", "ms"), ("m/s", "mm/s"), ("m/s^2", "mm/s^2")]:
            result = row["value"] * 1000
        elif pair == ("mm", "m"):
            result = row["value"] / 1000
        elif pair == ("rad", "deg"):
            result = math.degrees(row["value"])
        elif pair == ("deg", "rad"):
            result = math.radians(row["value"])
        else:
            fail("UNIT_MISMATCH")
        close(result, row["expected"])
    for row in vectors["transforms"]:
        equal(row["siteFrame"], geometry["siteFrame"], "FRAME_MISMATCH")
        angle = math.radians(row["yawDeg"])
        sine, cosine = math.sin(angle), math.cos(angle)
        p, origin, expected = row["localMm"], row["translationMm"], row["expectedSiteMm"]
        close(origin["x"] + cosine * p["x"] - sine * p["y"], expected["x"])
        close(origin["y"] + sine * p["x"] + cosine * p["y"], expected["y"])
        close(origin["z"] + p["z"], expected["z"])
        x, y = expected["x"] - origin["x"], expected["y"] - origin["y"]
        close(cosine * x + sine * y, p["x"])
        close(-sine * x + cosine * y, p["y"])
        close(expected["z"] - origin["z"], p["z"])
    for row in vectors["geometry"]:
        equal(row["siteFrame"], geometry["siteFrame"], "FRAME_MISMATCH")
        p = row["positionMm"]
        workspace = config["limits"]["workspace"]
        for axis in "xyz":
            if not workspace["minMm"][axis] + calibration["uncertaintyMm"] <= p[axis] <= workspace["maxMm"][axis] - calibration["uncertaintyMm"]:
                fail("GEOMETRY_MISMATCH")
        for line, anchor in anchors.items():
            squared = sum((anchor[axis] - p[axis])**2 for axis in "xyz")
            close(squared, row["expectedSquaredMm2"][line])
            close(math.dist([anchor[axis] for axis in "xyz"], [p[axis] for axis in "xyz"]), row["expectedLengthMm"][line])
            if math.sqrt(squared) + calibration["lineLengthOffsetsMm"][line] <= calibration["uncertaintyMm"]:
                fail("GEOMETRY_MISMATCH")
    move_row = next(row for row in vectors["geometry"] if row["id"] == "motion-message")
    equal(move_row["positionMm"], message["body"]["positionMm"], "GEOMETRY_MISMATCH")
    for row in vectors["offsets"]:
        payout = row["geometricMm"] + row["offsetMm"]
        if row["geometricMm"] <= 0 or payout <= 0:
            fail("GEOMETRY_MISMATCH")
        close(payout, row["expectedPayoutMm"])
    return {"fixtureVersion": vectors["fixtureVersion"], "protocol": message["protocol"], "configurationSchema": config["schemaVersion"], "configurationRevision": config["revision"], "configurationDigest": identity["configurationDigest"], "geometryRevision": geometry["revision"], "calibrationRevision": calibration["revision"]}


if __name__ == "__main__":
    try:
        root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
        vector_file = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "fixtures/reference/1.0/vectors.json"
        print(json.dumps(check(root, vector_file), separators=(",", ":")))
    except (ValueError, KeyError, TypeError, StopIteration, OSError) as error:
        codes = {"VERSION_MISMATCH", "UNIT_MISMATCH", "SCHEMA_MISMATCH", "IDENTITY_MISMATCH", "FRAME_MISMATCH", "COUNTER_MISMATCH", "RESULT_MISMATCH", "GEOMETRY_MISMATCH", "SERIALIZATION_MISMATCH", "INVALID_CONFIGURATION"}
        print(str(error) if str(error) in codes else "INVALID_VECTORS", file=sys.stderr)
        sys.exit(2)
