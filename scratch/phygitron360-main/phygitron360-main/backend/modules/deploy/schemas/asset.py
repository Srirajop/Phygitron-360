from pydantic import BaseModel
from typing import Optional

class AssetChecklist(BaseModel):
    # Onboarding
    ob_laptop: int = 0
    ob_laptop_bag: int = 0
    ob_headphones: int = 0
    ob_mouse: int = 0
    ob_extra_hardware: int = 0
    ob_client_assets: int = 0
    ob_id_card: int = 0
    ob_email_access: int = 0
    ob_groups: int = 0
    ob_mediclaim: int = 0
    ob_pf: int = 0
    ob_remarks: Optional[str] = ""

    # Clearance
    cl_laptop: int = 0
    cl_laptop_bag: int = 0
    cl_headphones: int = 0
    cl_mouse: int = 0
    cl_extra_hardware: int = 0
    cl_client_assets: int = 0
    cl_id_card: int = 0
    cl_email_access: int = 0
    cl_groups: int = 0
    cl_relieving_letter: int = 0
    cl_remarks: Optional[str] = ""

class AssetResponse(AssetChecklist):
    employee_code: str
