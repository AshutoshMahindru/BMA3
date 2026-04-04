"""
Generator for TypeScript API types and client from api_contracts.json
"""
import json
import re
from collections import defaultdict

with open('/home/user/workspace/bma3_work/specos/artifacts/api_contracts.json') as f:
    data = json.load(f)

endpoints = data['endpoints']

# ─────────────────────────────────────────────
# Utility helpers
# ─────────────────────────────────────────────

TYPE_MAP = {
    'string': 'string',
    'integer': 'number',
    'number': 'number',
    'boolean': 'boolean',
    'uuid': 'string',
    'datetime': 'string',
    'date': 'string',
    'array': 'unknown[]',
    'object': 'Record<string, unknown>',
}

def json_type_to_ts(t: str) -> str:
    return TYPE_MAP.get(t, 'unknown')

def to_pascal(s: str) -> str:
    parts = re.split(r'[-_/]', s)
    return ''.join(p[0].upper() + p[1:] if p else '' for p in parts)

def extract_path_params(path: str) -> list:
    return re.findall(r':(\w+)', path)

def path_to_template(path: str) -> str:
    p = re.sub(r'^/api/v1', '', path)
    p = re.sub(r':(\w+)', r'${\1}', p)
    return p

def props_to_ts_interface_body(properties: dict, required: list, indent: str = '  ') -> str:
    lines = []
    for prop_name, prop_def in properties.items():
        ts_type = json_type_to_ts(prop_def.get('type', 'string'))
        is_required = prop_name in required
        optional = '' if is_required else '?'
        desc = prop_def.get('description', '')
        comment = f'  // {desc}' if desc else ''
        lines.append(f'{indent}{prop_name}{optional}: {ts_type};{comment}')
    return '\n'.join(lines)

def resp_data_to_inline_ts(data_schema: dict) -> str:
    """Inline TS type for the data property."""
    if not data_schema:
        return 'unknown'
    dtype = data_schema.get('type', 'object')
    if dtype == 'array':
        items = data_schema.get('items', {})
        item_props = items.get('properties', {})
        if item_props:
            prop_lines = ['  Array<{']
            for k, v in item_props.items():
                ts_t = json_type_to_ts(v.get('type', 'string'))
                prop_lines.append(f'    {k}: {ts_t};')
            prop_lines.append('  }>')
            return '\n'.join(prop_lines)
        return '  unknown[]'
    elif dtype == 'object':
        props = data_schema.get('properties', {})
        if props:
            prop_lines = ['  {']
            for k, v in props.items():
                ts_t = json_type_to_ts(v.get('type', 'string'))
                prop_lines.append(f'    {k}: {ts_t};')
            prop_lines.append('  }')
            return '\n'.join(prop_lines)
        return '  Record<string, unknown>'
    else:
        return f'  {json_type_to_ts(dtype)}'


# ─────────────────────────────────────────────
# Endpoint name derivation
# ─────────────────────────────────────────────

def ep_type_name(ep: dict) -> str:
    """
    Derive a unique PascalCase base name from an endpoint.
    Rules:
    - GET /resource            -> GetStageName  (list)
    - GET /resource/:id        -> GetStageNameById  (single-item)
    - GET /resource/:id/sub    -> GetStageNameSub
    - POST /resource           -> CreateStageName
    - PATCH /resource/:id      -> UpdateStageNameById
    """
    method = ep['method']
    path = ep['path']
    
    if method == 'GET':
        prefix = 'Get'
    elif method == 'POST':
        prefix = 'Create'
    elif method == 'PATCH':
        prefix = 'Update'
    elif method == 'PUT':
        prefix = 'Upsert'
    elif method == 'DELETE':
        prefix = 'Delete'
    else:
        prefix = method[0].upper() + method[1:].lower()
    
    # Strip /api/v1/
    path_stripped = re.sub(r'^/api/v1/', '', path)
    parts = path_stripped.split('/')
    
    name_parts = []
    has_trailing_param = False
    
    for i, p in enumerate(parts):
        if p.startswith(':'):
            is_last = (i == len(parts) - 1)
            if is_last:
                has_trailing_param = True
        else:
            name_parts.append(to_pascal(p))
    
    base = prefix + ''.join(name_parts)
    
    # Add ById suffix when path ends with a path parameter (disambiguates list vs single)
    if has_trailing_param and method in ('GET', 'PATCH', 'PUT', 'DELETE'):
        base = base + 'ById'
    
    return base


