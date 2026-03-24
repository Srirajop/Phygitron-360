import json
import logging
from app.tasks.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


import random
import httpx

def call_groq(system_prompt: str, user_prompt: str) -> dict:
    """Call Groq API via the groq library and return parsed JSON."""
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=4096,
    )
    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content)


def call_pico(system_prompt: str, user_prompt: str) -> dict:
    """Call Pico Apps LLM API as a fallback to avoid Groq rate limits."""
    url = "https://backend.buildpicoapps.com/aero/run/llm-api?pk=v1-Z0FBQUFBQnB3WHloNUFJSnNsc1BzWlZaYkYwcjNwSnZLSDJVSjl5ODdQZVZGZE1CS3JXWGNFM1dyNW9pQ3drZkcxalNGb1N5SDlKZ3FLbXVnWk5IaWprNzBxTDVUaTZJLWc9PQ=="
    prompt = f"System Rules:\n{system_prompt}\n\nUser Input:\n{user_prompt}\n\nEnsure your response is ONLY raw JSON. No markdown."
    
    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, json={"prompt": prompt})
        response.raise_for_status()
        data = response.json()
        
        if data.get("status") == "success":
            content = data.get("text", "").strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                raise ValueError(f"Pico API did not return valid JSON: {content[:200]}")
        else:
            raise Exception(f"Pico API returned failure: {data}")


def call_llm(system_prompt: str, user_prompt: str) -> dict:
    """Load balancer / Fallback wrapper around Groq and Pico Apps APIs."""
    engines = [call_groq, call_pico]
    # Keep Groq first but fallback to Pico
    # random.shuffle(engines) # Removed shuffle to prioritize Groq if it works, but allow fallback
    
    last_exception = None
    for engine in engines:
        try:
            return engine(system_prompt, user_prompt)
        except Exception as e:
            last_exception = e
            logger.warning(f"LLM Engine {engine.__name__} failed: {str(e)[:200]}. Trying next...")
    
    logger.error("All LLM Engines failed!")
    raise last_exception


PARSE_RESUME_SYSTEM = """You are a resume parsing AI. Extract structured data from the resume text.
Respond ONLY with valid JSON. No markdown, no explanation text, no code blocks. Raw JSON only.
CRITICAL: For `confidence_signals`, rigorously check if mentioned skills are ACTUALLY used in the project descriptions or work history. If a skill is listed but not backed by project history, flag it as potentially fake.
Return this exact structure:
{
  "name": "",
  "skills": [{"name": "", "normalized_name": "", "level": "beginner|intermediate|advanced|expert", "evidence": "", "years_of_use": 0}],
  "relationships": [{"from": "", "to": "", "relation": "requires|leads_to|used_for|similar_to"}],
  "experience_years_total": 0,
  "education": [{"degree": "", "institution": "", "year": 0}],
  "location": "",
  "availability": "available|open_to_opportunities|not_available",
  "confidence_signals": [{"skill": "", "claimed_years": 0, "supported_years": 0, "flag": false, "reason": ""}]
}"""


ROLE_FIT_SYSTEM = """You are a talent assessment AI. Score a candidate's fit for a job role.
Respond ONLY with valid JSON. No markdown, no explanation text, no code blocks. Raw JSON only.
Return this exact structure:
{
  "score": 0,
  "summary": "",
  "matched_skills": [],
  "missing_skills": [],
  "partially_matched": [{"skill": "", "candidate_level": "", "required_level": ""}],
  "interview_questions": []
}"""


FEEDBACK_SYSTEM = """You are an assessment feedback AI. Generate personalised learning feedback.
Respond ONLY with valid JSON. No markdown, no explanation text, no code blocks. Raw JSON only.
Return this exact structure:
{
  "summary": "",
  "strengths": [],
  "improvement_areas": [],
  "study_recommendations": [],
  "weak_skill_ids": []
}"""


RECOMMEND_COURSES_SYSTEM = """You are a learning recommendation AI. Match skill gaps to courses.
Respond ONLY with valid JSON. No markdown, no explanation text, no code blocks. Raw JSON only.
Return this exact structure:
{
  "recommendations": [{"course_id": 0, "reason": "", "priority": 1}]
}"""


MATCH_PROJECT_SYSTEM = """You are a workforce deployment AI. Match employees to project requirements.
Respond ONLY with valid JSON. No markdown, no explanation text, no code blocks. Raw JSON only.
Return this exact structure:
{
  "ranked_employees": [{"employee_id": 0, "match_score": 0, "matched_skills": [], "missing_skills": [], "reason": ""}]
}"""


def run_parse_resume_agent(resume_text: str) -> dict:
    return call_llm(PARSE_RESUME_SYSTEM, f"Parse this resume:\n\n{resume_text[:8000]}")


def run_score_role_fit_agent(candidate_skills: list, job_required_skills: list) -> dict:
    prompt = json.dumps({
        "candidate_skills": candidate_skills,
        "required_skills": job_required_skills
    })
    return call_llm(ROLE_FIT_SYSTEM, f"Score this candidate's role fit:\n\n{prompt}")


def run_generate_feedback_agent(questions: list, answers: dict, scores: dict, total_score: float, passed: bool) -> dict:
    prompt = json.dumps({
        "questions": questions,
        "candidate_answers": answers,
        "scores_per_question": scores,
        "total_score": total_score,
        "passed": passed
    })
    return call_llm(FEEDBACK_SYSTEM, f"Generate assessment feedback:\n\n{prompt}")


def run_recommend_courses_agent(weak_skill_ids: list, available_courses: list) -> dict:
    prompt = json.dumps({
        "weak_skill_ids": weak_skill_ids,
        "available_courses": available_courses
    })
    return call_llm(RECOMMEND_COURSES_SYSTEM, f"Recommend courses for skill gaps:\n\n{prompt}")


def run_match_project_agent(project_requirements: dict, employee_profiles: list) -> dict:
    prompt = json.dumps({
        "project_requirements": project_requirements,
        "employee_profiles": employee_profiles
    })
    return call_llm(MATCH_PROJECT_SYSTEM, f"Match employees to project:\n\n{prompt}")


GENERATE_OFFER_LETTER_SYSTEM = """You are a professional HR assistant at eWandzDigital.
Write a warm, personalized internship offer letter.
The letter should be professional yet human-like, unique for each candidate.
Incorporate these details naturally:
- Candidate Name
- Internship Role
- Start Date
- Monthly Stipend (INR)
- Location
- Company: eWandzDigital

Respond ONLY with valid JSON. Raw JSON only.
Return this structure:
{
  "subject": "Offer for Internship - [Candidate Name]",
  "salutation": "Dear [Name],",
  "body_paragraphs": ["paragraph 1", "paragraph 2", "paragraph 3"],
  "closing": "Sincerely,",
  "signatory_name": "Zainab Ghazi",
  "signatory_title": "Manager - Global HR Operations"
}"""

def run_generate_offer_letter_agent(candidate_name: str, details: dict) -> dict:
    prompt = json.dumps({
        "candidate_name": candidate_name,
        "details": details
    })
    return call_llm(GENERATE_OFFER_LETTER_SYSTEM, f"Generate a personalized internship offer letter for:\n\n{prompt}")
