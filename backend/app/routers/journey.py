from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.journey import Journey, JourneyStep, JourneyAssignment, JourneyStepType, JourneyAssignmentStatus
from app.models.verify import Assessment, AssessmentAssignment
from app.models.forge import Course, Enrollment
from app.utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/v1/journey", tags=["Journey"])


def success(data=None, message=""):
    return {"success": True, "data": data if data is not None else {}, "message": message}


# ── Schemas ───────────────────────────────────────────────────────────────────

class JourneyStepCreate(BaseModel):
    type: JourneyStepType
    reference_id: int
    order_index: int = 0


class JourneyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    steps: List[JourneyStepCreate] = []


class AssignJourneyRequest(BaseModel):
    user_ids: List[int]
    deadline: Optional[datetime] = None


class JourneyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[JourneyStepCreate]] = None


# ── Journey Management ────────────────────────────────────────────────────────

@router.post("/journeys")
async def create_journey(
    body: JourneyCreate,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    journey = Journey(
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        created_by=current_user.id
    )
    db.add(journey)
    await db.flush()

    for step_data in body.steps:
        step = JourneyStep(
            journey_id=journey.id,
            type=step_data.type,
            reference_id=step_data.reference_id,
            order_index=step_data.order_index
        )
        db.add(step)

    await db.commit()
    return success({"id": journey.id, "title": journey.title}, "Journey created successfully")


@router.get("/journeys")
async def list_journeys(
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    query = select(Journey).order_by(Journey.created_at.desc())
    if current_user.role.value != "super_admin":
        query = query.where(Journey.org_id == current_user.org_id)
    result = await db.execute(query)
    journeys = result.scalars().all()
    
    out = []
    for j in journeys:
        # Count steps
        steps_count = await db.execute(select(func.count(JourneyStep.id)).where(JourneyStep.journey_id == j.id))
        out.append({
            "id": j.id,
            "title": j.title,
            "description": j.description,
            "steps_count": steps_count.scalar(),
            "created_at": j.created_at.isoformat()
        })
    return success(out)


@router.get("/journeys/{journey_id}")
async def get_journey(
    journey_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Journey).where(Journey.id == journey_id))
    journey = result.scalar_one_or_none()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    steps_result = await db.execute(
        select(JourneyStep).where(JourneyStep.journey_id == journey_id).order_by(JourneyStep.order_index)
    )
    steps = steps_result.scalars().all()

    steps_out = []
    for s in steps:
        title = "Unknown"
        if s.type == JourneyStepType.verify:
            res = await db.execute(select(Assessment.title).where(Assessment.id == s.reference_id))
            title = res.scalar() or "Deleted Assessment"
        elif s.type == JourneyStepType.forge:
            res = await db.execute(select(Course.title).where(Course.id == s.reference_id))
            title = res.scalar() or "Deleted Course"
        
        steps_out.append({
            "id": s.id,
            "type": s.type,
            "reference_id": s.reference_id,
            "title": title,
            "order_index": s.order_index
        })

    return success({
        "id": journey.id,
        "title": journey.title,
        "description": journey.description,
        "steps": steps_out
    })


@router.patch("/journeys/{journey_id}")
async def update_journey(
    journey_id: int,
    body: JourneyUpdate,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Journey).where(Journey.id == journey_id))
    journey = result.scalar_one_or_none()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    if body.title is not None:
        journey.title = body.title
    if body.description is not None:
        journey.description = body.description

    if body.steps is not None:
        # Delete old steps
        from app.models.journey import JourneyStep
        from sqlalchemy import delete
        await db.execute(delete(JourneyStep).where(JourneyStep.journey_id == journey_id))
        
        # Add new steps
        for step_data in body.steps:
            step = JourneyStep(
                journey_id=journey_id,
                type=step_data.type,
                reference_id=step_data.reference_id,
                order_index=step_data.order_index
            )
            db.add(step)

    await db.commit()
    return success({"id": journey.id}, "Journey updated successfully")


