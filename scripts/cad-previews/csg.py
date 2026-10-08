"""Split OpenSCAD's compiled CSG at additive boundaries, preserving booleans."""
import re


def components(text):
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

    def visit(node, transforms):
        # Background and disabled nodes do not enter a CGAL solid export.
        if node["modifier"] in ("%", "*"):
            return
        if node["name"] in ("group", "union", "color"):
            for child in node["children"]:
                yield from visit(child, transforms)
        elif node["name"] == "multmatrix":
            for child in node["children"]:
                yield from visit(child, [*transforms, node["call"]])
        else:
            geometry = source(node)
            for transform in reversed(transforms):
                geometry = transform + " {\n" + geometry + "\n}"
            yield geometry

    return [geometry for node in roots for geometry in visit(node, [])]
