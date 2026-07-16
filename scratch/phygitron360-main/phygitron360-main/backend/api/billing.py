import os
from fastapi import APIRouter, Request, HTTPException
from backend.core.database import get_db_connection

router = APIRouter(prefix="/api/billing", tags=["Billing"])

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe Webhook Handler: Updates tenant billing status and enables modules.
    In a real implementation, we would verify the Stripe signature.
    """
    payload = await request.json()
    event_type = payload.get("type", "")

    if event_type == "checkout.session.completed":
        session = payload.get("data", {}).get("object", {})
        tenant_id = session.get("client_reference_id")
        
        # In a real app, this metadata would indicate which modules were purchased
        modules_str = session.get("metadata", {}).get("modules", "deploy,source")
        purchased_modules = [m.strip() for m in modules_str.split(",")]
        
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Missing tenant identifier in checkout session")

        # Update tenant status
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("SET search_path TO public")
                cur.execute(
                    "UPDATE tenants SET subscription_status = 'active', modules_enabled = %s WHERE id = %s",
                    (purchased_modules, tenant_id)
                )
                conn.commit()
                return {"status": "success", "message": "Tenant modules enabled"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            conn.close()
            
    return {"status": "ignored"}

