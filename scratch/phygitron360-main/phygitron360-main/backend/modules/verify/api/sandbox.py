"""
Phygitron 360 — Verify Module: Code Sandbox API
================================================
Production-grade code execution engine supporting Python, JavaScript, Java, C++.

Routing strategy:
  Python  → local subprocess (fast) → Judge0 CE (fallback)
  JS      → local subprocess       → Judge0 CE (fallback)
  Java    → Judge0 CE              → local javac/java (fallback)
  C++     → Judge0 CE              → local g++ (fallback)

Test-case harness is injected for batch runs so each test case is run without
restarting the interpreter, giving O(n) speed instead of O(n) process spawns.
"""
import asyncio
import ast
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.dependencies import get_current_user
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verify/sandbox", tags=["Verify - Sandbox"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

JUDGE0_URL = "https://ce.judge0.com"

# Judge0 language IDs
JUDGE0_LANG = {
    "python": 71,
    "javascript": 63,
    "java": 62,
    "cpp": 54,
    "c": 50,
}

LANGUAGE_ALIASES = {
    "python3": "python",
    "py": "python",
    "js": "javascript",
    "node": "javascript",
    "c++": "cpp",
    "c_cpp": "cpp",
    "golang": "go",
    "go": "go",
}

BATCH_RESULTS_START = "---BATCH_RESULTS_START---"
BATCH_RESULTS_END = "---BATCH_RESULTS_END---"

EXEC_TIMEOUT = 20  # seconds for local execution


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TestCase(BaseModel):
    input: str = ""
    expected_output: str = ""


class ExecuteRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = ""
    test_cases: Optional[List[TestCase]] = None


class GenerateCodingMetaRequest(BaseModel):
    question_text: str
    difficulty: Optional[str] = "medium"


# ---------------------------------------------------------------------------
# Language normalisation
# ---------------------------------------------------------------------------

def _normalize_language(language: str) -> str:
    lang = language.lower().strip()
    return LANGUAGE_ALIASES.get(lang, lang)


def _prepare_test_cases(test_cases) -> List[Dict]:
    """Ensure list of {input, expected_output} dicts."""
    out = []
    for tc in (test_cases or []):
        if isinstance(tc, dict):
            out.append({"input": str(tc.get("input", "")), "expected_output": str(tc.get("expected_output", ""))})
        elif hasattr(tc, "input"):
            out.append({"input": str(tc.input), "expected_output": str(tc.expected_output)})
    return out


def _compact_json(value) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _normalize_output_text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_compare_value(value: str) -> str:
    """Normalize output for comparison: try JSON parse, then ast.literal_eval, then stripped string."""
    v = _normalize_output_text(value)
    # Try JSON
    try:
        parsed = json.loads(v)
        return _compact_json(parsed)
    except Exception:
        pass
    # Try Python literal
    try:
        parsed = ast.literal_eval(v)
        return _compact_json(parsed)
    except Exception:
        pass
    return v.lower().strip()


# ---------------------------------------------------------------------------
# Batch harness code injection
# ---------------------------------------------------------------------------

_PY_HARNESS_SUFFIX = r'''
import json as _json, sys as _sys, ast as _ast, traceback as _tb

_TEST_CASES = _json.loads(r"""{tests_json}""")
def _norm(v):
    v = str(v).strip()
    try: return _json.dumps(_json.loads(v), separators=(',', ':'))
    except Exception: pass
    try: return _json.dumps(_ast.literal_eval(v), separators=(',', ':'))
    except Exception: pass
    return v.lower().strip()

def _run_tests():
    results = []
    for tc in _TEST_CASES:
        inp = tc.get('input', '')
        exp = _norm(tc.get('expected_output', ''))
        try:
            import io
            _old_stdin = _sys.stdin
            _sys.stdin = io.StringIO(inp + '\n')
            _out_buf = io.StringIO()
            _old_stdout = _sys.stdout
            _sys.stdout = _out_buf
            try:
                # Re-run main logic
                exec(_USER_CODE, _globals_copy)
            finally:
                _sys.stdin = _old_stdin
                _sys.stdout = _old_stdout
            actual = _norm(_out_buf.getvalue())
            passed = (actual == exp)
            results.append({'passed': passed, 'actual': actual, 'expected': exp, 'input': inp, 'error': None})
        except Exception as e:
            results.append({'passed': False, 'actual': '', 'expected': exp, 'input': inp, 'error': str(e)})
    print("{batch_start}")
    print(_json.dumps(results))
    print("{batch_end}")

_USER_CODE = {user_code_repr}
_globals_copy = dict(globals())
_run_tests()
'''.replace("{batch_start}", BATCH_RESULTS_START).replace("{batch_end}", BATCH_RESULTS_END)

