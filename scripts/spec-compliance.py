#!/usr/bin/env python3
"""
BMA3 Spec Compliance Checker

Verifies that code in the BMA3 repo follows the SpecOS-driven workflow.
Run from repo root: python3 scripts/spec-compliance.py

Checks:
1. Column names in SQL queries match canonical_schema.json
2. API routes in Express match api_contracts.json
3. No hardcoded static data files exist
4. No hardcoded financial constants in compute nodes
5. Scenario IDs are UUIDs, not string constructions
6. Zod schemas exist for all POST/PUT/PATCH routes
7. BullMQ worker import is not commented out
8. No console.log/console.error in production code
"""
import json
import re
import os
import sys
import glob

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECOS = os.path.join(REPO_ROOT, 'specos', 'artifacts')

errors = []
warnings = []
passes = []

def error(check, msg):
    errors.append((check, msg))
    print(f"  FAIL: {msg}")

def warn(check, msg):
    warnings.append((check, msg))
    print(f"  WARN: {msg}")

def ok(check, msg):
    passes.append((check, msg))
    print(f"  PASS: {msg}")

def read_file(path):
    try:
        with open(path) as f:
            return f.read()
    except:
        return None

def find_files(pattern, root=REPO_ROOT):
    return glob.glob(os.path.join(root, pattern), recursive=True)

# =====================================================================
# CHECK 1: No hardcoded static data files
# =====================================================================
print("=" * 60)
print("CHECK 1: No hardcoded static data files")
print("=" * 60)

static_data_dir = os.path.join(REPO_ROOT, 'web', 'lib', 'data')
if os.path.isdir(static_data_dir):
    ts_files = glob.glob(os.path.join(static_data_dir, '*.ts'))
    if ts_files:
        # Check if they're stubs (contain the STUB marker) or real data
        stub_count = 0
        real_count = 0
        for f in ts_files:
            content = read_file(f) or ''
            if 'STUB' in content and 'temporary' in content.lower():
                stub_count += 1
            elif os.path.basename(f) != 'index.ts':
                real_count += 1
        if real_count > 0:
            error(1, f"{real_count} real static data files in web/lib/data/ (should be API-driven)")
        elif stub_count > 0:
            warn(1, f"{stub_count} stub data files in web/lib/data/ (temporary — remove after Wave 4)")
        else:
            ok(1, "No .ts files in web/lib/data/")
    else:
        ok(1, "No .ts files in web/lib/data/")
else:
    ok(1, "web/lib/data/ directory does not exist")

# =====================================================================
# CHECK 2: API routes match api_contracts.json
# =====================================================================
print()
print("=" * 60)
print("CHECK 2: API routes exist in SpecOS contracts")
print("=" * 60)

api_contracts_path = os.path.join(SPECOS, 'api_contracts.json')
if os.path.exists(api_contracts_path):
    api_contracts = json.load(open(api_contracts_path))
    spec_endpoints = set()
    for ep in api_contracts.get('endpoints', api_contracts.get('apis', [])):
        spec_endpoints.add((ep.get('method', ''), ep.get('path', '')))

    # Scan Express route files for registered endpoints
    route_files = find_files('api/src/routes/**/*.ts')
    code_endpoints = set()
    for rf in route_files:
        content = read_file(rf)
        if not content:
            continue
        # Match router.get('/path', ...) or router.post('/path', ...)
        for match in re.finditer(r'router\.(get|post|put|patch|delete)\s*\(\s*[\'"]([^\'"]+)[\'"]', content, re.IGNORECASE):
            method = match.group(1).upper()
            path = match.group(2)
            code_endpoints.add((method, path))

    if code_endpoints:
        # Check for routes not in spec
        unspecced = []
        for method, path in sorted(code_endpoints):
            # Normalize: code might use /demand-drivers, spec uses /api/v1/assumptions/demand
            # This is a loose check — just flag routes for awareness
            found = False
            for sm, sp in spec_endpoints:
                if path in sp or sp.endswith(path):
                    found = True
                    break
            if not found:
                unspecced.append(f"{method} {path}")

        if unspecced:
            for u in unspecced[:5]:
                warn(2, f"Route in code but not obviously in spec: {u}")
            if len(unspecced) > 5:
                warn(2, f"...and {len(unspecced) - 5} more")
        else:
            ok(2, f"All {len(code_endpoints)} code routes have spec coverage")
    else:
        ok(2, "No route registrations found in code (routes not yet rebuilt)")
else:
    warn(2, "api_contracts.json not found in specos/artifacts/")

# =====================================================================
# CHECK 3: Column names in SQL match canonical_schema.json
# =====================================================================
print()
print("=" * 60)
print("CHECK 3: SQL column names match canonical schema")
print("=" * 60)