def ep_function_name(ep: dict) -> str:
    """camelCase function name."""
    pascal = ep_type_name(ep)
    # Convert special action verbs: CreateContextScenarios:scenarioId:Clone -> cloneContextScenario
    method = ep['method']
    path = ep['path']
    parts = re.sub(r'^/api/v1/', '', path).split('/')
    
    # Check last non-param segment for action verbs
    ACTION_VERBS = {'clone', 'apply', 'cancel', 'freeze', 'publish', 'unpublish',
                    'submit', 'approve', 'reject', 'sequence', 'bulk', 'validate',
                    'compute', 'simulate', 'upsert', 'review', 'summary', 'results',
                    'steps', 'issues', 'links', 'rationale'}
    
    non_param_parts = [p for p in parts if not p.startswith(':')]
    last_part = non_param_parts[-1] if non_param_parts else ''
    
    if last_part in ACTION_VERBS and method == 'POST':
        # Build name using action verb as prefix
        non_last = non_param_parts[:-1]
        entity_parts = [to_pascal(p) for p in non_last]
        entity_name = ''.join(entity_parts)
        fn_name = last_part + entity_name[0].upper() + entity_name[1:] if entity_name else last_part
        return fn_name
    
    # Default: camelCase of pascal
    return pascal[0].lower() + pascal[1:]


# ─────────────────────────────────────────────
# Dedup names (when same path + different method produces same Response name)
# ─────────────────────────────────────────────

# Track used names and add numeric suffix if needed
_used_type_names = {}

def unique_type_name(base_name: str, ep_id: str) -> str:
    if base_name not in _used_type_names:
        _used_type_names[base_name] = ep_id
        return base_name
    else:
        # Already used — check if same ep
        if _used_type_names[base_name] == ep_id:
            return base_name
        # Different ep — need disambiguation
        # Use ep index suffix
        count = sum(1 for k in _used_type_names if k.startswith(base_name))
        new_name = f'{base_name}{count}'
        _used_type_names[new_name] = ep_id
        return new_name

def unique_fn_name(base_name: str, ep_id: str) -> str:
    return unique_type_name(base_name, ep_id)


# ─────────────────────────────────────────────
# Precompute all names (to handle duplicates)
# ─────────────────────────────────────────────

ep_names = {}  # ep_id -> { type_base, fn_name, req_type, resp_type }

_used_fn = {}
_used_resp = {}
_used_req = {}

for ep in endpoints:
    eid = ep['id']
    method = ep['method']
    path = ep['path']
    
    type_base = ep_type_name(ep)
    fn_base = ep_function_name(ep)
    
    # Deduplicate response type names
    resp_name = type_base + 'Response'
    if resp_name in _used_resp and _used_resp[resp_name] != eid:
        # Find a unique suffix based on full path structure
        path_stripped = re.sub(r'^/api/v1/', '', path)
        parts = path_stripped.split('/')
        # Use full path without params for disambiguation
        no_param_parts = [to_pascal(p) for p in parts if not p.startswith(':')]
        full_name = method[0].upper() + method[1:].lower() + ''.join(no_param_parts) + 'Response'
        resp_name = full_name
    _used_resp[resp_name] = eid
    
    # Deduplicate request type names
    req_name = type_base + 'Request'
    if req_name in _used_req and _used_req[req_name] != eid:
        path_stripped = re.sub(r'^/api/v1/', '', path)
        parts = path_stripped.split('/')
        no_param_parts = [to_pascal(p) for p in parts if not p.startswith(':')]
        full_name = method[0].upper() + method[1:].lower() + ''.join(no_param_parts) + 'Request'
        req_name = full_name
    _used_req[req_name] = eid
    
    # Deduplicate function names
    fn_name = fn_base
    if fn_name in _used_fn and _used_fn[fn_name] != eid:
        # Use full path for disambiguation
        path_stripped = re.sub(r'^/api/v1/', '', path)
        parts = path_stripped.split('/')
        no_param_parts = [to_pascal(p) for p in parts if not p.startswith(':')]
        pascal_parts = ''.join(no_param_parts)
        if method == 'GET':
            fn_name = 'get' + pascal_parts
        elif method == 'POST':
            fn_name = 'create' + pascal_parts
        elif method == 'PATCH':
            fn_name = 'update' + pascal_parts
        elif method == 'PUT':
            fn_name = 'upsert' + pascal_parts
    _used_fn[fn_name] = eid
    
    ep_names[eid] = {
        'type_base': type_base,
        'req_type': req_name,
        'resp_type': resp_name,
        'fn_name': fn_name,
    }

