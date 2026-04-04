#!/usr/bin/env python3
"""
Generator: TypeScript entity interfaces and enum types from canonical_schema.json
"""

import json
import re
from pathlib import Path

SCHEMA_PATH = Path('/home/user/workspace/bma3_work/specos/artifacts/canonical_schema.json')
ENUMS_OUT = Path('/home/user/workspace/bma3_work/api/src/types/enums.ts')
ENTITIES_OUT = Path('/home/user/workspace/bma3_work/api/src/types/entities.ts')

with open(SCHEMA_PATH) as f:
    schema = json.load(f)

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def to_pascal(snake: str) -> str:
    """scope_bundle_items → ScopeBundleItems"""
    return ''.join(word.capitalize() for word in snake.split('_'))

def to_upper_snake(value: str) -> str:
    """source_quality → SOURCE_QUALITY"""
    return value.upper()

def pg_type_to_ts(pg_type: str, nullable: bool) -> str:
    """Map a PostgreSQL type string to a TypeScript type."""
    t = pg_type.strip().upper()

    if t == 'UUID':
        ts = 'string'
        comment = ' // UUID'
    elif t == 'TEXT':
        ts = 'string'
        comment = ''
    elif t.startswith('VARCHAR'):
        ts = 'string'
        comment = ''
    elif t == 'INTEGER':
        ts = 'number'
        comment = ''
    elif t.startswith('DECIMAL') or t.startswith('NUMERIC'):
        ts = 'number'
        comment = ''
    elif t == 'BOOLEAN':
        ts = 'boolean'
        comment = ''
    elif t == 'TIMESTAMPTZ':
        ts = 'string'
        comment = ' // ISO timestamp'
    elif t == 'DATE':
        ts = 'string'
        comment = ' // YYYY-MM-DD'
    elif t == 'JSONB' or t == 'JSON':
        ts = 'Record<string, unknown>'
        comment = ''
    else:
        # Fallback
        ts = 'unknown'
        comment = f' // {pg_type}'

    if nullable:
        ts = ts + ' | null'

    return ts, comment

# ──────────────────────────────────────────────────────────────────────────────
# 1. Generate enums.ts
# ──────────────────────────────────────────────────────────────────────────────

lines = [
    '// Generated from specos/artifacts/canonical_schema.json enum_types',
    '// DO NOT EDIT — regenerate from SpecOS artifacts',
    '',
]

for enum_name, enum_def in schema['enum_types'].items():
    pascal_name = to_pascal(enum_name)
    description = enum_def.get('description', '')
    values = enum_def['values']

    lines.append(f'/** {description} */')
    lines.append(f'export enum {pascal_name} {{')
    for v in values:
        key = to_upper_snake(v)
        lines.append(f"  {key} = '{v}',")
    lines.append('}')
    lines.append('')

ENUMS_OUT.write_text('\n'.join(lines))
print(f"Written: {ENUMS_OUT}  ({len(schema['enum_types'])} enums)")

# ──────────────────────────────────────────────────────────────────────────────
# 2. Generate entities.ts
# ──────────────────────────────────────────────────────────────────────────────

# Build sorted entity list (by interface name, i.e. PascalCase of table name)
entities = sorted(schema['entities'], key=lambda e: to_pascal(e['name']))

# Collect all enum pascal names for the import line
enum_pascal_names = [to_pascal(k) for k in schema['enum_types'].keys()]

lines = [
    f'// Generated from specos/artifacts/canonical_schema.json',
    f'// DO NOT EDIT — regenerate from SpecOS artifacts',
    f'// Entity count: {len(entities)} (all 50 entities, alphabetised by interface name)',
    f'// Source: specos/artifacts/canonical_schema.json  generated_at={schema["meta"]["generated_at"]}',
    '',
    '// prettier-ignore',
    f'import {{',
    f'  {", ".join(enum_pascal_names)}',
    f'}} from \'./enums\';',
    '',
    '// NOTE: Enum fields are typed as string in the DB schema; cast to the appropriate',
    '// enum type at the application boundary if needed.',
    '',
]

# Auto-generated fields omitted in Insert types
AUTO_FIELDS = {'id', 'created_at', 'updated_at'}

for ent in entities:
    pascal = to_pascal(ent['name'])
    description = ent.get('description', '')
    fields = ent['fields']

    # Interface header
    lines.append(f'/** {description} */')
    lines.append(f'export interface {pascal} {{')

    for field in fields:
        fname = field['name']
        ftype = field['type']
        nullable = field['nullable']
        fdesc = field.get('description', '')

        ts_type, comment = pg_type_to_ts(ftype, nullable)

        # Build the line
        optional_mark = '?' if nullable else ''
        desc_comment = f'  // {fdesc}' if fdesc and not comment else ''
        if comment and fdesc:
            full_comment = f'{comment}; {fdesc}'
        elif comment:
            full_comment = comment
        elif fdesc:
            full_comment = f'  // {fdesc}'
        else:
            full_comment = ''

        lines.append(f'  {fname}{optional_mark}: {ts_type};{full_comment}')

    lines.append('}')
    lines.append('')

    # Insert / Update utility types
    omit_list = ' | '.join(f"'{f}'" for f in sorted(AUTO_FIELDS))
    lines.append(f'export type {pascal}Insert = Omit<{pascal}, {omit_list}>;')
    lines.append(f'export type {pascal}Update = Partial<{pascal}Insert>;')
    lines.append('')

ENTITIES_OUT.write_text('\n'.join(lines))
print(f"Written: {ENTITIES_OUT}  ({len(entities)} entities)")