_JS_HARNESS_TEMPLATE = r"""
const _readline = require('readline');
const _fs = require('fs');
const _testCases = {tests_json};

async function _runTests() {{
    const results = [];
    for (const tc of _testCases) {{
        const inp = tc.input || '';
        const exp = _norm(tc.expected_output || '');
        try {{
            // Capture stdout
            let _out = '';
            const _origWrite = process.stdout.write.bind(process.stdout);
            process.stdout.write = (chunk) => {{ _out += chunk; return true; }};
            // Simulate stdin
            let _lineIdx = 0;
            const _lines = inp.split('\n');
            const _origRL = _readline.createInterface;
            try {{
                await _runUserCode(inp);
            }} finally {{
                process.stdout.write = _origWrite;
            }}
            const actual = _norm(_out);
            results.push({{ passed: actual === exp, actual, expected: exp, input: inp, error: null }});
        }} catch(e) {{
            results.push({{ passed: false, actual: '', expected: exp, input: inp, error: e.message }});
        }}
    }}
    console.log('{batch_start}');
    console.log(JSON.stringify(results));
    console.log('{batch_end}');
}}

function _norm(v) {{
    v = String(v).trim();
    try {{ return JSON.stringify(JSON.parse(v)); }} catch(e) {{}}
    return v.toLowerCase().trim();
}}

_runTests().catch(e => console.error(e));
""".replace("{batch_start}", BATCH_RESULTS_START).replace("{batch_end}", BATCH_RESULTS_END)


def _wrap_python_for_batch(code: str, test_cases: List[Dict]) -> str:
    tests_json = json.dumps(test_cases)
    user_code_repr = repr(code)
    suffix = _PY_HARNESS_SUFFIX.replace("{tests_json}", tests_json).replace("{user_code_repr}", user_code_repr)
    return code + "\n\n" + suffix


def _wrap_java_solution(code: str, test_cases: List[Dict]) -> str:
    """Wrap a Java Solution class with a Main that provides test input via stdin."""
    lines = []
    for tc in test_cases:
        input_val = tc["input"].replace("\n", "\\n").replace('"', '\\"')
        expected_val = tc["expected_output"].strip().replace('"', '\\"')
        lines.append(f'runTest("{input_val}", "{expected_val}");')
    tests_lines = "\n".join(lines)
    wrapper = f"""
import java.util.*;
import java.io.*;

{code}

class Main {{
    static java.util.List<String> results = new java.util.ArrayList<>();

    static void runTest(String input, String expected) {{
        InputStream origIn = System.in;
        PrintStream origOut = System.out;
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try {{
            System.setIn(new ByteArrayInputStream(input.replace("\\\\n","\\n").getBytes()));
            System.setOut(new PrintStream(bos));
            // Re-create Solution and call main
            Solution sol = new Solution();
            // Try invoking solution.main if it exists, otherwise just run it
        }} catch(Exception e) {{
            System.setOut(origOut);
            System.out.println("{{\\\"passed\\\":false,\\\"error\\\":\\\"" + e.getMessage() + "\\\"}}");
            return;
        }} finally {{
            System.setIn(origIn);
            System.setOut(origOut);
        }}
        String actual = bos.toString().trim();
        boolean passed = actual.equals(expected.trim());
        System.out.println("{{\\\"passed\\\":" + passed + ",\\\"actual\\\":\\\"" + actual + "\\\",\\\"expected\\\":\\\"" + expected + "\\\"}}");
    }}

    public static void main(String[] args) {{
        System.out.println("{BATCH_RESULTS_START}");
        java.util.List<Object> allResults = new java.util.ArrayList<>();
        // For Java we run each test as stdin piped to the full class
        // This simplified version reports the structure
        System.out.println("[]");
        System.out.println("{BATCH_RESULTS_END}");
    }}
}}
"""
    return wrapper


def _wrap_cpp_solution(code: str, test_cases: List[Dict]) -> str:
    """For C++ just return as-is; Judge0 handles stdin per test run."""
    return code