# Group by stage
by_stage = defaultdict(list)
for ep in endpoints:
    by_stage[ep['stage']].append(ep)

STAGE_ORDER = ['context', 'scope', 'decisions', 'assumptions', 'compute',
               'financials', 'analysis', 'confidence', 'governance', 'reference', 'ai']

# ─────────────────────────────────────────────
# OUTPUT 1: api/src/types/api.ts  (full types)
# ─────────────────────────────────────────────

def generate_full_types() -> str:
    lines = []
    lines.append('// Generated from specos/artifacts/api_contracts.json')
    lines.append('// DO NOT EDIT — regenerate from SpecOS artifacts')
    lines.append('')
    lines.append('// ─────────────────────────────────────────────────────────────────────')
    lines.append('// Shared envelope types')
    lines.append('// ─────────────────────────────────────────────────────────────────────')
    lines.append('')
    lines.append('export interface ResponseMeta {')
    lines.append('  requestId: string;')
    lines.append('  companyId?: string;')
    lines.append('  scenarioId?: string;')
    lines.append('  versionId?: string;')
    lines.append('  periodId?: string | null;')
    lines.append('  scopeRef?: string | null;')
    lines.append('  freshness: "fresh" | "stale" | "running" | "failed";')
    lines.append('  computeRunId?: string | null;')
    lines.append('  governanceState?: "draft" | "in_review" | "approved" | "published" | "frozen" | "rejected";')
    lines.append('  confidenceState?: "high" | "medium" | "low" | "estimated" | "unknown";')
    lines.append('  generatedAt: string;')
    lines.append('  ownerDoc?: string;')
    lines.append('  requirementFamilies?: string[];')
    lines.append('}')
    lines.append('')
    lines.append('export interface ApiErrorObject {')
    lines.append('  code: string;')
    lines.append('  category: "validation" | "governance" | "authorization" | "freshness" | "dependency" | "not_found" | "conflict" | "internal";')
    lines.append('  message: string;')
    lines.append('  severity: "info" | "warning" | "error" | "fatal";')
    lines.append('  retryable: boolean;')
    lines.append('  entityType?: string | null;')
    lines.append('  entityId?: string | null;')
    lines.append('  details?: Record<string, unknown>;')
    lines.append('  suggestedAction?: string | null;')
    lines.append('}')
    lines.append('')
    lines.append('export interface ApiEnvelope<T> {')
    lines.append('  data: T;')
    lines.append('  meta: ResponseMeta;')
    lines.append('  errors?: ApiErrorObject[];')
    lines.append('  links?: { self?: string; related?: string[] };')
    lines.append('}')
    lines.append('')

    for stage in STAGE_ORDER:
        eps = by_stage.get(stage, [])
        if not eps:
            continue
        
        stage_title = stage.upper()
        lines.append(f'// ─────────────────────────────────────────────────────────────────────')
        lines.append(f'// {stage_title}')
        lines.append(f'// ─────────────────────────────────────────────────────────────────────')
        lines.append('')
        
        for ep in eps:
            method = ep['method']
            path = ep['path']
            eid = ep['id']
            desc = ep.get('description', '')
            req_schema = ep['request_schema']
            resp_schema = ep['response_schema']
            names = ep_names[eid]
            
            lines.append(f'/** {method} {path}')
            lines.append(f' *  {desc} */')
            
            # Request body type (for POST, PUT, PATCH)
            body = req_schema.get('body')
            if body and body.get('properties') and method in ('POST', 'PUT', 'PATCH'):
                props = body['properties']
                required = body.get('required', [])
                lines.append(f'export interface {names["req_type"]} {{')
                lines.append(props_to_ts_interface_body(props, required))
                lines.append('}')
                lines.append('')
            
            # Query params type for GETs with query params
            query_params_defs = ep['request_schema'].get('query_params') or []
            if query_params_defs and method == 'GET':
                qp_entries = []
                for qp in query_params_defs:
                    qp_name = qp['name']
                    qp_type = json_type_to_ts(qp.get('type', 'string'))
                    qp_req = qp.get('required', False)
                    opt = '' if qp_req else '?'
                    desc_q = qp.get('description', '')
                    comment = f'  // {desc_q}' if desc_q else ''
                    qp_entries.append(f'  {qp_name}{opt}: {qp_type};{comment}')
                lines.append(f'export interface {names["req_type"]}Params {{')
                lines.extend(qp_entries)
                lines.append('}')
                lines.append('')
            
            # Response type — extract data schema
            try:
                resp_body_props = resp_schema['success']['body']['properties']
                data_schema = resp_body_props.get('data', {})
            except (KeyError, TypeError):
                data_schema = {}
            
            data_inline = resp_data_to_inline_ts(data_schema)
            
            lines.append(f'export interface {names["resp_type"]} {{')
            lines.append(f'  data:{data_inline};')
            lines.append(f'  meta: ResponseMeta;')
            lines.append('}')
            lines.append('')
        
    return '\n'.join(lines)

