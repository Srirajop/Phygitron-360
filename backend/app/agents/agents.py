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
    import re
    
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
    
    # Robustly extract JSON object or array from model responses.
    match = re.search(r'(\{.*\}|\[.*\])', content, re.DOTALL)
    if match:
        content = match.group(1)
    else:
        # Fallback to previous stripping logic if regex fails
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
                
    return json.loads(content.strip())


def call_llm(system_prompt: str, user_prompt: str) -> dict:
    """Call Groq API."""
    engines = [call_groq]
    
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
CRITICAL: For `confidence_signals`, review ONLY skills that the resume explicitly claims. Do not create negative flags for skills that are merely common to the role, inferred from projects, or absent from the resume.
Return at most 5 confidence signals. Prefer the highest-impact claims: senior-level skills, unusually broad stacks, claimed years, or tools listed without matching project/work-history evidence.
For each signal, write a specific recruiter-facing reason. Avoid repeated boilerplate such as "No evidence of X usage in project descriptions or work history."
Use `flag: true` only when a claimed skill has weak, vague, or missing work/project support. Use `flag: false` when the resume gives clear project, employer, metric, or deliverable evidence.
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


def run_score_role_fit_agent(candidate_skills: list, job_required_skills: list, role_title: str = "Unknown Role", role_min_exp: int = 0) -> dict:
    prompt = json.dumps({
        "job_role": role_title,
        "minimum_experience_required": role_min_exp,
        "candidate_skills": candidate_skills,
        "required_skills": job_required_skills
    })
    return call_llm(ROLE_FIT_SYSTEM, f"Score this candidate's role fit for '{role_title}':\n\n{prompt}")


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

EXTRACT_JD_SKILLS_SYSTEM = """You are an HR parsing AI. Extract the required skills from a job description text.
Respond ONLY with valid JSON. No markdown. Raw JSON only.
Return this exact structure:
{
  "skills": [{"name": "Skill Name", "level": "beginner|intermediate|advanced|expert"}]
}"""

def run_extract_jd_skills_agent(jd_text: str) -> dict:
    return call_llm(EXTRACT_JD_SKILLS_SYSTEM, f"Extract skills from this JD:\n\n{jd_text[:4000]}")

COURSE_ARCHITECT_SYSTEM = """You are a Course Architect AI. Convert raw document text and file lists into a structured learning course.
Respond ONLY with valid JSON. No markdown, no explanation text, no code blocks. Raw JSON only.
Structure the course into logical lessons. For each lesson, decide if it should be a 'video' (if a video file was provided), an 'article' (based on document text), or a 'quiz'.
Generate 3-5 MCQ questions for each quiz based on the document content.

CRITICAL OUTPUT SIZE LIMITS:
- Do NOT generate more than 8 sections/lessons in total.
- Limit to at most 2 quizzes across the entire course.
If there are many files, select the top 8 most relevant ones.

Return this exact structure:
{
  "title": "Course Title",
  "description": "Course Summary",
  "estimated_hours": 0.0,
  "difficulty": "beginner|intermediate|advanced|expert",
  "category": "Engineering|Design|Strategy|...",
  "sections": [
    {
      "title": "Lesson Title",
      "content_type": "video|article|quiz",
      "content_markdown": "If article, extracted/summarized text. If video, mention the filename clearly.",
      "duration_minutes": 20,
      "quizzes": [
        {
          "question_text": "",
          "options": ["opt1", "opt2", "opt3", "opt4"],
          "correct_answer": "correct_opt",
          "explanation": "",
          "marks": 1.0
        }
      ]
    }
  ]
}"""

def run_course_architect_agent(context_text: str, file_list: list) -> dict:
    prompt = json.dumps({
        "files_provided": file_list[:8], # Cap files to stay well under 6000 TPM limits
        "raw_text_context": context_text[:5000] # Cap context strictly for 6000 TPM limits
    })
    return call_llm(COURSE_ARCHITECT_SYSTEM, f"Architect a course from these materials:\n\n{prompt}")