def _is_solution_class(code: str, language: str) -> bool:
    if language in ("java", "cpp", "c"):
        return "class Solution" in code or "class Main" in code
    if language == "python":
        return "class Solution" in code
    return False


# ---------------------------------------------------------------------------
# Local execution
# ---------------------------------------------------------------------------

def _get_exec_dir() -> str:
    base = os.path.join(tempfile.gettempdir(), ".verify_exec")
    os.makedirs(base, exist_ok=True)
    return base


def _execute_locally(language: str, code: str, stdin: str = "") -> Dict:
    """Run code in a local subprocess. Returns {stdout, stderr, exit_code}."""
    exec_dir = _get_exec_dir()
    run_id = uuid.uuid4().hex[:8]
    work_dir = os.path.join(exec_dir, run_id)
    os.makedirs(work_dir, exist_ok=True)

    try:
        if language == "python":
            code_file = os.path.join(work_dir, "solution.py")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = [sys.executable, code_file]

        elif language == "javascript":
            code_file = os.path.join(work_dir, "solution.js")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            cmd = ["node", code_file]

        elif language == "java":
            # Detect class name
            match = re.search(r"public\s+class\s+(\w+)", code)
            class_name = match.group(1) if match else "Main"
            code_file = os.path.join(work_dir, f"{class_name}.java")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            # Compile
            compile_result = subprocess.run(
                ["javac", code_file], capture_output=True, text=True, timeout=15
            )
            if compile_result.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile_result.stderr,
                    "exit_code": compile_result.returncode,
                }
            cmd = ["java", "-cp", work_dir, class_name]

        elif language in ("cpp", "c"):
            code_file = os.path.join(work_dir, "solution.cpp")
            bin_file = os.path.join(work_dir, "solution")
            with open(code_file, "w", encoding="utf-8") as f:
                f.write(code)
            compile_result = subprocess.run(
                ["g++", "-o", bin_file, code_file, "-std=c++17"],
                capture_output=True, text=True, timeout=15
            )
            if compile_result.returncode != 0:
                return {
                    "stdout": "",
                    "stderr": compile_result.stderr,
                    "exit_code": compile_result.returncode,
                }
            cmd = [bin_file]

        else:
            return {"stdout": "", "stderr": f"Unsupported language: {language}", "exit_code": 1}

        result = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=EXEC_TIMEOUT,
            cwd=work_dir,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }

    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Time limit exceeded (local)", "exit_code": 124}
    except FileNotFoundError as exc:
        return {"stdout": "", "stderr": f"Runtime not found: {exc}", "exit_code": 127}
    except Exception as exc:
        return {"stdout": "", "stderr": str(exc), "exit_code": 1}
    finally:
        # Cleanup
        import shutil
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Judge0 execution
# ---------------------------------------------------------------------------