schema_path = os.path.join(SPECOS, 'canonical_schema.json')
if os.path.exists(schema_path):
    schema = json.load(open(schema_path))
    # Build lookup: table_name → set of field names
    schema_fields = {}
    for entity in schema.get('entities', []):
        name = entity.get('name', '')
        fields = {f['name'] for f in entity.get('fields', [])}
        schema_fields[name] = fields

    # Scan all .ts files in api/ for SQL queries
    ts_files = find_files('api/**/*.ts')
    sql_issues = []
    for tf in ts_files:
        content = read_file(tf)
        if not content:
            continue
        # Find SQL strings (template literals or regular strings with SELECT/INSERT/UPDATE)
        sql_blocks = re.findall(r'`([^`]*(?:SELECT|INSERT|UPDATE|FROM|WHERE)[^`]*)`', content, re.IGNORECASE | re.DOTALL)
        sql_blocks += re.findall(r"'([^']*(?:SELECT|INSERT|UPDATE|FROM|WHERE)[^']*)'", content, re.IGNORECASE)

        for sql in sql_blocks:
            # Extract table names from FROM/INTO/UPDATE clauses
            tables = re.findall(r'(?:FROM|INTO|UPDATE|JOIN)\s+(\w+)', sql, re.IGNORECASE)
            for table in tables:
                if table in schema_fields:
                    # Extract column references
                    # Look for table.column or just column in WHERE/SET/SELECT
                    col_refs = re.findall(rf'{table}\.(\w+)', sql)
                    for col in col_refs:
                        if col not in schema_fields[table] and col not in ('id', 'created_at', 'updated_at'):
                            sql_issues.append((os.path.relpath(tf, REPO_ROOT), table, col))

    if sql_issues:
        seen = set()
        for file, table, col in sql_issues:
            key = (table, col)
            if key not in seen:
                error(3, f"Column '{col}' not in schema for table '{table}' (in {file})")
                seen.add(key)
                if len(seen) >= 10:
                    break
        if len(sql_issues) > 10:
            error(3, f"...and {len(sql_issues) - 10} more column mismatches")
    else:
        ok(3, "No column name mismatches detected in SQL queries")
else:
    warn(3, "canonical_schema.json not found in specos/artifacts/")

# =====================================================================
# CHECK 4: No hardcoded financial constants in compute nodes
# =====================================================================
print()
print("=" * 60)
print("CHECK 4: No hardcoded financial constants")
print("=" * 60)

compute_files = find_files('api/src/compute/**/*.ts') + find_files('api/src/jobs/**/*.ts')
hardcoded_patterns = [
    (r'commission\s*=\s*0\.\d+', 'hardcoded commission rate'),
    (r'newCustomers\s*=\s*\d+', 'hardcoded newCustomers constant'),
    (r'runwayMonths\s*=\s*\d+', 'hardcoded runway assumption'),
    (r'capital\s*=\s*395000', 'hardcoded 395000 capital layout'),
    (r'cash\s*=\s*1000000', 'hardcoded 1000000 cash assumption'),
]
# Note: generic 0.20 / 2000 patterns removed — too many false positives on
# sensitivity perturbation values and volatility parameters.

hardcoded_found = []
for cf in compute_files:
    content = read_file(cf)
    if not content:
        continue
    for pattern, desc in hardcoded_patterns:
        matches = re.findall(pattern, content)
        if matches:
            hardcoded_found.append((os.path.relpath(cf, REPO_ROOT), desc))

if hardcoded_found:
    for file, desc in hardcoded_found:
        error(4, f"{desc} in {file}")
else:
    ok(4, "No hardcoded financial constants detected in compute files")

# =====================================================================
# CHECK 5: Scenario IDs are UUIDs
# =====================================================================
print()
print("=" * 60)
print("CHECK 5: Scenario IDs use UUIDs (not string constructions)")
print("=" * 60)

all_ts = find_files('web/**/*.ts') + find_files('web/**/*.tsx')
string_scenario_ids = []
for tf in all_ts:
    content = read_file(tf)
    if not content:
        continue
    # Look for sc_base_001 or sc_*_001 patterns
    matches = re.findall(r'[\'"]sc_\w+_\d+[\'"]', content)
    if matches:
        string_scenario_ids.append((os.path.relpath(tf, REPO_ROOT), matches))

if string_scenario_ids:
    for file, ids in string_scenario_ids:
        error(5, f"String scenario ID {ids[0]} in {file}")
else:
    ok(5, "No string-constructed scenario IDs found")

# =====================================================================
# CHECK 6: BullMQ worker import is active
# =====================================================================
print()
print("=" * 60)
print("CHECK 6: BullMQ worker import is active")
print("=" * 60)

