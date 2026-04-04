import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from app.utils.import_utils import extract_text_from_file, parse_questions_with_ai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.verify import (
    Assessment, AssessmentQuestion, AssessmentAssignment,
    AssessmentResult, ProctoringFlag, ProctoringFlagType, AssessmentStatus, AssignmentStatus
)
from app.utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/verify", tags=["Verify"])


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


# ── Assessment Builder ────────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    question_text: str
    question_type: str  # mcq, written, coding, file_upload
    options: Optional[list] = None
    correct_answer: Optional[str] = None
    model_answer: Optional[str] = None
    starter_code: Optional[str] = None
    test_cases: Optional[list] = None
    programming_language: Optional[str] = None
    accepted_file_types: Optional[str] = None
    skill_id: Optional[int] = None
    marks: float = 1.0
    order_index: int = 0


class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: str = "mcq"
    time_limit_minutes: Optional[int] = None
    pass_score: float = 70.0
    shuffle_questions: bool = False
    show_result_immediately: bool = True
    questions: List[QuestionCreate] = []


@router.post("/assessments")
async def create_assessment(
    body: AssessmentCreate,
    current_user: User = Depends(require_role(["hr", "admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    assessment = Assessment(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        type=body.type,
        time_limit_minutes=body.time_limit_minutes,
        pass_score=body.pass_score,
        shuffle_questions=body.shuffle_questions,
        show_result_immediately=body.show_result_immediately,
        created_by=current_user.id,
        status=AssessmentStatus.draft,
    )
    db.add(assessment)
    await db.flush()

    for q in body.questions:
        question = AssessmentQuestion(
            assessment_id=assessment.id,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_answer=q.correct_answer,
            model_answer=q.model_answer,
            starter_code=q.starter_code,
            test_cases=q.test_cases,
            programming_language=q.programming_language,
            accepted_file_types=q.accepted_file_types,
            skill_id=q.skill_id,
            marks=q.marks,
            order_index=q.order_index,
        )
        db.add(question)

    await db.commit()
    return success({"id": assessment.id, "title": assessment.title})


@router.post("/import-questions")
async def import_questions(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["hr", "admin", "instructor"])),
):
    try:
        content = await file.read()
        text = await extract_text_from_file(content, file.filename)
        questions = await parse_questions_with_ai(text)
        return success(questions)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assessments")
async def list_assessments(
    current_user: User = Depends(require_role(["hr", "admin", "instructor"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Assessment).where(Assessment.org_id == current_user.org_id).order_by(Assessment.created_at.desc())
    )
    assessments = result.scalars().all()
    return success([{
        "id": a.id, "title": a.title, "type": a.type.value, "status": a.status.value,
        "pass_score": float(a.pass_score), "time_limit_minutes": a.time_limit_minutes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in assessments])


@router.get("/assessments/{assessment_id}")
async def get_assessment(
    assessment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assessment not found")

    q_result = await db.execute(
        select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == assessment_id).order_by(AssessmentQuestion.order_index)
    )
    questions = q_result.scalars().all()

    return success({
        "id": a.id, "title": a.title, "description": a.description,
        "type": a.type.value, "time_limit_minutes": a.time_limit_minutes,
        "pass_score": float(a.pass_score), "shuffle_questions": a.shuffle_questions,
        "show_result_immediately": a.show_result_immediately,
        "status": a.status.value,
        "questions": [{
            "id": q.id, "question_text": q.question_text, "question_type": q.question_type.value,
            "options": q.options, "marks": float(q.marks), "skill_id": q.skill_id,
            "starter_code": q.starter_code, "test_cases": q.test_cases, "programming_language": q.programming_language,
            "order_index": q.order_index,
        } for q in questions],
    })


@router.post("/assessments/{assessment_id}/publish")
async def publish_assessment(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    a.status = AssessmentStatus.active
    await db.commit()
    return success(message="Assessment published")


# ── Assignment ────────────────────────────────────────────────────────────────

class AssignRequest(BaseModel):
    user_ids: List[int]
    deadline: Optional[str] = None


@router.post("/assessments/{assessment_id}/assign")
async def assign_assessment(
    assessment_id: int,
    body: AssignRequest,
    current_user: User = Depends(require_role(["hr", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    deadline = datetime.fromisoformat(body.deadline) if body.deadline else None
    assigned = 0
    for uid in body.user_ids:
        existing = await db.execute(
            select(AssessmentAssignment).where(
                AssessmentAssignment.assessment_id == assessment_id,
                AssessmentAssignment.user_id == uid
            )
        )
        if existing.scalar_one_or_none():
            continue
        assgn = AssessmentAssignment(
            assessment_id=assessment_id,
            user_id=uid,
            assigned_by=current_user.id,
            deadline=deadline,
            status=AssignmentStatus.pending,
        )
        db.add(assgn)
        assigned += 1
    await db.commit()
    return success({"assigned": assigned})


@router.get("/my-assessments")
async def my_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentAssignment, Assessment).join(Assessment)
        .where(AssessmentAssignment.user_id == current_user.id)
    )
    rows = result.all()
    return success([{
        "assignment_id": assgn.id,
        "assessment_id": asmt.id,
        "title": asmt.title,
        "description": asmt.description,
        "time_limit_minutes": asmt.time_limit_minutes,
        "deadline": assgn.deadline.isoformat() if assgn.deadline else None,
        "status": assgn.status.value,
        "show_result_immediately": asmt.show_result_immediately,
    } for assgn, asmt in rows])


# ── Execution Sandbox ──────────────────────────────────────────────────────────

class RunCodeRequest(BaseModel):
    language: str
    code: str
    stdin: str = ""
    test_cases: list = []

def wrap_code_for_execution(code: str, language: str, test_cases: list = []) -> str:
    import re, json
    if language == "python":
        # Identify the main function name (last defined function)
        func_match = list(re.finditer(r'def\s+([a-zA-Z0-9_]+)\s*\(', code))
        if not func_match: return code
        
        func_name = func_match[-1].group(1)
        is_class = "class " in code
        
        # Improved method detection
        try:
            is_method = "self" in func_match[-1].group(0) or "self" in code.split('def '+func_name)[-1].split(')')[0]
        except:
            is_method = "self" in code
        
        class_name = "Solution"
        if is_class:
            class_match = re.search(r'class\s+([a-zA-Z0-9_]+)', code)
            class_name = class_match.group(1) if class_match else "Solution"

        if test_cases:
            tc_json = json.dumps(test_cases)
            wrapper = f"""
import sys, json, ast, inspect

def __run_batch_harness():
    try:
        test_cases = json.loads('''{tc_json}''')
        results = []
        
        target_fn = None
        if {is_class}:
            try: 
                class_inst = {class_name}()
                target_fn = getattr(class_inst, "{func_name}", None)
            except: pass
        
        if not target_fn:
            target_fn = globals().get("{func_name}")
            
        if not target_fn:
            print(json.dumps([{{ "error": "Function '{func_name}' not found" }}]))
            return

        sig = inspect.signature(target_fn)
        params = list(sig.parameters.values())

        for tc in test_cases:
            try:
                input_raw = tc.get("input", "").strip()
                args = []
                if input_raw:
                    for line in input_raw.splitlines():
                        line = line.strip()
                        if not line: continue
                        try: args.append(json.loads(line))
                        except:
                            try: args.append(ast.literal_eval(line))
                            except: args.append(line)
                
                final_args = args
                if len(params) > 0 and params[0].name == "self" and len(args) < len(params):
                    final_args = [None] + args
                
                res = target_fn(*final_args)
                if isinstance(res, (list, dict)): res_out = json.dumps(res).replace(" ", "")
                else: res_out = str(res)
                results.append({{ "stdout": res_out, "stderr": "" }})
            except Exception as e:
                results.append({{ "stdout": "", "stderr": str(e) }})
        
        print("---BATCH_RESULTS_START---")
        print(json.dumps(results))
        print("---BATCH_RESULTS_END---")
    except Exception as e:
        print(f"Harness Error: {{e}}", file=sys.stderr)

__run_batch_harness()
"""
            return code + "\n" + wrapper

        # Single-run Stdin Fallback
        wrapper = f"""
import sys, json, ast, inspect
def __run_test_harness():
    try:
        lines = sys.stdin.readlines()
        if not lines: return
        args = []
        for line in lines:
            line = line.strip()
            if not line: continue
            try: args.append(json.loads(line))
            except:
                try: args.append(ast.literal_eval(line))
                except: args.append(line)
        target_fn = None
        if {is_class}:
            try: 
                class_inst = {class_name}()
                target_fn = getattr(class_inst, "{func_name}", None)
            except: pass
        if not target_fn: target_fn = globals().get("{func_name}")
        if not target_fn: return
        sig = inspect.signature(target_fn)
        params = list(sig.parameters.values())
        final_args = args
        if len(params) > 0 and params[0].name == "self" and len(args) < len(params):
            final_args = [None] + args
        res = target_fn(*final_args)
        if res is not None:
            if isinstance(res, (list, dict)): print(json.dumps(res).replace(" ", ""))
            else: print(res)
    except Exception as e:
        print(f"Runtime Error: {{e}}", file=sys.stderr)
__run_test_harness()
"""
        return code + "\n" + wrapper
    

    
    if language == "javascript" and "function" in code and "console.log" not in code:
        match = list(re.finditer(r'function\s+([a-zA-Z0-9_]+)\s*\(', code))
        if match:
            func_name = match[-1].group(1)
            js_wrapper = f"""

const fs = require('fs');
const __stdin = fs.readFileSync(0, 'utf-8').trim();
if (__stdin) {{
    const __args = __stdin.split('\\n').filter(l => l.trim() !== '').map(l => {{
        try {{ return JSON.parse(l); }} catch(e) {{ return l; }}
    }});
    try {{
        const __res = {func_name}(...__args);
        if (__res !== undefined) console.log(JSON.stringify(__res).replace(/\\s+/g, ''));
    }} catch(e) {{ console.error("Execution Error:", e); }}
}}
"""
            return code + "\n" + js_wrapper
    
    return code

@router.post("/run-code")
async def run_code_endpoint(
    body: RunCodeRequest,
    current_user: User = Depends(get_current_user)
):
    import httpx
    p_lang = "cpp" if body.language.lower() == "c++" else body.language.lower()
    wrapped_code = wrap_code_for_execution(body.code, p_lang, body.test_cases)
    payload = {
        "language": p_lang,
        "version": "3.10.0" if p_lang == "python" else "*",
        "files": [{"content": wrapped_code}],
        "stdin": body.stdin
    }
    import asyncio
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post("https://emkc.org/api/v2/piston/execute", json=payload, timeout=10.0)
                data = resp.json()
                if resp.status_code == 200 and "run" in data:
                    return success(data)
                elif resp.status_code == 429 and attempt < max_retries:
                    await asyncio.sleep(2 ** attempt)
                    continue
                else:
                    print(f"PISTON ERROR (Attempt {attempt}): {data}", flush=True)
                    if attempt == max_retries:
                        # Fallback to AI Execution / Simulation
                        print("PISTON FAILED. Falling back to AI Simulation.", flush=True)
                        from app.agents.agents import call_llm
                        ai_system = "You are a code execution simulator. Given the code and stdin, provide the output."
                        ai_prompt = f"Code:\n{wrapped_code}\n\nStdin:\n{body.stdin}\n\nRespond ONLY with JSON: {{'run': {{'stdout': '...', 'stderr': '...'}}}}"
                        ai_res = call_llm(ai_system, ai_prompt)
                        return success(ai_res)
        except Exception as e:
            if attempt < max_retries:
                await asyncio.sleep(1)
                continue
            # AI Fallback on exception too
            print(f"PISTON EXCEPTION. Falling back to AI Simulation: {e}", flush=True)
            from app.agents.agents import call_llm
            ai_system = "You are a code execution simulator."
            ai_prompt = f"Code:\n{wrapped_code}\n\nStdin:\n{body.stdin}\n\nRespond ONLY with JSON: {{'run': {{'stdout': '...', 'stderr': '...'}}}}"
            ai_res = call_llm(ai_system, ai_prompt)
            return success(ai_res)


class GenerateMetaRequest(BaseModel):
    question_text: str


@router.post("/generate-coding-meta")
async def generate_coding_meta(
    body: GenerateMetaRequest,
    current_user: User = Depends(require_role(["hr", "admin", "instructor"]))
):
    from app.agents.agents import call_llm
    
    system_prompt = "You are a coding question metadata generator."
    user_prompt = f"""Analyze this coding question and generate metadata for a LeetCode-style environment.
Question: {body.question_text}

Respond ONLY with a JSON object containing:
- "starter_code": A basic Python function signature that solves the problem.
- "test_cases": A list of 3-5 objects, each with "input" and "expected_output".
  CRITICAL: In "input", each argument for the function MUST be on its own line.
  - If an argument is a list/array, format it as a JSON array (e.g. [1, 2, 3]) on one line.
  - If an argument is a number or string, put it on its own line.
- "programming_language": Set to "python".
"""
    ai_res = call_llm(system_prompt, user_prompt)
    return success(ai_res)


# ── Submit Assessment ─────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    assessment_id: int
    answers: dict  # {question_id: answer}
    time_taken_seconds: Optional[int] = None
    proctoring_events: Optional[list] = None


@router.post("/submit")
async def submit_assessment(
    body: SubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import logging
    import traceback
    from decimal import Decimal
    logger = logging.getLogger(__name__)

    try:
        # Create result record
        result_record = AssessmentResult(
            assessment_id=body.assessment_id,
            user_id=current_user.id,
            answers=body.answers,
            time_taken_seconds=body.time_taken_seconds,
            submitted_at=datetime.utcnow(),
        )
        db.add(result_record)
        await db.flush()

        # Log proctoring events
        valid_flag_types = [t.value for t in ProctoringFlagType]
        for event in (body.proctoring_events or []):
            etype = event.get("type")
            if etype not in valid_flag_types:
                logger.warning(f"Unknown proctoring event type: {etype}. Falling back to tab_switch.")
                etype = ProctoringFlagType.tab_switch.value
                
            flag = ProctoringFlag(
                assessment_result_id=result_record.id,
                flag_type=etype,
                details=str(event.get("details", "")),
            )
            db.add(flag)

        # Update assignment status
        assgn_res = await db.execute(
            select(AssessmentAssignment).where(
                AssessmentAssignment.assessment_id == body.assessment_id,
                AssessmentAssignment.user_id == current_user.id,
            )
        )
        assgn = assgn_res.scalar_one_or_none()
        if assgn:
            assgn.status = AssignmentStatus.submitted

        # ── Inline grading (no Celery needed) ─────────────────────────────────
        try:
            assessment_res = await db.execute(select(Assessment).where(Assessment.id == body.assessment_id))
            assessment = assessment_res.scalar_one_or_none()

            questions_res = await db.execute(
                select(AssessmentQuestion).where(AssessmentQuestion.assessment_id == body.assessment_id)
            )
            questions = questions_res.scalars().all()
            answers = body.answers or {}
            scores_per_q = {}
            question_data_for_feedback = []
            total_marks = 0
            earned_marks = 0

            async def grade_coding_question(q, candidate_answer, marks):
                test_cases = q.test_cases or []
                if isinstance(test_cases, str):
                    try: test_cases = json.loads(test_cases)
                    except: test_cases = []
                
                if not test_cases or not candidate_answer:
                    return 0.0
                
                try:
                    if not isinstance(candidate_answer, str):
                        logger.warning(f"Candidate answer for coding q {q.id} is not a string: {type(candidate_answer)}")
                        return 0.0
                    
                    ans_dict = json.loads(candidate_answer)
                    lang = ans_dict.get("language", "python").lower()
                    code = ans_dict.get("code", "")
                    
                    passed = 0
                    import httpx, re, asyncio
                    p_lang = "cpp" if lang == "c++" else lang
                    tests_to_run = test_cases[:10]
                    wrapped_code = wrap_code_for_execution(code, p_lang, tests_to_run)
                    
                    payload = {
                        "language": p_lang,
                        "version": "3.10.0" if p_lang == "python" else "*",
                        "files": [{"content": wrapped_code}]
                    }
                    
                    max_retries = 2
                    resp_data = None
                    for attempt in range(max_retries + 1):
                        try:
                            async with httpx.AsyncClient() as client:
                                resp = await client.post("https://emkc.org/api/v2/piston/execute", json=payload, timeout=12.0)
                                if resp.status_code == 200:
                                    resp_data = resp.json()
                                    break
                                elif resp.status_code == 429 and attempt < max_retries:
                                    await asyncio.sleep(1.5 ** attempt)
                                    continue
                        except Exception:
                            if attempt < max_retries:
                                await asyncio.sleep(1)
                                continue
                    
                    if resp_data:
                        stdout = resp_data.get("run", {}).get("stdout", "")
                        marker_start = "---BATCH_RESULTS_START---"
                        marker_end = "---BATCH_RESULTS_END---"
                        if marker_start in stdout and marker_end in stdout:
                            try:
                                results_str = stdout.split(marker_start)[1].split(marker_end)[0].strip()
                                batch_results = json.loads(results_str)
                                for idx, r in enumerate(batch_results):
                                    out = r.get("stdout", "").strip()
                                    exp = str(tests_to_run[idx].get("expected_output", "")).strip()
                                    if re.sub(r'\s+', '', out).strip() == re.sub(r'\s+', '', exp).strip():
                                        passed += 1
                            except: pass
                        return (passed / len(tests_to_run)) * marks if tests_to_run else 0
                    else:
                        # Fallback to AI grading if Piston is blocked/failed
                        logger.warning(f"Piston failed for q {q.id}, falling back to AI grading")
                        from app.agents.agents import call_llm
                        ai_prompt = f"""Grade this code based on test cases. 
    Code: {code}
    Test Cases: {json.dumps(tests_to_run)}
    Max Marks: {marks}
    Respond ONLY with JSON: {{"score": 0.0, "reason": ""}}"""
                        ai_res = call_llm("You are a code grading AI.", ai_prompt)
                        return min(float(ai_res.get("score", 0)), marks)
                except Exception as e:
                    logger.warning(f"Grading coding {q.id} failed: {e}")
                    return 0.0

            grading_tasks = []
            coding_indices = []
            
            for idx, q in enumerate(questions):
                q_id = str(q.id)
                candidate_answer = answers.get(q_id, "")
                marks = float(q.marks)
                total_marks += marks
                
                qt = q.question_type.value if hasattr(q.question_type, 'value') else q.question_type

                if qt == "mcq":
                    q_score = marks if str(candidate_answer).strip().upper() == str(q.correct_answer or "").strip().upper() else 0
                    scores_per_q[q_id] = {"score": q_score, "max": marks}
                    earned_marks += q_score
                    question_data_for_feedback.append({
                        "id": q.id, "text": q.question_text, "type": qt,
                        "candidate_answer": candidate_answer, "correct_answer": q.correct_answer,
                        "marks": marks, "earned": q_score, "skill_id": q.skill_id,
                    })
                elif qt == "coding":
                    coding_indices.append(len(question_data_for_feedback))
                    grading_tasks.append(grade_coding_question(q, candidate_answer, marks))
                    # Placeholder for feedback data (updated later)
                    question_data_for_feedback.append({
                        "id": q.id, "text": q.question_text, "type": qt,
                        "candidate_answer": candidate_answer, "correct_answer": q.correct_answer,
                        "marks": marks, "earned": 0, "skill_id": q.skill_id,
                    })
                elif qt == "written":
                    # Collected for batching later
                    question_data_for_feedback.append({
                        "id": q.id, "text": q.question_text, "type": qt,
                        "candidate_answer": candidate_answer, "correct_answer": q.correct_answer,
                        "marks": marks, "earned": 0, "skill_id": q.skill_id,
                    })
                elif qt == "file_upload":
                    scores_per_q[q_id] = {"score": None, "status": "pending_review"}
                    question_data_for_feedback.append({
                        "id": q.id, "text": q.question_text, "type": qt,
                        "candidate_answer": candidate_answer, "correct_answer": q.correct_answer,
                        "marks": marks, "earned": None, "skill_id": q.skill_id,
                    })

            # ── Execute Coding Grading Concurrently ──
            if grading_tasks:
                import asyncio
                coding_scores = await asyncio.gather(*grading_tasks)
                for i, score in enumerate(coding_scores):
                    q_idx = coding_indices[i]
                    q_data = question_data_for_feedback[q_idx]
                    q_id_str = str(q_data["id"])
                    scores_per_q[q_id_str] = {"score": score, "max": q_data["marks"]}
                    earned_marks += score
                    question_data_for_feedback[q_idx]["earned"] = score

            # ── Batch grading for written questions ──
            written_indices = [i for i, q in enumerate(question_data_for_feedback) if q["type"] == "written"]
            if written_indices:
                try:
                    from app.agents.agents import call_llm
                    grading_batch = []
                    for idx in written_indices:
                        q_data = question_data_for_feedback[idx]
                        grading_batch.append({
                            "id": q_data["id"],
                            "question": q_data["text"],
                            "model_answer": q_data["correct_answer"] or "General knowledge",
                            "student_answer": q_data["candidate_answer"],
                            "max_marks": q_data["marks"]
                        })
                    
                    batch_system = "You are a specialized written assessment grading AI. Grade the following student answers based on the provided questions and model answers."
                    batch_prompt = f"Grade these {len(grading_batch)} answers. Return a JSON object with a 'grades' key containing a list of objects with 'id', 'score', and 'explanation'.\n\nBatch:\n{json.dumps(grading_batch)}"
                    
                    batch_res = call_llm(batch_system, batch_prompt)
                    grades_list = batch_res.get("grades", [])
                    grades_map = {str(g["id"]): g for g in grades_list}
                    
                    for idx in written_indices:
                        q_data = question_data_for_feedback[idx]
                        q_id_str = str(q_data["id"])
                        grade = grades_map.get(q_id_str, {"score": q_data["marks"] * 0.5})
                        q_score = min(float(grade.get("score", 0)), q_data["marks"])
                        
                        earned_marks += q_score
                        scores_per_q[q_id_str] = {"score": q_score, "max": q_data["marks"]}
                        question_data_for_feedback[idx]["earned"] = q_score
                except Exception as e:
                    logger.warning(f"Batch written grading failed: {e}. Falling back to 50% score.")
                    for idx in written_indices:
                        q_id_str = str(question_data_for_feedback[idx]["id"])
                        if q_id_str not in scores_per_q:
                            scores_per_q[q_id_str] = {"score": question_data_for_feedback[idx]["marks"] * 0.5, "max": question_data_for_feedback[idx]["marks"]}
                            earned_marks += question_data_for_feedback[idx]["marks"] * 0.5
                            question_data_for_feedback[idx]["earned"] = question_data_for_feedback[idx]["marks"] * 0.5

            # Calculate final score
            pct_score = (earned_marks / total_marks * 100) if total_marks > 0 else 0
            passed = pct_score >= float(assessment.pass_score) if assessment else False

            # Generate AI feedback (best-effort)
            weak_skill_ids = []
            try:
                from app.agents.agents import run_generate_feedback_agent
                feedback_data = run_generate_feedback_agent(
                    questions=[{"text": q["text"], "type": q["type"]} for q in question_data_for_feedback],
                    answers={str(q["id"]): q["candidate_answer"] for q in question_data_for_feedback},
                    scores={str(q["id"]): q["earned"] for q in question_data_for_feedback},
                    total_score=round(pct_score, 2),
                    passed=passed,
                )
                is_released = assessment.show_result_immediately if hasattr(assessment, "show_result_immediately") else True
                feedback_text = json.dumps({
                    "summary": feedback_data.get("summary", ""),
                    "strengths": feedback_data.get("strengths", []),
                    "improvement_areas": feedback_data.get("improvement_areas", []),
                    "study_recommendations": feedback_data.get("study_recommendations", []),
                    "_is_released": is_released
                })
                weak_skill_ids = feedback_data.get("weak_skill_ids", [])
            except Exception as e:
                logger.warning(f"AI feedback generation failed: {e}")
                feedback_text = json.dumps({
                    "summary": f"Score: {round(pct_score, 1)}%. {'Passed' if passed else 'Did not pass'}.",
                    "strengths": [], "improvement_areas": [], "study_recommendations": []
                })

            # Update result
            result_record.scores_per_question = scores_per_q
            result_record.score = Decimal(str(round(pct_score, 2)))
            result_record.pass_status = passed
            result_record.feedback = feedback_text
            result_record.weak_skill_ids = weak_skill_ids

            if assgn:
                assgn.status = "graded"

            logger.info(f"Assessment graded inline: {round(pct_score, 2)}% - {'PASS' if passed else 'FAIL'}")

        except Exception as e:
            logger.error(f"Inline grading failed: {e}")
            # Still save the submission even if grading fails
            result_record.feedback = json.dumps({"summary": "Grading pending. Please check back later.", "strengths": [], "improvement_areas": [], "study_recommendations": [], "_is_released": False})

        await db.commit()
        return success({"result_id": result_record.id, "score": float(result_record.score) if result_record.score else None, "passed": result_record.pass_status}, "Assessment submitted and graded.")

    except Exception as e:
        err_msg = f"Submission error: {str(e)}\n{traceback.format_exc()}"
        logger.error(err_msg)
        raise HTTPException(status_code=500, detail=err_msg)

# ── Results ───────────────────────────────────────────────────────────────────

@router.get("/my-results")
async def my_results(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, Assessment).join(Assessment)
        .where(AssessmentResult.user_id == current_user.id)
        .order_by(AssessmentResult.submitted_at.desc())
    )
    rows = result.all()
    out = []
    for res, asmt in rows:
        fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
        is_released = fb.get("_is_released", True) if isinstance(fb, dict) else True
        out.append({
            "result_id": res.id,
            "assessment_id": asmt.id,
            "title": asmt.title,
            "score": float(res.score) if res.score is not None and is_released else None,
            "pass_status": res.pass_status if is_released else None,
            "pass_score": float(asmt.pass_score),
            "feedback": fb if is_released else {"summary": "Result is pending manual review."},
            "time_taken_seconds": res.time_taken_seconds,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "is_released": is_released,
        })
    return success(out)


@router.get("/result/{result_id}")
async def get_result(
    result_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, Assessment).join(Assessment)
        .where(AssessmentResult.id == result_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    res, asmt = row
    if res.user_id != current_user.id and current_user.role.value not in ["hr", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied")

    flags_res = await db.execute(
        select(ProctoringFlag).where(ProctoringFlag.assessment_result_id == result_id)
    )
    flags = [{"type": f.flag_type.value, "details": f.details, "flagged_at": f.flagged_at.isoformat()} for f in flags_res.scalars()]

    is_hr = current_user.role.value in ["hr", "admin", "manager"]
    fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
    is_released = fb.get("_is_released", True) if isinstance(fb, dict) else True

    if not is_hr and not is_released:
        return success({
            "result_id": res.id,
            "assessment": {"id": asmt.id, "title": asmt.title, "pass_score": float(asmt.pass_score)},
            "score": None,
            "pass_status": None,
            "feedback": {"summary": "Result is pending manual review."},
            "scores_per_question": {},
            "time_taken_seconds": res.time_taken_seconds,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "proctoring_flags": [],
            "weak_skill_ids": [],
            "is_released": False,
        })

    return success({
        "result_id": res.id,
        "assessment": {"id": asmt.id, "title": asmt.title, "pass_score": float(asmt.pass_score)},
        "score": float(res.score) if res.score is not None else None,
        "pass_status": res.pass_status,
        "feedback": fb,
        "scores_per_question": res.scores_per_question,
        "time_taken_seconds": res.time_taken_seconds,
        "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
        "proctoring_flags": flags,
        "weak_skill_ids": res.weak_skill_ids,
        "is_released": is_released,
    })


@router.get("/leaderboard/{assessment_id}")
async def get_leaderboard(
    assessment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, User).join(User, User.id == AssessmentResult.user_id)
        .where(AssessmentResult.assessment_id == assessment_id, AssessmentResult.score != None)
        .order_by(AssessmentResult.score.desc())
    )
    rows = result.all()
    return success([{
        "rank": i + 1,
        "name": user.full_name or user.email,
        "score": float(res.score),
        "pass_status": res.pass_status,
        "is_me": user.id == current_user.id,
    } for i, (res, user) in enumerate(rows)])


@router.get("/analytics/{assessment_id}")
async def get_analytics(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    total_assigned = await db.execute(
        select(func.count()).select_from(AssessmentAssignment).where(AssessmentAssignment.assessment_id == assessment_id)
    )
    submitted = await db.execute(
        select(func.count()).select_from(AssessmentResult).where(AssessmentResult.assessment_id == assessment_id, AssessmentResult.score != None)
    )
    passed = await db.execute(
        select(func.count()).select_from(AssessmentResult).where(AssessmentResult.assessment_id == assessment_id, AssessmentResult.pass_status == True)
    )
    avg_score = await db.execute(
        select(func.avg(AssessmentResult.score)).where(AssessmentResult.assessment_id == assessment_id)
    )

    total = total_assigned.scalar() or 0
    sub = submitted.scalar() or 0
    pas = passed.scalar() or 0
    avg = float(avg_score.scalar() or 0)

    return success({
        "total_assigned": total,
        "submitted": sub,
        "pending": total - sub,
        "passed": pas,
        "pass_rate": round((pas / sub * 100) if sub > 0 else 0, 1),
        "average_score": round(avg, 2),
    })


@router.post("/result/{result_id}/release")
async def release_result(
    result_id: int,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AssessmentResult).where(AssessmentResult.id == result_id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
        
    fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
    if isinstance(fb, dict):
        fb["_is_released"] = True
        res.feedback = json.dumps(fb)
    await db.commit()
    
    # Check if we should send an email notification
    try:
        from app.utils.email import send_result_email
        ur = await db.execute(select(User).where(User.id == res.user_id))
        user_record = ur.scalar_one_or_none()
        ar = await db.execute(select(Assessment).where(Assessment.id == res.assessment_id))
        asmt_record = ar.scalar_one_or_none()
        if user_record and asmt_record and res.score is not None:
            import asyncio
            asyncio.create_task(send_result_email(
                to_email=user_record.email,
                assessment_title=asmt_record.title,
                score=float(res.score),
                pass_status=bool(res.pass_status),
                pass_score=float(asmt_record.pass_score),
                result_id=res.id,
            ))
    except Exception as e:
        import logging
        logging.error(f"Failed to email on manual release: {e}")

    return success(message="Result released to candidate")


@router.get("/assessments/{assessment_id}/submissions")
async def get_assessment_submissions(
    assessment_id: int,
    current_user: User = Depends(require_role(["hr", "admin", "manager"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentResult, User).join(User, User.id == AssessmentResult.user_id)
        .where(AssessmentResult.assessment_id == assessment_id)
        .order_by(AssessmentResult.submitted_at.desc())
    )
    rows = result.all()
    out = []
    for res, user in rows:
        fb = json.loads(res.feedback) if res.feedback and res.feedback.startswith("{") else {}
        is_released = fb.get("_is_released", True) if isinstance(fb, dict) else True
        out.append({
            "result_id": res.id,
            "candidate_name": user.full_name or user.email,
            "candidate_id": user.id,
            "score": float(res.score) if res.score is not None else None,
            "pass_status": res.pass_status,
            "submitted_at": res.submitted_at.isoformat() if res.submitted_at else None,
            "is_released": is_released,
        })
    return success(out)
