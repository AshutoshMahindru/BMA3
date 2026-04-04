#!/usr/bin/env python3
"""
Generate Zod validation schemas from canonical_schema.json
"""

import json
import os
import re

SCHEMA_PATH = "/home/user/workspace/bma3_work/specos/artifacts/canonical_schema.json"
OUTPUT_DIR = "/home/user/workspace/bma3_work/api/src/schemas"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(SCHEMA_PATH) as f:
    schema = json.load(f)

enum_types = schema.get("enum_types", {})
entities = schema.get("entities", [])

# ----- Helpers -----

def to_pascal(snake: str) -> str:
    """Convert snake_case entity name to PascalCase class name (singular)."""
    parts = snake.split("_")
    # Strip trailing 's' from last part to get singular form heuristically
    last = parts[-1]
    if last.endswith("ies"):
        last = last[:-3] + "y"
    elif last.endswith("ses") or last.endswith("xes") or last.endswith("zes"):
        last = last[:-2]
    elif last.endswith("s") and len(last) > 2:
        last = last[:-1]
    parts[-1] = last
    return "".join(p.capitalize() for p in parts)

def parse_varchar_len(type_str: str):
    """Extract N from VARCHAR(N)."""
    m = re.match(r"VARCHAR\((\d+)\)", type_str, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None

def parse_check_constraint(constraints: list, field_name: str, field_type: str):
    """
    Parse CHECK constraints and return extra zod chain calls.
    Returns list of additional chain parts like ['.min(1)', '.max(12)']
    """
    extras = []
    for c in constraints:
        c_upper = c.upper()
        # BETWEEN X AND Y
        m = re.search(r"BETWEEN\s+(-?\d+(?:\.\d+)?)\s+AND\s+(-?\d+(?:\.\d+)?)", c_upper)
        if m:
            lo = m.group(1)
            hi = m.group(2)
            extras.append(f".min({lo}).max({hi})")
            continue
        # CHECK(value > 0) or > N
        m = re.search(r">\s*(-?\d+(?:\.\d+)?)", c)
        if m and "IN " not in c_upper:
            val = float(m.group(1))
            extras.append(f".min({val + 1})")  # strictly greater than
            continue
        # CHECK(value >= N)
        m = re.search(r">=\s*(-?\d+(?:\.\d+)?)", c)
        if m and "IN " not in c_upper:
            extras.append(f".min({m.group(1)})")
            continue
        # CHECK(value > 0) shorthand → positive
        if re.search(r">\s*0\b", c) and "IN " not in c_upper:
            extras.append(".positive()")
            continue
    return extras


def get_enum_for_check(constraints: list, enum_types: dict):
    """
    If constraint is CHECK(field IN ('a','b',...)), return the enum values.
    Also try to match against known enum_types.
    """
    for c in constraints:
        m = re.search(r"CHECK\s*\(.+?\s+IN\s+\((.+?)\)\)", c, re.IGNORECASE)
        if m:
            raw = m.group(1)
            values = [v.strip().strip("'\"") for v in raw.split(",")]
            return values
    return None


def field_to_zod(field: dict, enum_types: dict) -> str:
    """Convert a field definition to its Zod chain string (without .optional()/.nullable())."""
    ftype = field["type"].upper()
    constraints = field.get("constraints", []) or []
    field_name = field["name"]

    # Check for enum constraint first
    enum_vals = get_enum_for_check(constraints, enum_types)
    if enum_vals:
        vals_str = ", ".join(f"'{v}'" for v in enum_vals)
        return f"z.enum([{vals_str}])"

    # Check if field name matches a known enum type exactly
    # (some fields are named after enum types but stored as TEXT)
    # We won't auto-map these without explicit CHECK constraints to avoid false positives.

    varchar_len = parse_varchar_len(field["type"])

    if ftype == "UUID":
        return "z.string().uuid()"
    elif ftype in ("TEXT", "VARCHAR") and varchar_len is None:
        return "z.string()"
    elif varchar_len is not None:
        return f"z.string().max({varchar_len})"
    elif ftype.startswith("VARCHAR("):
        n = parse_varchar_len(field["type"])
        return f"z.string().max({n})"
    elif ftype == "INTEGER":
        base = "z.number().int()"
        extras = parse_check_constraint(constraints, field_name, ftype)
        return base + "".join(extras)
    elif ftype.startswith("DECIMAL") or ftype.startswith("NUMERIC") or ftype == "FLOAT" or ftype == "REAL":
        base = "z.number()"
        extras = parse_check_constraint(constraints, field_name, ftype)
        return base + "".join(extras)
    elif ftype == "BOOLEAN":
        return "z.boolean()"
    elif ftype == "TIMESTAMPTZ" or ftype == "TIMESTAMP":
        return "z.string().datetime()"
    elif ftype == "DATE":
        return "z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)"
    elif ftype == "JSONB" or ftype == "JSON":
        return "z.record(z.string(), z.unknown())"
    elif ftype == "BIGINT":
        return "z.number().int()"
    else:
        # Fallback
        return "z.unknown()"


def build_field_line(field: dict, enum_types: dict, in_insert: bool) -> str | None:
    """
    Build a single field line for the Zod object.
    in_insert=True → exclude id, created_at, updated_at; apply optional for defaults.
    in_insert=False (Full) → include all fields as-is.
    Returns None to skip the field.
    """
    fname = field["name"]
    ftype_raw = field["type"]
    nullable = field.get("nullable", True)
    default = field.get("default")
    is_pk = field.get("primary_key", False)
    constraints = field.get("constraints", []) or []

    AUTO_FIELDS = {"id", "created_at", "updated_at"}

    if in_insert and fname in AUTO_FIELDS:
        return None  # skip auto fields in Insert

    zod_chain = field_to_zod(field, enum_types)

    if nullable:
        zod_chain += ".nullable()"

    # In Insert schema: fields with a default → optional (caller can omit)
    if in_insert and default is not None:
        zod_chain += ".optional()"
    elif not in_insert and fname in AUTO_FIELDS:
        # In Full schema: id/created_at/updated_at are always present strings
        # (they're handled in extend, so this branch won't normally run)
        pass

    return f"  {fname}: {zod_chain},"


def generate_entity_file(entity: dict, enum_types: dict) -> str:
    name = entity["name"]
    pascal = to_pascal(name)
    fields = entity.get("fields", [])

    insert_lines = []
    full_extra_lines = []  # lines for Full schema extension

    for field in fields:
        fname = field["name"]
        ftype_raw = field["type"]
        nullable = field.get("nullable", True)
        default = field.get("default")
        is_pk = field.get("primary_key", False)

        AUTO_FIELDS = {"id", "created_at", "updated_at"}

        if fname in AUTO_FIELDS:
            # Only goes into Full extension
            if fname == "id":
                full_extra_lines.append("  id: z.string().uuid(),")
            elif fname in ("created_at", "updated_at"):
                full_extra_lines.append(f"  {fname}: z.string().datetime(),")
            continue

        # Build Insert field
        zod_chain = field_to_zod(field, enum_types)

        if nullable:
            zod_chain += ".nullable()"

        # Fields with a default are optional in Insert (caller may omit)
        if default is not None:
            zod_chain += ".optional()"

        insert_lines.append(f"  {fname}: {zod_chain},")

    insert_body = "\n".join(insert_lines)
    full_body = "\n".join(full_extra_lines)

    lines = [
        f"// Generated from specos/artifacts/canonical_schema.json → entities[name=\"{name}\"]",
        "// DO NOT EDIT — regenerate from SpecOS artifacts",
        "",
        "import { z } from 'zod';",
        "",
        f"/** Insert schema — validates POST body for creating a {pascal} */",
        f"export const {pascal}Insert = z.object({{",
        insert_body,
        "});",
        "",
        f"/** Update schema — all fields optional */",
        f"export const {pascal}Update = {pascal}Insert.partial();",
        "",
        f"/** Full entity schema — includes auto-generated fields */",
        f"export const {pascal}Full = {pascal}Insert.extend({{",
        full_body,
        "});",
        "",
        f"export type {pascal}InsertType = z.infer<typeof {pascal}Insert>;",
        f"export type {pascal}UpdateType = z.infer<typeof {pascal}Update>;",
        f"export type {pascal}FullType = z.infer<typeof {pascal}Full>;",
        "",
    ]

    return "\n".join(lines)


def entity_to_filename(name: str) -> str:
    return name.replace("_", "-")


# ----- Generate -----

index_exports = []
generated_entities = []

for entity in entities:
    name = entity["name"]
    pascal = to_pascal(name)
    filename = entity_to_filename(name)

    content = generate_entity_file(entity, enum_types)

    out_path = os.path.join(OUTPUT_DIR, f"{filename}.ts")
    with open(out_path, "w") as f:
        f.write(content)

    index_exports.append(f"export * from './{filename}';")
    generated_entities.append((name, pascal, filename))
    print(f"  Generated: {filename}.ts  ({pascal})")

# ----- Generate index.ts -----

index_lines = [
    "// Generated from specos/artifacts/canonical_schema.json",
    "// DO NOT EDIT — regenerate from SpecOS artifacts",
    "",
]
index_lines.extend(index_exports)
index_lines.append("")

index_path = os.path.join(OUTPUT_DIR, "index.ts")
with open(index_path, "w") as f:
    f.write("\n".join(index_lines))

print(f"\nindex.ts written with {len(index_exports)} exports.")
print(f"\nNOTE: 'zod' is NOT in api/package.json. Add it with:")
print("  cd api && npm install zod")
