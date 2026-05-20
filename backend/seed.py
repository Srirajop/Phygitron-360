"""
PHYGITRON 360 — Database Seed Script
Creates demo data: 1 org, 6 users (one per role), skills, job roles, courses, assessments
Run: python seed.py
"""
import asyncio
import random
from datetime import date, datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings
from app.database import Base
from app.models import *
from app.utils.auth import hash_password

DEMO_PASSWORD = "Demo@1234"

SKILLS = [
    ("Python", "python", "Programming"), ("JavaScript", "javascript", "Programming"),
    ("TypeScript", "typescript", "Programming"), ("React", "react", "Frontend"),
    ("Node.js", "nodejs", "Backend"), ("FastAPI", "fastapi", "Backend"),
    ("SQL", "sql", "Database"), ("MySQL", "mysql", "Database"),
    ("AWS", "aws", "Cloud"), ("Docker", "docker", "DevOps"),
    ("Machine Learning", "machine_learning", "AI/ML"), ("Data Analysis", "data_analysis", "AI/ML"),
    ("Project Management", "project_management", "Management"), ("Agile", "agile", "Management"),
    ("Communication", "communication", "Soft Skills"), ("Leadership", "leadership", "Soft Skills"),
    ("HTML", "html", "Frontend"), ("CSS", "css", "Frontend"),
    ("REST APIs", "rest_api", "Backend"), ("Git", "git", "DevOps"),
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # Organisation
        org = Organisation(name="EwandZDigital", domain="ewandz.com", primary_color="#7C3AED",
                          has_source=True, has_verify=True, has_forge=True, has_deploy=True)
        db.add(org)
        await db.flush()

        # Skill Taxonomy
        skill_map = {}
        for name, norm, cat in SKILLS:
            skill = SkillTaxonomy(name=name, normalized_name=norm, category=cat, aliases=[name.lower()])
            db.add(skill)
            await db.flush()
            skill_map[norm] = skill.id

        # Users: one per role
        roles_data = [
            ("admin@ewandz.com", "Platform Admin", "admin"),
            ("hr@ewandz.com", "Sarah HR", "hr"),
            ("manager@ewandz.com", "Mike Manager", "manager"),
            ("instructor@ewandz.com", "Tom Instructor", "instructor"),
            ("employee@ewandz.com", "Emma Employee", "employee"),
            ("candidate@ewandz.com", "Chris Candidate", "candidate"),
        ]

        users = {}
        for email, name, role in roles_data:
            user = User(
                email=email,
                full_name=name,
                password_hash=hash_password(DEMO_PASSWORD),
                role=role,
                org_id=org.id,
                is_active=True,
                first_login=False,
            )
            db.add(user)
            await db.flush()
            users[role] = user

        # Employee record
        emp = Employee(
            user_id=users["employee"].id,
            org_id=org.id,
            emp_id="EMP001",
            department="Engineering",
            join_date=date(2023, 1, 15),
            status="active",
        )
        db.add(emp)
        await db.flush()

        # Manager employee record
        mgr_emp = Employee(
            user_id=users["manager"].id,
            org_id=org.id,
            emp_id="MGR001",
            department="Engineering",
            join_date=date(2021, 6, 1),
            status="active",
        )
        db.add(mgr_emp)
        await db.flush()

        # Link employee to manager
        emp.manager_id = mgr_emp.id

        # Employee skills
        for skill_norm, level in [("python", "advanced"), ("react", "intermediate"), ("sql", "intermediate"), ("git", "advanced")]:
            es = EmployeeSkill(
                employee_id=emp.id,
                skill_id=skill_map[skill_norm],
                level=level,
                verified_by="assessment",
                last_verified_at=datetime.utcnow(),
                decayed=False,
            )
            db.add(es)

        # Candidate record
        cand_user = users["candidate"]
        candidate = Candidate(
            user_id=cand_user.id,
            org_id=org.id,
            location="Bengaluru, India",
            exp_years=3,
            availability="available",
            status="active",
        )
        db.add(candidate)
        await db.flush()

        for skill_norm, level in [("javascript", "intermediate"), ("react", "beginner"), ("html", "advanced"), ("css", "advanced")]:
            cs = CandidateSkill(
                candidate_id=candidate.id,
                skill_id=skill_map[skill_norm],
                level=level,
                source="resume",
            )
            db.add(cs)

        # Job Roles
        frontend_role = JobRole(
            org_id=org.id,
            title="Senior Frontend Developer",
            description="Build modern React applications",
            required_skills=[
                {"skill_id": skill_map["react"], "min_level": "advanced"},
                {"skill_id": skill_map["javascript"], "min_level": "advanced"},
                {"skill_id": skill_map["typescript"], "min_level": "intermediate"},
            ],
            min_experience=3,
        )
        db.add(frontend_role)

        backend_role = JobRole(
            org_id=org.id,
            title="Python Backend Engineer",
            description="Build scalable FastAPI microservices",
            required_skills=[
                {"skill_id": skill_map["python"], "min_level": "advanced"},
                {"skill_id": skill_map["fastapi"], "min_level": "intermediate"},
                {"skill_id": skill_map["sql"], "min_level": "intermediate"},
            ],
            min_experience=2,
        )
        db.add(backend_role)
        await db.flush()

        # Assessment
        assessment = Assessment(
            org_id=org.id,
            title="Frontend Developer Assessment",
            description="Test your React and JavaScript knowledge",
            type="mcq",
            time_limit_minutes=30,
            pass_score=70.0,
            shuffle_questions=True,
            show_result_immediately=True,
            created_by=users["hr"].id,
            status="active",
        )
        db.add(assessment)
        await db.flush()

        questions = [
            ("What is a React Hook?", "mcq", ["A function that lets you use state in functional components", "A CSS class", "A database query", "A server route"], "A function that lets you use state in functional components", skill_map["react"]),
            ("Which hook is used for side effects in React?", "mcq", ["useState", "useEffect", "useContext", "useRef"], "useEffect", skill_map["react"]),
            ("What does 'const' declare in JavaScript?", "mcq", ["A mutable variable", "A block-scoped constant", "A class method", "A function"], "A block-scoped constant", skill_map["javascript"]),
            ("Explain the difference between == and === in JavaScript.", "written", None, None, skill_map["javascript"]),
        ]

        for i, (text, qtype, options, answer, skill_id) in enumerate(questions):
            q = AssessmentQuestion(
                assessment_id=assessment.id,
                question_text=text,
                question_type=qtype,
                options=options,
                correct_answer=answer,
                model_answer="== checks value equality with type coercion, === checks both value and type (strict equality)" if qtype == "written" else None,
                skill_id=skill_id,
                marks=5.0,
                order_index=i,
            )
            db.add(q)

        # Assign assessment to candidate
        assignment = AssessmentAssignment(
            assessment_id=assessment.id,
            user_id=users["candidate"].id,
            assigned_by=users["hr"].id,
            deadline=datetime.utcnow() + timedelta(days=7),
            status="pending",
        )
        db.add(assignment)

        # Course
        course = Course(
            org_id=org.id,
            title="React Fundamentals",
            description="Master React from scratch with hands-on projects",
            skill_ids=[skill_map["react"], skill_map["javascript"]],
            difficulty="beginner",
            estimated_hours=8.0,
            status="published",
            instructor_id=users["instructor"].id,
        )
        db.add(course)
        await db.flush()

        # Sections
        sections_data = [
            ("Introduction to React", "video", 0),
            ("Components and Props", "video", 1),
            ("State and Hooks", "video", 2),
            ("Section Quiz", "quiz", 3),
        ]
        for title, content_type, order in sections_data:
            section = CourseSection(
                course_id=course.id,
                title=title,
                order_index=order,
                content_type=content_type,
                content_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" if content_type == "video" else None,
                duration_minutes=20 if content_type == "video" else None,
                pass_score=60.0,
            )
            db.add(section)
            await db.flush()

            if content_type == "quiz":
                quiz_q = SectionQuiz(
                    section_id=section.id,
                    question_text="What is JSX?",
                    options=["JavaScript XML syntax extension", "Java Extension", "JSON format", "CSS syntax"],
                    correct_answer="JavaScript XML syntax extension",
                    explanation="JSX is a syntax extension for JavaScript that looks similar to XML/HTML.",
                    marks=1.0,
                )
                db.add(quiz_q)

        # Enroll employee in course
        enrollment = Enrollment(
            user_id=users["employee"].id,
            course_id=course.id,
            triggered_by="manual",
            progress_percent=35.0,
        )
        db.add(enrollment)

        await db.commit()

        print(f"""
{'='*60}
✅ PHYGITRON 360 — Seed Complete!
{'='*60}
Demo Accounts (password: {DEMO_PASSWORD})
  🛡️  Admin:      admin@ewandz.com
  👥  HR:         hr@ewandz.com
  📊  Manager:    manager@ewandz.com
  📚  Instructor: instructor@ewandz.com
  💼  Employee:   employee@ewandz.com
  🎯  Candidate:  candidate@ewandz.com
{'='*60}
""")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