# ── Assignment ────────────────────────────────────────────────────────────────

@router.post("/journeys/{journey_id}/assign")
async def assign_journey(
    journey_id: int,
    body: AssignJourneyRequest,
    current_user: User = Depends(require_role(["hr", "org_admin"])),
    db: AsyncSession = Depends(get_db),
):
    # Verify journey exists
    res = await db.execute(select(Journey).where(Journey.id == journey_id))
    journey = res.scalar_one_or_none()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")

    assigned_count = 0
    for user_id in body.user_ids:
        # Check if already assigned
        existing = await db.execute(
            select(JourneyAssignment).where(
                JourneyAssignment.journey_id == journey_id,
                JourneyAssignment.user_id == user_id
            )
        )
        if existing.scalar_one_or_none():
            continue

        assignment = JourneyAssignment(
            journey_id=journey_id,
            user_id=user_id,
            assigned_by=current_user.id,
            deadline=body.deadline,
            status=JourneyAssignmentStatus.pending
        )
        db.add(assignment)
        
        # Auto-assign the individual steps (assessments/courses)
        steps_res = await db.execute(select(JourneyStep).where(JourneyStep.journey_id == journey_id))
        steps = steps_res.scalars().all()
        
        for s in steps:
            if s.type == JourneyStepType.verify:
                # Add to assessment_assignments if not exists
                db.add(AssessmentAssignment(
                    assessment_id=s.reference_id,
                    user_id=user_id,
                    assigned_by=current_user.id,
                    deadline=body.deadline
                ))
            elif s.type == JourneyStepType.forge:
                # Add to enrollments if not exists
                db.add(Enrollment(
                    user_id=user_id,
                    course_id=s.reference_id,
                    deadline=body.deadline
                ))
        
        assigned_count += 1

    await db.commit()
    return success({"assigned": assigned_count}, f"Journey assigned to {assigned_count} users")


@router.get("/my-journeys")
async def get_my_journeys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JourneyAssignment, Journey)
        .join(Journey)
        .where(JourneyAssignment.user_id == current_user.id)
    )
    rows = result.all()
    
    out = []
    for assignment, journey in rows:
        # Get steps and their status
        steps_res = await db.execute(
            select(JourneyStep).where(JourneyStep.journey_id == journey.id).order_by(JourneyStep.order_index)
        )
        steps = steps_res.scalars().all()
        
        completed_steps = 0
        total_steps = len(steps)
        
        for s in steps:
            if s.type == JourneyStepType.verify:
                # Check AssessmentResult
                from app.models.verify import AssessmentResult
                res = await db.execute(
                    select(AssessmentResult).where(
                        AssessmentResult.assessment_id == s.reference_id,
                        AssessmentResult.user_id == current_user.id
                    )
                )
                if res.scalar_one_or_none():
                    completed_steps += 1
            elif s.type == JourneyStepType.forge:
                # Check Enrollment progress
                res = await db.execute(
                    select(Enrollment).where(
                        Enrollment.course_id == s.reference_id,
                        Enrollment.user_id == current_user.id
                    )
                )
                enrollment = res.scalar_one_or_none()
                if enrollment and enrollment.completed_at:
                    completed_steps += 1
        
        progress = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Update assignment status if all completed
        if completed_steps == total_steps and total_steps > 0 and assignment.status != JourneyAssignmentStatus.completed:
            assignment.status = JourneyAssignmentStatus.completed
            assignment.completed_at = datetime.utcnow()
            await db.flush()

        out.append({
            "assignment_id": assignment.id,
            "journey_id": journey.id,
            "title": journey.title,
            "description": journey.description,
            "status": assignment.status.value,
            "progress_percent": round(progress, 1),
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "deadline": assignment.deadline.isoformat() if assignment.deadline else None
        })
    
    await db.commit()
    return success(out)