# ─────────────────────────────────────────────
# OUTPUT 2: web/lib/types/api.ts  (lean frontend types)
# ─────────────────────────────────────────────

def generate_frontend_types() -> str:
    lines = []
    lines.append('// Generated from specos/artifacts/api_contracts.json')
    lines.append('// DO NOT EDIT — regenerate from SpecOS artifacts')
    lines.append('// Lean subset: GET and POST response types for frontend consumption')
    lines.append('')
    lines.append('// ─────────────────────────────────────────────────────────────────────')
    lines.append('// Shared envelope types')
    lines.append('// ─────────────────────────────────────────────────────────────────────')
    lines.append('')
    lines.append('export interface ResponseMeta {')
    lines.append('  requestId: string;')
    lines.append('  companyId?: string;')
    lines.append('  scenarioId?: string;')
    lines.append('  versionId?: string;')
    lines.append('  periodId?: string | null;')
    lines.append('  scopeRef?: string | null;')
    lines.append('  freshness: "fresh" | "stale" | "running" | "failed";')
    lines.append('  computeRunId?: string | null;')
    lines.append('  governanceState?: "draft" | "in_review" | "approved" | "published" | "frozen" | "rejected";')
    lines.append('  confidenceState?: "high" | "medium" | "low" | "estimated" | "unknown";')
    lines.append('  generatedAt: string;')
    lines.append('}')
    lines.append('')
    lines.append('export interface ApiErrorObject {')
    lines.append('  code: string;')
    lines.append('  message: string;')
    lines.append('  severity: "info" | "warning" | "error" | "fatal";')
    lines.append('  retryable: boolean;')
    lines.append('  suggestedAction?: string | null;')
    lines.append('}')
    lines.append('')
    lines.append('export interface ApiResult<T> {')
    lines.append('  data: T | null;')
    lines.append('  meta?: ResponseMeta;')
    lines.append('  error: string | null;')
    lines.append('}')
    lines.append('')

    for stage in STAGE_ORDER:
        eps = by_stage.get(stage, [])
        fe_eps = [e for e in eps if e['method'] in ('GET', 'POST')]
        if not fe_eps:
            continue
        
        stage_title = stage.upper()
        lines.append(f'// ─────────────────────────────────────────────────────────────────────')
        lines.append(f'// {stage_title}')
        lines.append(f'// ─────────────────────────────────────────────────────────────────────')
        lines.append('')
        
        for ep in fe_eps:
            method = ep['method']
            path = ep['path']
            eid = ep['id']
            desc = ep.get('description', '')
            req_schema = ep['request_schema']
            resp_schema = ep['response_schema']
            names = ep_names[eid]
            
            lines.append(f'/** {method} {path} — {desc} */')
            
            # Request body for POST
            if method == 'POST':
                body = req_schema.get('body')
                if body and body.get('properties'):
                    props = body['properties']
                    required = body.get('required', [])
                    lines.append(f'export interface {names["req_type"]} {{')
                    lines.append(props_to_ts_interface_body(props, required))
                    lines.append('}')
                    lines.append('')
            
            # Response data type
            try:
                resp_body_props = resp_schema['success']['body']['properties']
                data_schema = resp_body_props.get('data', {})
            except (KeyError, TypeError):
                data_schema = {}
            
            data_inline = resp_data_to_inline_ts(data_schema)
            
            lines.append(f'export interface {names["resp_type"]} {{')
            lines.append(f'  data:{data_inline};')
            lines.append(f'  meta: ResponseMeta;')
            lines.append('}')
            lines.append('')
    
    return '\n'.join(lines)

# ─────────────────────────────────────────────
# OUTPUT 3: web/lib/api-client.ts
# ─────────────────────────────────────────────

