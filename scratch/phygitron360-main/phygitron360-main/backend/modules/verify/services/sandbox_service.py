"""
Phygitron 360 — Verify Module: Sandbox Service
================================================
Service wrapper used by the grading background task.
Delegates to the full execution engine in sandbox.py.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class SandboxService:
    """
    Thin service façade around the sandbox execution functions.
    Grading tasks call execute_code_sandbox(); the API layer calls
    the full execute_code / _run_test_cases functions directly.
    """

    async def execute_code_sandbox(
        self,
        language: str,
        code: str,
        stdin: str = "",
        test_cases: list = None,
    ) -> Dict[str, Any]:
        """
        Execute code with optional test cases.
        Returns the same structure as the sandbox /execute endpoint.
        """
        from backend.modules.verify.api.sandbox import (
            _normalize_language,
            _prepare_test_cases,
            _run_test_cases,
            _execute_code,
        )

        lang = _normalize_language(language)
        code = (code or "").strip()

        if not code:
            return {"stdout": "", "stderr": "Empty code", "exit_code": 1}

        try:
            if test_cases:
                tcs = _prepare_test_cases(test_cases)
                return await _run_test_cases(lang, code, tcs)
            else:
                run = await _execute_code(lang, code, stdin or "")
                return {
                    "stdout": run.get("stdout", ""),
                    "stderr": run.get("stderr", ""),
                    "exit_code": run.get("exit_code", 0),
                }
        except Exception as exc:
            logger.error(f"SandboxService.execute_code_sandbox failed: {exc}")
            return {"stdout": "", "stderr": str(exc), "exit_code": 1}