server_path = os.path.join(REPO_ROOT, 'api', 'src', 'server.ts')
if os.path.exists(server_path):
    content = read_file(server_path)
    # Check if any file in api/src/ imports from jobs (direct or indirect)
    jobs_importers = []
    for tf in find_files('api/src/**/*.ts'):
        tc = read_file(tf)
        if tc and re.search(r"import.*from.*['\"].*jobs['\"]|import.*['\"].*jobs['\"]|require.*jobs", tc):
            jobs_importers.append(os.path.relpath(tf, REPO_ROOT))

    # Check line-by-line: an active import is one NOT preceded by //
    server_has_active = False
    server_has_commented = False
    for line in content.split('\n'):
        stripped = line.strip()
        if 'jobs' in stripped and 'import' in stripped:
            if stripped.startswith('//'):
                server_has_commented = True
            elif stripped.startswith('import'):
                server_has_active = True
    other_importers = [f for f in jobs_importers if 'server.ts' not in f]

    if server_has_active:
        ok(6, "BullMQ worker import is active in server.ts")
    elif server_has_commented and other_importers:
        error(6, f"BullMQ worker boot is commented out in server.ts — jobs enqueue via {other_importers[0]} but worker never starts, so compute jobs fail")
    elif server_has_commented:
        error(6, "BullMQ worker import is commented out in server.ts")
    else:
        warn(6, "Could not determine BullMQ worker import status")
else:
    warn(6, "api/src/server.ts not found")

# =====================================================================
# CHECK 7: No console.log/console.error in production code
# =====================================================================
print()
print("=" * 60)
print("CHECK 7: No console.log/console.error in production code")
print("=" * 60)

prod_ts = find_files('api/src/**/*.ts')
console_uses = []
for tf in prod_ts:
    content = read_file(tf)
    if not content:
        continue
    for i, line in enumerate(content.split('\n'), 1):
        if re.search(r'console\.(log|error|warn)\s*\(', line):
            if '//' not in line.split('console')[0]:  # not in a comment
                console_uses.append((os.path.relpath(tf, REPO_ROOT), i))

if console_uses:
    for file, line in console_uses[:5]:
        warn(7, f"console.* at {file}:{line} — should use structured logger")
    if len(console_uses) > 5:
        warn(7, f"...and {len(console_uses) - 5} more console.* uses")
else:
    ok(7, "No console.log/error in production API code")

# =====================================================================
# CHECK 8: Zod schemas exist for write endpoints
# =====================================================================
print()
print("=" * 60)
print("CHECK 8: Zod validation on write endpoints")
print("=" * 60)

schemas_dir = os.path.join(REPO_ROOT, 'api', 'src', 'schemas')
route_files = find_files('api/src/routes/**/*.ts')
write_routes_without_zod = []

for rf in route_files:
    content = read_file(rf)
    if not content:
        continue
    # Check if file has POST/PUT/PATCH handlers
    has_writes = bool(re.search(r'router\.(post|put|patch)\s*\(', content, re.IGNORECASE))
    if has_writes:
        # Check if file imports from schemas or uses z. or zod
        has_validation = bool(re.search(r'(import.*schema|import.*zod|\.parse\(|\.safeParse\(|z\.object)', content, re.IGNORECASE))
        if not has_validation:
            write_routes_without_zod.append(os.path.relpath(rf, REPO_ROOT))

if write_routes_without_zod:
    for rf in write_routes_without_zod[:5]:
        error(8, f"Write endpoint without Zod validation: {rf}")
    if len(write_routes_without_zod) > 5:
        error(8, f"...and {len(write_routes_without_zod) - 5} more")
else:
    if route_files:
        ok(8, "All write endpoints have Zod validation (or no write endpoints exist yet)")
    else:
        ok(8, "No route files exist yet (routes not rebuilt)")

# =====================================================================
# CHECK 9: SpecOS submodule is present and valid
# =====================================================================
print()
print("=" * 60)
print("CHECK 9: SpecOS submodule integrity")
print("=" * 60)

specos_validator = os.path.join(REPO_ROOT, 'specos', 'validate_specos.py')
if os.path.exists(specos_validator):
    result = os.popen(f'cd {os.path.join(REPO_ROOT, "specos")} && python3 validate_specos.py 2>&1 | tail -3').read()
    if 'PASS' in result:
        ok(9, "SpecOS submodule validates clean (PASS)")
    else:
        error(9, f"SpecOS validation failed: {result.strip()}")
else:
    error(9, "SpecOS submodule not found or validate_specos.py missing")

# =====================================================================
# SUMMARY
# =====================================================================
print()
print("=" * 60)
print("SPEC COMPLIANCE SUMMARY")
print("=" * 60)
print(f"  Checks passed:  {len(passes)}")
print(f"  Warnings:       {len(warnings)}")
print(f"  Failures:       {len(errors)}")
print()

if errors:
    print("  FAILURES:")
    for check, msg in errors:
        print(f"    [{check}] {msg}")
    print()

verdict = 'COMPLIANT' if len(errors) == 0 else 'NON-COMPLIANT'
print(f"  VERDICT: {verdict}")

sys.exit(0 if verdict == 'COMPLIANT' else 1)