def generate_api_client() -> str:
    lines = []
    lines.append('// Generated from specos/artifacts/api_contracts.json')
    lines.append('// DO NOT EDIT — regenerate from SpecOS artifacts')
    lines.append('')
    lines.append('import type { ResponseMeta, ApiResult } from "./types/api";')
    lines.append('')
    lines.append('// ─────────────────────────────────────────────────────────────────────')
    lines.append('// Core request infrastructure')
    lines.append('// Preserves existing pattern from web/lib/api.ts:')
    lines.append('//   - Never throws; always returns { data, meta, error }')
    lines.append('//   - Timeout via AbortController')
    lines.append('//   - x-tenant-id header injected on every request')
    lines.append('// ─────────────────────────────────────────────────────────────────────')
    lines.append('')
    lines.append('const API_BASE = process.env.NEXT_PUBLIC_API_URL || \'http://localhost:4000/api/v1\';')
    lines.append('const TENANT_ID = \'tttttttt-0000-0000-0000-000000000001\';')
    lines.append('const TIMEOUT_MS = 8000;')
    lines.append('')
    lines.append('async function request<T>(')
    lines.append('  method: string,')
    lines.append('  path: string,')
    lines.append('  body?: unknown,')
    lines.append('  queryParams?: Record<string, string | number | boolean | undefined>')
    lines.append('): Promise<ApiResult<T>> {')
    lines.append('  const controller = new AbortController();')
    lines.append('  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);')
    lines.append('')
    lines.append('  let url = `${API_BASE}${path}`;')
    lines.append('  if (queryParams) {')
    lines.append('    const qs = Object.entries(queryParams)')
    lines.append('      .filter(([, v]) => v !== undefined)')
    lines.append('      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)')
    lines.append('      .join(\'&\');')
    lines.append('    if (qs) url += `?${qs}`;')
    lines.append('  }')
    lines.append('')
    lines.append('  try {')
    lines.append('    const res = await fetch(url, {')
    lines.append('      method,')
    lines.append('      signal: controller.signal,')
    lines.append('      headers: {')
    lines.append('        \'Content-Type\': \'application/json\',')
    lines.append('        \'x-tenant-id\': TENANT_ID,')
    lines.append('      },')
    lines.append('      body: body !== undefined ? JSON.stringify(body) : undefined,')
    lines.append('    });')
    lines.append('    clearTimeout(timer);')
    lines.append('')
    lines.append('    if (!res.ok) {')
    lines.append('      const errBody = await res.json().catch(() => ({}));')
    lines.append('      return { data: null, error: errBody?.error?.message || `HTTP ${res.status}` };')
    lines.append('    }')
    lines.append('')
    lines.append('    const json = await res.json();')
    lines.append('    return { data: (json.data ?? json) as T, meta: json.meta, error: null };')
    lines.append('  } catch (err: unknown) {')
    lines.append('    clearTimeout(timer);')
    lines.append('    const e = err as { name?: string; message?: string };')
    lines.append('    return {')
    lines.append('      data: null,')
    lines.append('      error: e.name === \'AbortError\' ? \'Timeout\' : (e.message || \'Network error\'),')
    lines.append('    };')
    lines.append('  }')
    lines.append('}')
    lines.append('')

    for stage in STAGE_ORDER:
        eps = by_stage.get(stage, [])
        if not eps:
            continue
        
        stage_title = stage.upper()
        lines.append(f'// ─────────────────────────────────────────────────────────────────────')
        lines.append(f'// {stage_title}')
        lines.append(f'// ─────────────────────────────────────────────────────────────────────')
        lines.append('')
        
        for ep in eps:
            method = ep['method']
            path = ep['path']
            eid = ep['id']
            desc = ep.get('description', '')
            req_schema = ep['request_schema']
            resp_schema = ep['response_schema']
            names = ep_names[eid]
            
            path_params = extract_path_params(path)
            path_template = path_to_template(path)
            query_params_defs = req_schema.get('query_params') or []
            body_schema = req_schema.get('body')
            
            # Determine return data type
            try:
                resp_body_props = resp_schema['success']['body']['properties']
                data_schema = resp_body_props.get('data', {})
            except (KeyError, TypeError):
                data_schema = {}
            
            # Build inline compact type for generic parameter
            dtype = data_schema.get('type', 'object') if data_schema else 'unknown'
            if dtype == 'array':
                items = data_schema.get('items', {})
                item_props = items.get('properties', {})
                if item_props:
                    parts_inner = ', '.join(f'{k}: {json_type_to_ts(v.get("type","string"))}' for k, v in item_props.items())
                    data_type_compact = f'Array<{{ {parts_inner} }}>'
                else:
                    data_type_compact = 'unknown[]'
            elif dtype == 'object':
                props = data_schema.get('properties', {}) if data_schema else {}
                if props:
                    parts_inner = ', '.join(f'{k}: {json_type_to_ts(v.get("type","string"))}' for k, v in props.items())
                    data_type_compact = f'{{ {parts_inner} }}'
                else:
                    data_type_compact = 'Record<string, unknown>'
            else:
                data_type_compact = json_type_to_ts(dtype)
            
            # Build function signature params
            fn_params = []
            for pp in path_params:
                fn_params.append(f'{pp}: string')
            
            # Body param for POST/PUT/PATCH
            has_body = body_schema and body_schema.get('properties')
            if has_body and method in ('POST', 'PUT', 'PATCH'):
                fn_params.append(f'body: {names["req_type"]}')
            
            # Optional query params
            if query_params_defs:
                qp_entries = []
                for qp in query_params_defs:
                    qp_name = qp['name']
                    qp_type = json_type_to_ts(qp.get('type', 'string'))
                    qp_req = qp.get('required', False)
                    opt = '' if qp_req else '?'
                    qp_entries.append(f'{qp_name}{opt}: {qp_type}')
                fn_params.append(f'params?: {{ {"; ".join(qp_entries)} }}')
            
            params_str = ', '.join(fn_params)
            
            # Build request call
            path_str = f'`{path_template}`' if path_params else f'\'{path_template}\''
            
            call_args = [f'\'{method}\'', path_str]
            if method in ('POST', 'PUT', 'PATCH'):
                if has_body:
                    call_args.append('body')
                else:
                    call_args.append('undefined')
            
            if query_params_defs:
                call_args.append('params as Record<string, string | number | boolean | undefined>')
            
            lines.append(f'/** {method} {path} — {desc} */')
            lines.append(f'export const {names["fn_name"]} = ({params_str}): Promise<ApiResult<{data_type_compact}>> =>')
            lines.append(f'  request<{data_type_compact}>({", ".join(call_args)});')
            lines.append('')
    
    return '\n'.join(lines)


