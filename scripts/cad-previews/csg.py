"""Split OpenSCAD's compiled CSG at additive boundaries, preserving booleans."""
import json
import re


def colored_components(text):
    # Compiled CSG is a tree of one-line calls, with braces on their own lines.
    # Keep subtraction/intersection/hull/extrusion subtrees intact. Only additive
    # groups and display colors can be separated without changing the geometry.
    roots = []
    stack = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line == "}":
            if not stack:
                raise ValueError("Unbalanced compiled CSG")
            stack.pop()
            continue
        match = re.fullmatch(r"([%#!*]?)(\w+)\(.*\)\s*([;{])", line)
        if not match:
            raise ValueError(f"Unsupported compiled CSG line: {line[:100]}")
        node = {"name": match[2], "modifier": match[1], "call": line[:-1].rstrip(),
                "children": [], "block": match[3] == "{"}
        (stack[-1]["children"] if stack else roots).append(node)
        if node["block"]:
            stack.append(node)
    if stack:
        raise ValueError("Unbalanced compiled CSG")

    def source(node):
        if not node["block"]:
            return node["call"] + ";"
        return node["call"] + " {\n" + "\n".join(source(c) for c in node["children"]) + "\n}"

    def first_color(node):
        if node["name"] == "color":
            match = re.fullmatch(r"color\((\[[^]]+\])\)", node["call"])
            if not match:
                raise ValueError("Unsupported compiled CSG color")
            rgba = json.loads(match[1])
            if len(rgba) != 4 or any(not isinstance(v, (int, float)) or not 0 <= v <= 1 for v in rgba):
                raise ValueError("Invalid compiled CSG color")
            return tuple(rgba[:3])
        # A boolean solid takes the first positive operand's appearance. Never
        # split cuts, intersections, hulls or extrusions into display solids.
        return first_color(node["children"][0]) if node["children"] else None

    def visit(node, transforms, color=None):
        # Background and disabled nodes do not enter a CGAL solid export.
        if node["modifier"] in ("%", "*"):
            return
        if node["name"] in ("group", "union", "color"):
            if node["name"] == "color":
                color = first_color(node)
            for child in node["children"]:
                yield from visit(child, transforms, color)
        elif node["name"] == "multmatrix":
            for child in node["children"]:
                yield from visit(child, [*transforms, node["call"]], color)
        elif node["name"] == "difference" and node["children"]:
            positive = list(visit(node["children"][0], [], color))
            if len({c for _, c in positive}) > 1:
                # (A union B) minus C = (A minus C) union (B minus C).
                # Retain every cut, in the difference's coordinate frame, so
                # board holes survive while its lens/connectors keep their colors.
                cuts = "\n".join(source(c) for c in node["children"][1:])
                for geometry, finish in positive:
                    geometry = "difference() {\n" + geometry + "\n" + cuts + "\n}"
                    for transform in reversed(transforms):
                        geometry = transform + " {\n" + geometry + "\n}"
                    yield geometry, finish
            else:
                geometry = source(node)
                for transform in reversed(transforms):
                    geometry = transform + " {\n" + geometry + "\n}"
                yield geometry, color or first_color(node)
        else:
            geometry = source(node)
            for transform in reversed(transforms):
                geometry = transform + " {\n" + geometry + "\n}"
            yield geometry, color or first_color(node)

    return [component for node in roots for component in visit(node, [])]


def components(text):
    return [geometry for geometry, _ in colored_components(text)]