async def _execute_via_judge0(language: str, code: str, stdin: str = "") -> Dict:
    """Submit to Judge0 CE and poll for result."""
    lang_id = JUDGE0_LANG.get(language)
    if not lang_id:
        return {"stdout": "", "stderr": f"Language {language!r} not supported in Judge0", "exit_code": 1}

    import base64
    payload = {
        "source_code": base64.b64encode(code.encode()).decode(),
        "language_id": lang_id,
        "stdin": base64.b64encode((stdin or "").encode()).decode(),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            submit = await client.post(
                f"{JUDGE0_URL}/submissions?base64_encoded=true&wait=false",
                json=payload,
            )
            if submit.status_code not in (200, 201):
                return {"stdout": "", "stderr": f"Judge0 submit failed: {submit.status_code}", "exit_code": 1}

            token = submit.json().get("token")
            if not token:
                return {"stdout": "", "stderr": "No token from Judge0", "exit_code": 1}

            # Poll until done (status_id not in 1=queued, 2=processing)
            for _ in range(20):
                await asyncio.sleep(1.5)
                poll = await client.get(
                    f"{JUDGE0_URL}/submissions/{token}?base64_encoded=true",
                )
                data = poll.json()
                if data.get("status", {}).get("id") not in (1, 2):
                    break

            def _decode(v):
                if not v:
                    return ""
                try:
                    import base64 as b64
                    return b64.b64decode(v).decode("utf-8", errors="replace")
                except Exception:
                    return str(v)

            return {
                "stdout": _decode(data.get("stdout")),
                "stderr": _decode(data.get("stderr")) or _decode(data.get("compile_output")),
                "exit_code": data.get("exit_code") or 0,
            }

    except Exception as exc:
        return {"stdout": "", "stderr": f"Judge0 error: {exc}", "exit_code": 1}


# ---------------------------------------------------------------------------
# Smart routing
# ---------------------------------------------------------------------------

async def _execute_code(language: str, code: str, stdin: str = "") -> Dict:
    """
    Route to best execution backend:
      Python / JS → local first, fallback Judge0
      Java / C++  → Judge0 first, fallback local
    """
    if language in ("python", "javascript"):
        result = await asyncio.to_thread(_execute_locally, language, code, stdin)
        if result.get("exit_code") == 127:  # runtime not found
            result = await _execute_via_judge0(language, code, stdin)
        return result
    else:
        result = await _execute_via_judge0(language, code, stdin)
        if result.get("exit_code") == 1 and "not supported" in result.get("stderr", ""):
            result = await asyncio.to_thread(_execute_locally, language, code, stdin)
        return result


# ---------------------------------------------------------------------------
# Batch test runner
# ---------------------------------------------------------------------------

def _parse_batch_results(stdout: str) -> Optional[List[Dict]]:
    """Extract JSON array between batch markers from stdout."""
    try:
        start = stdout.index(BATCH_RESULTS_START) + len(BATCH_RESULTS_START)
        end = stdout.index(BATCH_RESULTS_END, start)
        payload = stdout[start:end].strip()
        return json.loads(payload)
    except Exception:
        return None


async def _run_test_cases(language: str, code: str, test_cases: List[Dict]) -> Dict:
    """
    Run all test cases and return structured results.
    For Python/JS: inject batch harness and parse markers.
    For Java/C++: run each test case individually against Judge0.
    """
    if not test_cases:
        return {"run": {}, "test_results": []}

    if language == "python":
        wrapped = _wrap_python_for_batch(code, test_cases)
        run_result = await _execute_code(language, wrapped, "")
        batch = _parse_batch_results(run_result.get("stdout", ""))
        if batch is not None:
            return {"run": run_result, "test_results": batch}
        # Fallback: run each individually
    elif language == "javascript":
        # For JS, run each test case individually (simpler)
        pass

    # Per-test-case fallback (all languages)
    test_results = []
    for tc in test_cases:
        run = await _execute_code(language, code, tc.get("input", ""))
        actual = _normalize_output_text(run.get("stdout", ""))
        expected = _normalize_output_text(tc.get("expected_output", ""))
        passed = _normalize_compare_value(actual) == _normalize_compare_value(expected)
        test_results.append({
            "passed": passed,
            "actual": actual,
            "expected": expected,
            "input": tc.get("input", ""),
            "error": run.get("stderr") or None,
        })

    return {"run": {}, "test_results": test_results}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/execute")
async def execute_code(
    body: ExecuteRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Execute code with optional test cases.
    If test_cases provided: returns {run, test_results[{passed,actual,expected}]}
    Otherwise: returns raw {stdout, stderr, exit_code}
    """
    language = _normalize_language(body.language)
    code = body.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    try:
        if body.test_cases:
            tcs = _prepare_test_cases(body.test_cases)
            result = await _run_test_cases(language, code, tcs)
        else:
            run = await _execute_code(language, code, body.stdin or "")
            result = {
                "stdout": run.get("stdout", ""),
                "stderr": run.get("stderr", ""),
                "exit_code": run.get("exit_code", 0),
            }
        return {"success": True, "data": result}
    except Exception as exc:
        logger.error(f"sandbox execute error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-coding-meta")
async def generate_coding_meta(
    body: GenerateCodingMetaRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    AI-generate starter code, test cases, and programming language
    for a given coding question.
    """
    ai = AIAgents()
    system = (
        "You are an expert technical interviewer. Given a coding question, "
        "generate a Python starter code template, 3 test cases with expected outputs, "
        "and the best programming language. Respond ONLY with JSON."
    )
    prompt = (
        f"Coding question: {body.question_text}\n"
        f"Difficulty: {body.difficulty}\n\n"
        "Return JSON: {\"starter_code\": \"...\", \"test_cases\": [{\"input\": \"...\", \"expected_output\": \"...\"}], \"programming_language\": \"python\"}"
    )
    try:
        result = await ai.ai.generate_json(prompt, system)
        return {"success": True, "data": result}
    except Exception as exc:
        logger.error(f"generate_coding_meta failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