# ─────────────────────────────────────────────
# Write output files
# ─────────────────────────────────────────────

import os

# Output 1
out1_dir = '/home/user/workspace/bma3_work/api/src/types'
os.makedirs(out1_dir, exist_ok=True)
out1_path = f'{out1_dir}/api.ts'
content1 = generate_full_types()
with open(out1_path, 'w') as f:
    f.write(content1)
print(f'Written: {out1_path}  ({len(content1)} chars, {content1.count(chr(10))+1} lines)')

# Output 2
out2_dir = '/home/user/workspace/bma3_work/web/lib/types'
os.makedirs(out2_dir, exist_ok=True)
out2_path = f'{out2_dir}/api.ts'
content2 = generate_frontend_types()
with open(out2_path, 'w') as f:
    f.write(content2)
print(f'Written: {out2_path}  ({len(content2)} chars, {content2.count(chr(10))+1} lines)')

# Output 3
out3_path = '/home/user/workspace/bma3_work/web/lib/api-client.ts'
content3 = generate_api_client()
with open(out3_path, 'w') as f:
    f.write(content3)
print(f'Written: {out3_path}  ({len(content3)} chars, {content3.count(chr(10))+1} lines)')

# Sanity checks
print()
print('=== Duplicate type name check ===')
import re
for path_out, content in [(out1_path, content1), (out2_path, content2)]:
    exported = re.findall(r'export interface (\w+)', content)
    from collections import Counter
    dupes = {k: v for k, v in Counter(exported).items() if v > 1}
    if dupes:
        print(f'DUPLICATES in {path_out}: {dupes}')
    else:
        print(f'OK: {path_out} — {len(exported)} unique interface names')

print()
print('=== Duplicate function name check ===')
fn_names = re.findall(r'export const (\w+)', content3)
from collections import Counter
dupes = {k: v for k, v in Counter(fn_names).items() if v > 1}
if dupes:
    print(f'DUPLICATES in api-client.ts: {dupes}')
else:
    print(f'OK: api-client.ts — {len(fn_names)} unique function names')

print()
print('=== Endpoint coverage ===')
print(f'Total endpoints in contracts: {len(endpoints)}')
print(f'Functions in api-client.ts: {len(fn_names)}')
