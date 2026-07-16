import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

from backend.modules.source.repositories.offer_repo import OfferRepository
try:
    from backend.core.email_service_extended import send_offer_letter_email
except ImportError:
    send_offer_letter_email = None

logger = logging.getLogger(__name__)

class OfferService:
    def __init__(self, tenant_id: str = "public"):
        self.tenant_id = tenant_id
        self.repo = OfferRepository(tenant_id=tenant_id)

    def get_all_offers(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.repo.get_all_offers(status)

    def get_offer_by_id(self, offer_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_offer_by_id(offer_id)

    def update_offer(self, offer_id: int, updates: Dict[str, Any]) -> bool:
        offer = self.get_offer_by_id(offer_id)
        if not offer:
            raise ValueError("Offer not found")
        if offer["status"] not in ("pending", "changes_requested"):
            raise ValueError(f"Cannot edit an offer with status '{offer['status']}'")

        if not updates:
            return True

        updates["status"] = "pending"
        updates["updated_at"] = datetime.utcnow()
        return self.repo.update_offer(offer_id, updates)

    def approve_offer(self, offer_id: int, user_id: int) -> bool:
        offer = self.get_offer_by_id(offer_id)
        if not offer:
            raise ValueError("Offer not found")
        return self.repo.update_offer_status(offer_id, "approved", user_id=user_id)

    def request_changes(self, offer_id: int, feedback: str) -> bool:
        offer = self.get_offer_by_id(offer_id)
        if not offer:
            raise ValueError("Offer not found")
        return self.repo.update_offer_status(offer_id, "changes_requested", feedback=feedback)

    def reject_offer(self, offer_id: int, feedback: str) -> bool:
        offer = self.get_offer_by_id(offer_id)
        if not offer:
            raise ValueError("Offer not found")
        return self.repo.update_offer_status(offer_id, "rejected", feedback=feedback)

    def send_offer(self, offer_id: int) -> Dict[str, Any]:
        offer = self.get_offer_by_id(offer_id)
        if not offer:
            raise ValueError("Offer not found")
            
        if offer["status"] != "approved":
            raise ValueError(f"Only approved offers can be sent. Current status: {offer['status']}")

        # Fetch the company name for this tenant
        company_name = self.tenant_id
        try:
            from backend.core.database import get_db_connection
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute("SET search_path TO public")
                cur.execute("SELECT company_name FROM tenants WHERE id = %s", (self.tenant_id,))
                row = cur.fetchone()
                if row:
                    company_name = row[0]
            conn.close()
        except Exception:
            pass

        # Check for Rehire / Internal Hire
        from backend.modules.deploy.repositories.employee_repo import EmployeeRepository
        emp_repo = EmployeeRepository()
        existing_emp = emp_repo.get_employee_by_email(offer["candidate_email"], tenant_id=self.tenant_id)
        
        is_active_internal = False

        if existing_emp:
            if existing_emp["employment_status"] != 'Exited':
                is_active_internal = True

        # Send Offer Letter Email
        if send_offer_letter_email:
            try:
                from backend.common.utils.pdf_utils import generate_ewandz_offer_pdf
                pdf_bytes = generate_ewandz_offer_pdf(offer)
                
                send_offer_letter_email(
                    to_email=offer["candidate_email"],
                    candidate_name=offer["candidate_name"],
                    company_name=company_name,
                    role_title=offer["role_title"],
                    department=offer.get("department", ""),
                    salary=offer["salary"],
                    location=offer.get("location", ""),
                    attachment_bytes=pdf_bytes,
                )
            except Exception as email_exc:
                logger.warning(f"Offer email send failed (non-blocking): {email_exc}")
                
        if is_active_internal:
            # Bypass Onboarding entirely for Active Employees
            try:
                emp_repo.update_employee(existing_emp["employee_code"], {
                    "designation": offer["role_title"],
                    "team": offer.get("department", ""),
                    "location": offer.get("location", ""),
                }, tenant_id=self.tenant_id)
                logger.info(f"Internal hire processed: Employee {existing_emp['employee_code']} updated.")
            except Exception as e:
                logger.error(f"Failed to update internal hire details: {e}")
                
            self.repo.mark_offer_sent(offer_id, offer["candidate_id"])
            return {"success": True, "message": "Internal hire offer sent and profile updated instantly."}

        else:
            # Update statuses in the repo
            self.repo.mark_offer_sent(offer_id, offer["candidate_id"])
            
            return {"success": True, "message": "Offer sent successfully. Onboarding will be initiated separately."}
