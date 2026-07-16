import os
import uuid
import math
import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.modules.source.repositories.candidate_repo import CandidateRepository
from backend.modules.source.repositories.skill_repo import SkillRepository
from backend.modules.source.repositories.ai_score_repo import AIScoreRepository
from backend.modules.source.services.ats_engine import calculate_role_fit, compute_resume_ats_score, normalise_required_skills
from backend.common.services.ai.agents import AIAgents

logger = logging.getLogger(__name__)

class CandidateService:
    def __init__(self, tenant_id: str = 'public'):
        self.tenant_id = tenant_id
        self.repo = CandidateRepository(tenant_id=tenant_id)
        self.skill_repo = SkillRepository(tenant_id=tenant_id)
        self.ai_score_repo = AIScoreRepository(tenant_id=tenant_id)
        self.ai_agents = AIAgents()
        
        # Define upload directory
        self.BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        self.UPLOAD_DIR = os.path.join(self.BASE_DIR, "data", self.tenant_id, "source", "resumes")
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)

    async def process_and_save_resume(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Orchestrates resume upload, text extraction, AI parsing, and database saving.
        """
        import tempfile
        from backend.common.services.storage_service import save_file_content
        import mimetypes

        # 1. Save to Temporary File for Text Extraction
        ext = os.path.splitext(filename)[1].lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        try:
            # 2. Extract Text
            extracted_text = self._extract_text(tmp_path, ext)
            if not extracted_text.strip():
                raise ValueError("Could not extract any text from the file.")
        finally:
            import os
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        # 3. Save File Permanently (S3 or Local)
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        file_id = str(uuid.uuid4())
        save_filename = f"{file_id}{ext}"
        
        final_file_path = save_file_content(
            content=file_content,
            filename=save_filename,
            content_type=content_type,
            tenant_id=self.tenant_id,
            module_name="source",
            data_type="resumes"
        ) or tmp_path



        # 3. Parse with AI Engine (Using advanced AIAgents)
        ai_result = await self.ai_agents.parse_resume(extracted_text)
        name = ai_result.get("n") or ai_result.get("name")
        if not ai_result or not name:
            raise ValueError("AI could not parse useful data from this resume")

        # 4. Create or Update Candidate Record
        email = ai_result.get("e") or ai_result.get("email")
        if not email:
            email = f"unknown_{uuid.uuid4().hex[:8]}@phygitron.local"
            
        # Extract primary / secondary skills from AI result or fallback to splitting skills
        primary_skills = ai_result.get("p_sk") or ai_result.get("primary_skills", [])
        secondary_skills = ai_result.get("s_sk") or ai_result.get("secondary_skills", [])
        if not primary_skills and ai_result.get("skills"):
            skills_raw = ai_result.get("skills", [])
            primary_skills = [s.get("name") if isinstance(s, dict) else s for s in skills_raw]

        # Map experience from restructured format
        raw_experience = ai_result.get("exp") or ai_result.get("experience", [])
        experience = []
        for exp in raw_experience:
            if isinstance(exp, dict):
                experience.append({
                    "company": exp.get("c") or exp.get("company", ""),
                    "designation": exp.get("r") or exp.get("designation") or exp.get("role", ""),
                    "start_date": exp.get("s") or exp.get("start_date", ""),
                    "end_date": exp.get("e") or exp.get("end_date", ""),
                    "is_current": exp.get("is_current") or (exp.get("e") == "Present" or exp.get("end_date") == "Present"),
                    "description": exp.get("description", "")
                })
            else:
                experience.append(exp)

        # Map education from restructured format
        raw_education = ai_result.get("edu") or ai_result.get("education", [])
        education = []
        for edu in raw_education:
            if isinstance(edu, dict):
                education.append({
                    "degree": edu.get("d") or edu.get("degree", ""),
                    "institution": edu.get("c") or edu.get("institution") or edu.get("college", ""),
                    "start_date": edu.get("s") or edu.get("start_date", ""),
                    "end_date": edu.get("e") or edu.get("end_date", ""),
                    "field_of_study": edu.get("field_of_study", "")
                })
            else:
                education.append(edu)

        # Map certifications from restructured format
        raw_certifications = ai_result.get("cert") or ai_result.get("certifications", [])
        certifications = []
        for cert in raw_certifications:
            if isinstance(cert, dict):
                certifications.append({
                    "name": cert.get("n") or cert.get("name", ""),
                    "issuer": cert.get("i") or cert.get("issuer", ""),
                    "year": int(cert.get("y") or cert.get("year") or 0)
                })
            else:
                certifications.append(cert)

        candidate_data = {
            "full_name": name or "Unknown Candidate",
            "email": email,
            "phone": ai_result.get("p") or ai_result.get("phone"),
            "location": ai_result.get("l") or ai_result.get("location"),
            "total_experience_years": ai_result.get("x") or ai_result.get("experience_years_total") or 0,
            "current_designation": ai_result.get("d") or ai_result.get("current_designation"),
            "linkedin_url": ai_result.get("ln") or ai_result.get("linkedin_url"),
            "portfolio_url": ai_result.get("pt") or ai_result.get("portfolio_url"),
            "ai_summary": ai_result.get("s") or ai_result.get("ai_summary"),
            "certifications": certifications,
            "resume_path": final_file_path,
            "source": "AI Resume Parse",
            "status": "New",
            "primary_skills": primary_skills,
            "secondary_skills": secondary_skills,
            "experience": experience,
            "education": education
        }
        
        # We only try to upsert if we actually had a valid email from the AI.
        # If it's a generated unknown email, we force a new record so we don't accidentally overwrite.
        existing = None
        if "unknown_" not in candidate_data["email"]:
            existing = self.repo.get_candidate_by_email(candidate_data["email"])
            
        if existing:
            # Update existing candidate with freshly parsed data instead of failing
            candidate_id = existing["id"]
            self.repo.update_candidate(candidate_id, candidate_data)
            self.repo.log_activity(candidate_id, 'System', 'profile_updated', 'Profile updated via bulk resume re-upload')
        else:
            candidate_id = self.repo.create_candidate(candidate_data)
            self.repo.log_activity(candidate_id, 'System', 'profile_created', 'Profile created and parsed via AI')

        # 6. Process Confidence Signals
        confidence_signals = ai_result.get("cs") or ai_result.get("confidence_signals", [])
        if confidence_signals:
            import json
            self.ai_score_repo.create_ai_score({
                "entity_type": "candidate",
                "entity_id": candidate_id,
                "job_role_id": None,
                "score_type": "confidence_signals",
                "score": 0,
                "reasoning": json.dumps(confidence_signals)
            })

        return {
            "candidate_id": candidate_id,
            "parsed_data": ai_result
        }


    def _extract_text(self, file_path: str, ext: str) -> str:
        """Extract plain text from a resume file. Always returns a clean string safe for DB storage."""
        extracted_text = ""
        try:
            if ext == ".pdf":
                import fitz
                try:
                    fitz.TOOLS.mupdf_display_errors(False)
                    fitz.TOOLS.mupdf_display_warnings(False)
                except Exception:
                    pass
                try:
                    with fitz.open(file_path) as pdf:
                        for page in pdf:
                            extracted_text += page.get_text() + "\n"
                except Exception as pdf_err:
                    logger.warning(f"PyMuPDF failed to parse {file_path}: {pdf_err}. Trying pdfplumber...")
                    extracted_text = ""
                
                # Fallback: if PyMuPDF extracted nothing, try pdfplumber
                if not extracted_text.strip():
                    try:
                        import pdfplumber
                        with pdfplumber.open(file_path) as pdf:
                            for page in pdf.pages:
                                extracted_text += (page.extract_text() or "") + "\n"
                    except Exception as pl_err:
                        logger.warning(f"pdfplumber fallback failed for {file_path}: {pl_err}")
            elif ext == ".txt":
                try:
                    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        extracted_text = f.read()
                except Exception as e:
                    logger.warning(f"TXT read failed for {file_path}: {e}")
            elif ext in (".docx", ".doc"):
                try:
                    extracted_text = self._extract_docx_data(file_path)
                except Exception as e:
                    # Common case: Naukri exports HTML files but names them .doc
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                        
                        # Binary .doc files contain random bytes that can accidentally match "<html" or "<table"
                        # in OLE metadata/headers. We check only the first 1024 characters to be safe.
                        content_lower_prefix = content[:1024].lower()
                        if "<html" in content_lower_prefix or "<table" in content_lower_prefix:
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(content, "html.parser")
                            # Strip scripts and styles to avoid code extraction
                            for s in soup(["script", "style"]):
                                s.decompose()
                            extracted_text = soup.get_text(separator="\n", strip=True)
                        else:
                            # If it's a binary .doc and not HTML, try using system tools
                            import subprocess
                            import shutil
                            
                            cmd = None
                            if shutil.which("antiword"):
                                cmd = ["antiword", file_path]
                            elif shutil.which("catdoc"):
                                cmd = ["catdoc", file_path]
                            elif shutil.which("textutil"):
                                cmd = ["textutil", "-convert", "txt", "-stdout", file_path]
                                
                            if cmd:
                                result = subprocess.run(
                                    cmd, 
                                    capture_output=True, 
                                    text=True
                                )
                                if result.returncode == 0 and result.stdout.strip():
                                    extracted_text = result.stdout
                                else:
                                    logger.warning(f"System extraction tool failed for {file_path}")
                                    extracted_text = ""
                            else:
                                logger.warning(f"DOC extraction failed. Please install 'antiword' or 'catdoc' on your production server to parse legacy .doc files: {file_path}")
                                extracted_text = ""
                    except Exception as fallback_err:
                        logger.warning(f"DOCX/HTML extraction failed for {file_path}: {fallback_err} (Original error: {e})")
                        extracted_text = ""
        except Exception as e:
            logger.error(f"Text extraction failed for {file_path}: {e}")
            extracted_text = ""

        # Sanitize: strip NUL bytes and other control chars PostgreSQL rejects
        return self._sanitize_text(extracted_text)

    def _extract_docx_data(self, file_path: str) -> str:
        """Extracts text from paragraphs, tables, headers, footers, and textboxes inside a DOCX file."""
        from docx import Document
        doc = Document(file_path)
        full_text = []

        def extract_from_block(block):
            if not block: return
            
            # Paragraphs
            for p in getattr(block, 'paragraphs', []):
                if p.text.strip():
                    full_text.append(p.text.strip())
                    
            # Tables
            for t in getattr(block, 'tables', []):
                for row in t.rows:
                    row_text = []
                    for cell in row.cells:
                        cell_paragraphs = [p.text.strip() for p in cell.paragraphs if p.text.strip()]
                        if cell_paragraphs:
                            row_text.append(" | ".join(cell_paragraphs))
                    if row_text:
                        full_text.append(" | ".join(row_text))
                        
            # Textboxes (often used in fancy resume headers/footers)
            try:
                if hasattr(block, 'element') and block.element is not None:
                    for txbx in block.element.xpath('.//w:txbxContent'):
                        for p_elem in txbx.xpath('.//w:p'):
                            p_text = p_elem.text
                            if not p_text:
                                p_text = "".join([t.text for t in p_elem.xpath('.//w:t') if t.text])
                            if p_text.strip():
                                full_text.append(p_text.strip())
            except Exception as e:
                pass

        # 1. Extract from headers
        try:
            for section in doc.sections:
                extract_from_block(getattr(section, 'header', None))
                extract_from_block(getattr(section, 'first_page_header', None))
                extract_from_block(getattr(section, 'even_page_header', None))
        except Exception as e:
            logger.debug(f"Header extraction skipped: {e}")

        # 2 & 3 & 4. Extract from main body paragraphs, tables, and text boxes
        extract_from_block(doc)

        # 5. Extract from footers
        try:
            for section in doc.sections:
                extract_from_block(getattr(section, 'footer', None))
                extract_from_block(getattr(section, 'first_page_footer', None))
                extract_from_block(getattr(section, 'even_page_footer', None))
        except Exception as e:
            logger.debug(f"Footer extraction skipped: {e}")

        return "\n".join(full_text)

    @staticmethod
    def _sanitize_text(text: str) -> str:
        """Remove NUL bytes and non-UTF8-safe characters before storing in PostgreSQL."""
        if not text:
            return ""
        # Remove NUL bytes (PostgreSQL TEXT columns reject \x00 entirely)
        text = text.replace('\x00', '')
        # Replace other non-printable control chars (except tab, newline, carriage return)
        import re
        text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        
        # Compress whitespace to save LLM tokens and improve parsing
        # 1. Replace multiple spaces/tabs with a single space
        text = re.sub(r'[ \t]+', ' ', text)
        # 2. Replace multiple newlines (with optional spaces between) with a single newline
        text = re.sub(r'\n\s*\n', '\n', text)
        
        return text.strip()

    def _extract_name_from_filename(self, filename: str) -> str:
        """Fallback to extract candidate name from file name if LLM couldn't find it."""
        import re
        if not filename:
            return ""
        # Remove extension
        name = os.path.splitext(filename)[0]
        # Remove Naukri_ prefix (case insensitive)
        name = re.sub(r'^naukri_', '', name, flags=re.I)
        # Remove bracketed experience e.g. [3y_8m]
        name = re.sub(r'\[.*?\]', '', name)
        # Remove common trailing terms like _SOC, _Resume, _CV, etc.
        name = re.sub(r'[-_](?:soc|resume|cv|new|latest|updated|profile|docs?)\b', '', name, flags=re.I)
        name = re.sub(r'\b(?:soc|resume|cv|new|latest|updated|profile|docs?)\b', '', name, flags=re.I)
        # Replace punctuation/spacing characters with spaces
        name = re.sub(r'[-_\.]', ' ', name)
        # Clean double spaces
        name = re.sub(r'\s+', ' ', name).strip()
        # Handle CamelCase: split words
        name = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)
        name = re.sub(r'\s+', ' ', name).strip()
        # Title case capitalization
        return name.title()

    def get_all_candidates(self, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
        candidates = self.repo.get_all_candidates(page=page, page_size=page_size)
        total = self.repo.get_candidates_count()
        return {
            "candidates": candidates,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": math.ceil(total / page_size) if page_size > 0 else 0
        }

    def get_candidate(self, candidate_id: int) -> Optional[Dict[str, Any]]:
        return self.repo.get_candidate_by_id(candidate_id)

    def update_status(self, candidate_id: int, new_status: str, role_id: Optional[int] = None) -> bool:
        return self.repo.update_candidate_status(candidate_id, new_status, role_id=role_id)

    def add_note(self, candidate_id: int, author_name: str, content: str) -> Dict[str, Any]:
        return self.repo.add_candidate_note(candidate_id, author_name, content)

    def create_manual_candidate(self, data: Dict[str, Any], actor_name: str) -> int:
        candidate_id = self.repo.create_candidate(data)
        self.repo.log_activity(candidate_id, actor_name, "profile_created", "Manual candidate entry")
        return candidate_id

    def delete_candidate(self, candidate_id: int) -> bool:
        return self.repo.delete_candidate(candidate_id)

    def bulk_delete_candidates(self, candidate_ids: List[int]) -> int:
        return self.repo.bulk_delete_candidates(candidate_ids)

    def revert_employee(self, employee_id: int) -> bool:
        return self.repo.revert_employee(employee_id)

    @staticmethod
    def _parse_skill_list(skills: Any) -> List[str]:
        if not skills:
            return []
        import json
        if isinstance(skills, str):
            try:
                parsed = json.loads(skills)
                if isinstance(parsed, list):
                    return [str(s) for s in parsed]
                return [skills]
            except Exception:
                if "," in skills:
                    return [s.strip() for s in skills.split(",") if s.strip()]
                return [skills]
        if isinstance(skills, list):
            return [str(s) for s in skills]
        return []

    # ── New Business Logic ───────────────────────────────────────────────────

    def search_candidates(
        self,
        pool: Optional[str] = None,
        location: Optional[str] = None,
        min_exp: Optional[float] = None,
        exp_range: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "newest",
        role_id: Optional[int] = None,
        limit: int = 20
    ) -> tuple[List[Dict[str, Any]], int]:
        candidates, total_count = self.repo.search_candidates(
            pool=pool, location=location, min_exp=min_exp, exp_range=exp_range,
            search=search, sort_by=sort_by, limit=limit, role_id=role_id
        )

        req_skills = []
        role_min_exp = 0
        if role_id:
            from backend.modules.source.repositories.job_role_repo import JobRoleRepository
            role_repo = JobRoleRepository(tenant_id=self.tenant_id)
            role = role_repo.get_job_role_by_id(role_id)
            if role:
                req_skills = normalise_required_skills(
                    role.get("required_skills"),
                    title=role.get("title") or "",
                    description=role.get("description") or ""
                )
                role_min_exp = role.get("min_experience") or 0

        for cand in candidates:
            cand["primary_skills"] = self._parse_skill_list(cand.get("primary_skills"))
            cand["secondary_skills"] = self._parse_skill_list(cand.get("secondary_skills"))
            cand["structured_skills"] = [{"name": s, "level": "intermediate"} for s in cand["primary_skills"]] + [{"name": s, "level": "beginner"} for s in cand["secondary_skills"]]
            cand["skills"] = cand["primary_skills"] + cand["secondary_skills"]
            
            if role_id is not None:
                flat_skills = cand["structured_skills"]
                fit = calculate_role_fit(
                    flat_skills,
                    req_skills,
                    exp_years=int(cand.get("total_experience_years") or 0),
                    min_exp=role_min_exp
                )
                cand["fit_score"] = fit["score"]
                cand["ats_detail"] = fit
            else:
                cand["fit_score"] = compute_resume_ats_score(cand)

        if sort_by == "fit_score":
            candidates.sort(key=lambda c: c.get("fit_score", 0), reverse=True)

        return candidates, total_count

    def get_active_candidates(self) -> List[Dict[str, Any]]:
        rows = self.repo.get_active_candidates()
        
        # Dynamically calculate fit score if missing or 0, just like directory search does
        for row in rows:
            role_id = row.get("job_role_id")
            if role_id and (not row.get("insights") or not row["insights"].get("final_score")):
                try:
                    primary = self._parse_skill_list(row.get("primary_skills"))
                    secondary = self._parse_skill_list(row.get("secondary_skills"))
                    flat_skills = [{"name": s, "level": "intermediate"} for s in primary] + [{"name": s, "level": "beginner"} for s in secondary]
                    
                    from backend.modules.source.repositories.job_role_repo import JobRoleRepository
                    from backend.modules.source.services.ats_engine import normalise_required_skills, calculate_role_fit
                    
                    role_repo = JobRoleRepository(tenant_id=self.tenant_id)
                    role = role_repo.get_job_role_by_id(role_id)
                    
                    if role:
                        req_skills = normalise_required_skills(
                            role.get("required_skills"),
                            title=role.get("title") or "",
                            description=role.get("description") or ""
                        )
                        role_min_exp = role.get("min_experience") or 0
                        
                        fit = calculate_role_fit(
                            flat_skills,
                            req_skills,
                            exp_years=int(row.get("total_experience_years") or 0),
                            min_exp=role_min_exp
                        )
                        if "insights" not in row:
                            row["insights"] = {}
                        row["insights"]["final_score"] = fit["score"]
                except Exception as e:
                    logger.error(f"Failed to dynamically calculate fit score for candidate {row['id']}: {e}")
                    
        return rows

    def get_full_candidate_profile(self, candidate_id: int, role_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        cand = self.repo.get_candidate_by_id(candidate_id, role_id=role_id)
        if not cand:
            return None
            
        cand["primary_skills"] = self._parse_skill_list(cand.get("primary_skills"))
        cand["secondary_skills"] = self._parse_skill_list(cand.get("secondary_skills"))
        cand["structured_skills"] = [{"name": s, "level": "intermediate"} for s in cand["primary_skills"]] + [{"name": s, "level": "beginner"} for s in cand["secondary_skills"]]
        cand["skills"] = cand["primary_skills"] + cand["secondary_skills"]
        cand["latest_offer"] = self.repo.get_candidate_latest_offer(candidate_id)
        cand["resume_ats_score"] = compute_resume_ats_score(cand)

        if role_id:
            from backend.modules.source.repositories.job_role_repo import JobRoleRepository
            role_repo = JobRoleRepository(tenant_id=self.tenant_id)
            role = role_repo.get_job_role_by_id(role_id)
            if role:
                req_skills = normalise_required_skills(
                    role.get("required_skills"),
                    title=role.get("title") or "",
                    description=role.get("description") or ""
                )
                flat_skills = cand["structured_skills"]
                cand["role_fit"] = calculate_role_fit(
                    flat_skills,
                    req_skills,
                    exp_years=int(cand.get("total_experience_years") or 0),
                    min_exp=role.get("min_experience") or 0
                )
        return cand

    def update_candidate(self, candidate_id: int, data: Dict[str, Any], actor_name: str = "System") -> bool:
        # 1. Update candidate record in DB
        success = self.repo.update_candidate(candidate_id, data)
        if not success:
            return False

        self.repo.log_activity(candidate_id, actor_name, 'profile_updated', 'Profile details manually updated')
        return True

    def _sync_process_files(self, job_id: int, files_data: List[tuple], job_dir: str, temp_dir: str = None):
        """Heavy I/O and CPU bound file extraction and hashing runs synchronously in a background thread."""
        allowed_exts = (".pdf", ".docx", ".doc", ".txt")
        import zipfile
        import shutil
        import hashlib
        import os
        import uuid
        import logging
        logger = logging.getLogger(__name__)

        self.repo.update_bulk_upload_job(job_id, 0, "[]", "extracting")

        queue_items = []
        total_files = 0
        BATCH_SIZE = 50
        has_flushed_once = False

        def flush_batch():
            nonlocal queue_items, has_flushed_once, total_files
            if not queue_items and has_flushed_once:
                return

            if queue_items:
                self.repo.create_bulk_upload_job_items(job_id, queue_items)
            
            status_to_set = "processing" if not has_flushed_once else None
            has_flushed_once = True

            from backend.core.database import get_db_connection
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    self.repo._set_search_path(cur)
                    if status_to_set:
                        cur.execute("UPDATE bulk_upload_jobs SET total_files = %s, status = %s WHERE id = %s", (total_files, status_to_set, job_id))
                    else:
                        cur.execute("UPDATE bulk_upload_jobs SET total_files = %s WHERE id = %s", (total_files, job_id))
                    conn.commit()
            finally:
                conn.close()
            
            queue_items.clear()
            
            # Yield the GIL so the FastAPI event loop thread has a chance to send the HTTP response
            # to the frontend. Without this, a tight unzipping loop can starve the event loop.
            import time
            time.sleep(0.01)

        for fn, file_path_source in files_data:
            if fn.lower().endswith(".zip"):
                try:
                    with zipfile.ZipFile(file_path_source) as z:
                        for name in z.namelist():
                            if name.endswith("/") or name.split("/")[-1].startswith(".") or "__MACOSX" in name:
                                continue
                            if not name.lower().endswith(allowed_exts):
                                continue

                            clean_fn = name.split("/")[-1]
                            file_path = os.path.join(job_dir, f"{uuid.uuid4()}_{clean_fn}")
                            
                            # Stream from zip to disk AND calculate hash simultaneously to avoid reading back from EFS
                            hasher = hashlib.sha256()
                            with z.open(name) as source, open(file_path, "wb") as target:
                                while True:
                                    chunk = source.read(8192)
                                    if not chunk:
                                        break
                                    target.write(chunk)
                                    hasher.update(chunk)
                            file_hash = hasher.hexdigest()

                            queue_items.append({
                                "filename": clean_fn,
                                "file_path": file_path,
                                "file_hash": file_hash,
                                "extracted_text": "", # Deferred to parallel workers
                            })
                            total_files += 1

                            if len(queue_items) >= BATCH_SIZE:
                                flush_batch()

                except Exception as zip_err:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to extract zip file {fn}: {zip_err}")
            else:
                if not fn.lower().endswith(allowed_exts):
                    continue
                clean_fn = fn.split("/")[-1]
                file_path = os.path.join(job_dir, f"{uuid.uuid4()}_{clean_fn}")
                
                hasher = hashlib.sha256()
                with open(file_path_source, "rb") as source, open(file_path, "wb") as target:
                    while True:
                        chunk = source.read(8192)
                        if not chunk:
                            break
                        target.write(chunk)
                        hasher.update(chunk)
                file_hash = hasher.hexdigest()

                queue_items.append({
                    "filename": clean_fn,
                    "file_path": file_path,
                    "file_hash": file_hash,
                    "extracted_text": "", # Deferred to parallel workers
                })
                total_files += 1

                if len(queue_items) >= BATCH_SIZE:
                    flush_batch()
                
        # Flush any remaining items at the end
        flush_batch()

        # Cleanup temporary directory created by API endpoint
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

        # Safety catch-all to ensure job is marked processing even if there were 0 files
        from backend.core.database import get_db_connection
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                self.repo._set_search_path(cur)
                cur.execute("UPDATE bulk_upload_jobs SET status = 'processing' WHERE id = %s AND status = 'extracting'", (job_id,))
                conn.commit()
        finally:
            conn.close()

    async def bulk_upload_resumes(self, files: List[tuple], user_id: int, temp_dir: str = None) -> Dict[str, Any]:
        """files is a list of tuples: (filename, file_path_source).
        Phase 1: Spin up background thread to extract text immediately at upload time, save to disk, batch-insert queue items.
        Phase 2: parallel workers pick up items and call AI asynchronously.
        
        IMPORTANT: We use a DEDICATED ThreadPoolExecutor (not the shared default pool) for the
        extraction task. The shared pool (asyncio default) can be fully consumed by the 8 AI parse
        workers' run_in_executor calls. If extraction queues into the same pool, it will block
        indefinitely - preventing the HTTP response from returning and the UI from spawning.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        job_id = self.repo.create_bulk_upload_job(user_id, 0)
        job_dir = os.path.join(self.UPLOAD_DIR, f"job_{job_id}")
        os.makedirs(job_dir, exist_ok=True)

        loop = asyncio.get_running_loop()
        # Use a dedicated 1-thread executor so extraction is NEVER blocked by AI workers
        # occupying all slots of the shared default pool.
        extraction_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"extraction_job_{job_id}")
        loop.run_in_executor(
            extraction_executor,
            self._sync_process_files,
            job_id,
            files,
            job_dir,
            temp_dir
        )
        # Detach the executor - it will self-destruct once the thread finishes
        extraction_executor.shutdown(wait=False)

        return {
            "job_id": job_id,
            "status": "processing",
            "message": "Upload accepted. Files are being unpacked and queued."
        }

    async def process_bulk_upload_queue(self):
        """
        Parallel worker pool for AI resume parsing.

        - Spawns BULK_PARSE_WORKERS (default 8) independent async workers.
        - Each worker fetches ONE item at a time via SKIP LOCKED (no contention).
        - AI call runs in a thread executor (sync Groq/Gemini SDK, never blocks event loop).
        - 429 / 503 errors pause only that single worker; others keep running.
        - Cancel events per job allow instant stop without DB polling overhead.
        """
        import asyncio
        import re

        num_workers = int(os.getenv("BULK_PARSE_WORKERS", "8"))
        logger.info(f"[BulkWorker] Starting {num_workers} parallel AI parse workers for tenant {self.tenant_id}")

        # Per-job cancel registry: job_id -> asyncio.Event
        cancel_events: Dict[int, asyncio.Event] = {}

        def _get_cancel_event(job_id: int) -> asyncio.Event:
            if job_id not in cancel_events:
                cancel_events[job_id] = asyncio.Event()
            return cancel_events[job_id]

        async def _single_worker(worker_id: int):
            """One independent worker loop — fetches and processes items in batches of 50."""
            backoff = 0  # seconds to sleep before next attempt (per-worker)
            loop = asyncio.get_event_loop()
            from backend.core.database import get_db_connection

            while True:
                try:
                    if backoff > 0:
                        logger.info(f"[Worker-{worker_id}] API backoff: sleeping {backoff}s")
                        await asyncio.sleep(backoff)
                        backoff = 0

                    # Fetch up to 50 pending items (SKIP LOCKED)
                    items = self.repo.get_pending_bulk_upload_job_items(limit=50)
                    if not items:
                        await asyncio.sleep(5)
                        continue

                    print(f"[Worker-{worker_id}][{self.tenant_id}] Picked up batch of {len(items)} items", flush=True)

                    # Get a connection and cursor for this batch to execute everything in one transaction
                    conn = get_db_connection()
                    try:
                        with conn.cursor() as cur:
                            # Chunk items into sub-batches of 25 for AI prompting to prevent API timeouts
                            # (Fetches 50 from queue, sends to AI in 2 chunks of 25)
                            for i in range(0, len(items), 25):
                                sub_batch = items[i:i+25]
                                
                                # Check if job is paused or cancelled (so we don't keep parsing in-memory items)
                                if sub_batch and sub_batch[0].get("job_id"):
                                    cur.execute("SELECT status FROM bulk_upload_jobs WHERE id = %s", (sub_batch[0]["job_id"],))
                                    job_row = cur.fetchone()
                                    if job_row and job_row[0] in ('paused', 'cancelled'):
                                        status_to_set = 'pending' if job_row[0] == 'paused' else 'cancelled'
                                        print(f"[Worker-{worker_id}][{self.tenant_id}] Job {job_row[0]}. Returning {len(items)-i} items to {status_to_set}.", flush=True)
                                        for item in items[i:]:
                                            self.repo.update_bulk_upload_job_item(item["id"], status=status_to_set, error_message=None, conn=conn, cur=cur)
                                        conn.commit()
                                        break
                                
                                # Prepare batched items
                                batched_payloads = []
                                valid_items = []
                                
                                for item in sub_batch:
                                    job_id = item.get("job_id")
                                    
                                    # Check for job cancellation
                                    if job_id and _get_cancel_event(job_id).is_set():
                                        self.repo.update_bulk_upload_job_item(
                                            item["id"], status="cancelled", error_message="Job was cancelled.", conn=conn, cur=cur
                                        )
                                        continue

                                    cur.execute("SAVEPOINT check_item")
                                    # 1. Duplicate hash check
                                    if self.repo.check_file_hash_exists(item["file_hash"]):
                                        self.repo.update_bulk_upload_job_item(
                                            item["id"], status="duplicate", error_message="Exact file already uploaded before.", conn=conn, cur=cur
                                        )
                                        print(f"[Worker-{worker_id}][{self.tenant_id}] SKIPPED item {item['id']} ({item['filename']}): Duplicate file hash.", flush=True)
                                        cur.execute("RELEASE SAVEPOINT check_item")
                                        
                                        # Cleanup duplicated file
                                        if item.get("file_path") and os.path.exists(item["file_path"]):
                                            try: os.remove(item["file_path"])
                                            except Exception: pass
                                        continue
                                    cur.execute("RELEASE SAVEPOINT check_item")
                                    
                                    # 2. Extract text
                                    extracted_text = item.get("extracted_text") or ""
                                    if not extracted_text and item.get("file_path") and os.path.exists(item["file_path"]):
                                        ext = os.path.splitext(item["filename"])[1].lower()
                                        extracted_text = await loop.run_in_executor(
                                            None, self._extract_text, item["file_path"], ext
                                        )

                                    if not extracted_text.strip():
                                        self.repo.update_bulk_upload_job_item(
                                            item["id"], status="failed", error_message="Could not extract text from file.", conn=conn, cur=cur
                                        )
                                        continue
                                        
                                    from backend.common.services.ai.agents import PARSE_RESUME_SYSTEM
                                    ai_service = self.ai_agents.ai
                                    pre = ai_service.pre_extract_resume(extracted_text)
                                    
                                    # Use a clear prefix "item_" to ensure valid JSON keys and easier LLM parsing
                                    item_id_str = f"item_{item['id']}"
                                    
                                    batched_payloads.append({
                                        "id": item_id_str,
                                        "text": extracted_text,
                                        "pre": pre
                                    })
                                    valid_items.append((item, pre, item_id_str))
                                    
                                if not batched_payloads:
                                    conn.commit()
                                    continue
                                    
                                # 3. Call AI with batched prompt
                                try:
                                    prompt = ai_service.build_batched_prompt(batched_payloads)
                                    
                                    ai_result_map = await asyncio.wait_for(
                                        loop.run_in_executor(
                                            None,
                                            lambda p=prompt: ai_service.generate_json_sync(p, PARSE_RESUME_SYSTEM)
                                        ),
                                        timeout=900.0 # high timeout (15 mins) because 8 workers queueing on a single free tier semaphore can take minutes
                                    )
                                    
                                    if not isinstance(ai_result_map, dict):
                                        raise ValueError(f"AI did not return a valid dictionary. Got type {type(ai_result_map)}")
                                        
                                except Exception as e:
                                    err_str = str(e) or e.__class__.__name__
                                    # Handle Rate limit
                                    if any(err in err_str for err in ['413', '429', 'RESOURCE_EXHAUSTED', '503', 'UNAVAILABLE', 'rate_limit', 'timed out', 'nodename nor servname', 'ConnectionError', 'Timeout', 'TimeoutError', 'RemoteDisconnected', 'aborted', 'closed connection']):
                                        match = re.search(r'(?:retry in|try again in) (\d+\.?\d*)', err_str)
                                        wait = int(float(match.group(1))) + 2 if match else 35
                                        print(f"[Worker-{worker_id}][{self.tenant_id}] API busy, backing off {wait}s...", flush=True)
                                        backoff = wait
                                        # Return all remaining items in the overall batch to pending so they aren't stuck in processing!
                                        for item in items[i:]:
                                            self.repo.update_bulk_upload_job_item(item["id"], status="pending", error_message=None, conn=conn, cur=cur)
                                        break  # Break out of the batch loop entirely
                                    else:
                                        print(f"[Worker-{worker_id}][{self.tenant_id}] ERROR on AI batch prompt: {err_str[:300]}", flush=True)
                                        for item, _, _ in valid_items:
                                            self.repo.update_bulk_upload_job_item(item["id"], status="failed", error_message=err_str[:500], conn=conn, cur=cur)
                                        continue # move to next sub-batch

                                # 4. Process each returned item in the batch
                                for item, pre, item_id_str in valid_items:
                                    ai_result = ai_result_map.get(item_id_str)
                                    
                                    cur.execute("SAVEPOINT item_insert")
                                    try:
                                        if not ai_result or not isinstance(ai_result, dict) or (not ai_result.get("n") and not ai_result.get("exp") and not ai_result.get("p_sk")):
                                            print(f"[Worker-{worker_id}][{self.tenant_id}] ERROR on item {item['id']}: AI omitted or returned empty parse result.", flush=True)
                                            self.repo.update_bulk_upload_job_item(
                                                item["id"], status="failed", error_message="AI omitted or returned empty parse result.", conn=conn, cur=cur
                                            )
                                            cur.execute("RELEASE SAVEPOINT item_insert")
                                            continue
                                            
                                        # Post-inject pre-extracted fields if the LLM skipped them
                                        for field, value in pre.items():
                                            if value:
                                                mapping = {"email": "e", "phone": "p", "linkedin_url": "ln", "portfolio_url": "pt", "experience_years_total": "x"}
                                                short_key = mapping.get(field)
                                                if short_key and not ai_result.get(short_key):
                                                    ai_result[short_key] = value

                                        # Fallback name
                                        if not ai_result.get("n") and item.get("filename"):
                                            inferred_name = self._extract_name_from_filename(item["filename"])
                                            if inferred_name:
                                                ai_result["n"] = inferred_name

                                        file_content = b""
                                        if item.get("file_path") and os.path.exists(item["file_path"]):
                                            with open(item["file_path"], "rb") as f:
                                                file_content = f.read()

                                        result = await self._save_ai_parsed_candidate(ai_result, item["file_path"], file_content, conn=conn, cur=cur)
                                        self.repo.update_bulk_upload_job_item(
                                            item["id"], status="success", candidate_id=result["candidate_id"], conn=conn, cur=cur
                                        )
                                        print(f"[Worker-{worker_id}][{self.tenant_id}] SUCCESS item {item['id']} → candidate {result['candidate_id']}", flush=True)
                                        cur.execute("RELEASE SAVEPOINT item_insert")
                                        
                                        # Cleanup successfully processed file
                                        if item.get("file_path") and os.path.exists(item["file_path"]):
                                            try: os.remove(item["file_path"])
                                            except Exception: pass
                                            
                                    except Exception as e:
                                        cur.execute("ROLLBACK TO SAVEPOINT item_insert")
                                        err_str = str(e) or e.__class__.__name__
                                        print(f"[Worker-{worker_id}][{self.tenant_id}] ERROR saving item {item['id']}: {err_str[:300]}", flush=True)
                                        self.repo.update_bulk_upload_job_item(
                                            item["id"], status="failed", error_message=err_str[:500], conn=conn, cur=cur
                                        )
                                        
                                        # Cleanup failed file to save disk space
                                        if item.get("file_path") and os.path.exists(item["file_path"]):
                                            try: os.remove(item["file_path"])
                                            except Exception: pass

                                # Commit all processed items in this sub-batch instantly so the frontend UI can see them!
                                conn.commit()
                    finally:
                        conn.close()

                except Exception as outer_e:
                    outer_err_str = str(outer_e) or outer_e.__class__.__name__
                    ai_service = getattr(self.ai_agents, 'ai', None)
                    if ai_service:
                        for key in [getattr(ai_service, 'openai_api_key', None), getattr(ai_service, 'gemini_api_key', None), getattr(ai_service, 'groq_api_key', None)]:
                            if key and len(key) > 5 and key in outer_err_str:
                                outer_err_str = outer_err_str.replace(key, "******")
                    print(f"[Worker-{worker_id}][{self.tenant_id}] Outer loop error: {outer_err_str}", flush=True)
                    await asyncio.sleep(15)
        # Reset any stuck processing items on startup
        try:
            self.repo.reset_stuck_processing_items()
            self.repo.reset_stuck_extracting_jobs()
            logger.info(f"[BulkWorker][{self.tenant_id}] Cleaned up and reset stuck processing items and extracting jobs.")
        except Exception as e:
            logger.error(f"[BulkWorker][{self.tenant_id}] Error resetting stuck jobs: {e}")

        # Launch all workers as concurrent tasks
        await asyncio.gather(*[_single_worker(i) for i in range(num_workers)])

    async def _save_ai_parsed_candidate(self, ai_result: Dict[str, Any], file_path: str, file_content: bytes, conn=None, cur=None) -> Dict[str, Any]:
        """Save AI-parsed resume data to the database. Extracted from process_and_save_resume for reuse by bulk workers."""
        import uuid
        email = ai_result.get("e") or ai_result.get("email")
        if not email:
            email = f"unknown_{uuid.uuid4().hex[:8]}@phygitron.local"

        name = ai_result.get("n") or ai_result.get("name")

        # Extract primary / secondary skills from AI result or fallback to splitting skills
        primary_skills = ai_result.get("p_sk") or ai_result.get("primary_skills") or []
        secondary_skills = ai_result.get("s_sk") or ai_result.get("secondary_skills") or []
        if not primary_skills and ai_result.get("skills"):
            skills_raw = ai_result.get("skills") or []
            if isinstance(skills_raw, list):
                primary_skills = [s.get("name") if isinstance(s, dict) else str(s) for s in skills_raw]
            elif isinstance(skills_raw, str):
                primary_skills = [s.strip() for s in skills_raw.split(",")]
            else:
                primary_skills = []

        # Map experience from restructured format
        raw_experience = ai_result.get("exp") or ai_result.get("experience") or []
        if not isinstance(raw_experience, list):
            raw_experience = []
            
        experience = []
        for exp in raw_experience:
            if isinstance(exp, dict):
                experience.append({
                    "company": exp.get("c") or exp.get("company", ""),
                    "designation": exp.get("r") or exp.get("designation") or exp.get("role", ""),
                    "start_date": exp.get("s") or exp.get("start_date", ""),
                    "end_date": exp.get("e") or exp.get("end_date", ""),
                    "is_current": exp.get("is_current") or (exp.get("e") == "Present" or exp.get("end_date") == "Present"),
                    "description": exp.get("description", "")
                })
            else:
                experience.append(exp)

        # Map education from restructured format
        raw_education = ai_result.get("edu") or ai_result.get("education") or []
        if not isinstance(raw_education, list):
            raw_education = []
            
        education = []
        for edu in raw_education:
            if isinstance(edu, dict):
                education.append({
                    "degree": edu.get("d") or edu.get("degree", ""),
                    "institution": edu.get("c") or edu.get("institution") or edu.get("college", ""),
                    "start_date": edu.get("s") or edu.get("start_date", ""),
                    "end_date": edu.get("e") or edu.get("end_date", ""),
                    "field_of_study": edu.get("field_of_study", "")
                })
            else:
                education.append(edu)

        # Map certifications from restructured format
        raw_certifications = ai_result.get("cert") or ai_result.get("certifications") or []
        if not isinstance(raw_certifications, list):
            raw_certifications = []
            
        certifications = []
        for cert in raw_certifications:
            if isinstance(cert, dict):
                certifications.append({
                    "name": cert.get("n") or cert.get("name", ""),
                    "issuer": cert.get("i") or cert.get("issuer", ""),
                    "year": int(cert.get("y") or cert.get("year") or 0)
                })
            else:
                certifications.append(cert)

        from backend.common.services.storage_service import save_file_content
        import os
        
        # We need the file content to save it
        actual_content = file_content
        if not actual_content and file_path and os.path.exists(file_path):
            with open(file_path, "rb") as f:
                actual_content = f.read()
                
        final_path = file_path
        if actual_content:
            ext = os.path.splitext(file_path)[1].lower() if file_path else ".bin"
            filename = f"{uuid.uuid4()}{ext}"
            saved_path = save_file_content(
                content=actual_content,
                filename=filename,
                content_type="application/octet-stream",
                tenant_id=self.tenant_id,
                module_name="source",
                data_type="resumes"
            )
            if not saved_path:
                raise Exception("Failed to write resume file to persistent storage (Local or S3)")
            final_path = saved_path

        candidate_data = {
            "full_name": name or "Unknown Candidate",
            "email": email,
            "phone": ai_result.get("p") or ai_result.get("phone"),
            "location": ai_result.get("l") or ai_result.get("location"),
            "total_experience_years": ai_result.get("x") or ai_result.get("experience_years_total") or 0,
            "current_designation": ai_result.get("d") or ai_result.get("current_designation"),
            "linkedin_url": ai_result.get("ln") or ai_result.get("linkedin_url"),
            "portfolio_url": ai_result.get("pt") or ai_result.get("portfolio_url"),
            "ai_summary": ai_result.get("s") or ai_result.get("ai_summary"),
            "certifications": certifications,
            "resume_path": final_path,
            "source": "AI Resume Parse",
            "status": "New",
            "primary_skills": primary_skills,
            "secondary_skills": secondary_skills,
            "experience": experience,
            "education": education
        }

        existing = None
        if "unknown_" not in candidate_data["email"]:
            existing = self.repo.get_candidate_by_email(candidate_data["email"], conn=conn, cur=cur)

        if existing:
            candidate_id = existing["id"]
            self.repo.update_candidate(candidate_id, candidate_data, conn=conn, cur=cur)
            self.repo.log_activity(candidate_id, 'System', 'profile_updated', 'Profile updated via bulk resume re-upload', conn=conn, cur=cur)
        else:
            candidate_id = self.repo.create_candidate(candidate_data, conn=conn, cur=cur)
            self.repo.log_activity(candidate_id, 'System', 'profile_created', 'Profile created and parsed via AI', conn=conn, cur=cur)
            # Fire background task to score new candidate against ALL active job roles
            try:
                import os
                from backend.modules.source.services.ats_tasks import score_new_candidate_for_all_roles, _run_score_new_candidate_for_all_roles
                
                redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
                if "localhost" in redis_url:
                    import asyncio
                    # Run purely in background thread to avoid 10s Celery/Redis connection timeout
                    asyncio.get_running_loop().run_in_executor(
                        None, _run_score_new_candidate_for_all_roles, candidate_id, self.tenant_id
                    )
                else:
                    score_new_candidate_for_all_roles.delay(candidate_id, self.tenant_id)
            except Exception as _ats_err:
                logger.warning(f"[ATS] Failed to queue scoring for new candidate {candidate_id}: {_ats_err}")

        # Store confidence signals
        confidence_signals = ai_result.get("cs") or ai_result.get("confidence_signals", [])
        if confidence_signals:
            self.ai_score_repo.create_ai_score({
                "entity_type": "candidate",
                "entity_id": candidate_id,
                "job_role_id": None,
                "score_type": "confidence_signals",
                "score": 0,
                "reasoning": json.dumps(confidence_signals),
            }, conn=conn, cur=cur)

        return {"candidate_id": candidate_id, "parsed_data": ai_result}




    async def generate_offer_preview(self, candidate_id: int, details: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        cand = self.repo.get_candidate_by_id(candidate_id)
        if not cand:
            return None
            
        try:
            content = await self.ai_agents.generate_offer_letter(cand["full_name"], details)
            return content
        except Exception as e:
            logger.error(f"AI offer letter generation failed: {e}")
            return {
                "subject": f"Offer for {details.get('role_title')}",
                "salutation": f"Dear {cand['full_name']},",
                "body_paragraphs": [
                    f"We are pleased to offer you the position of {details.get('role_title')}.",
                    f"Offered salary: {details.get('salary')}."
                ],
                "closing": "Sincerely,",
                "signatory_name": "HR Operations Team",
                "signatory_title": "Manager - Talent Acquisition"
            }

    async def convert_to_offer(self, candidate_id: int, details: Dict[str, Any], offer_content: Optional[Dict[str, Any]] = None) -> bool:
        cand = self.repo.get_candidate_by_id(candidate_id)
        if not cand:
            raise ValueError("Candidate not found")
            
        if not offer_content:
            try:
                offer_content = await self.ai_agents.generate_offer_letter(cand["full_name"], details)
            except Exception as e:
                logger.error(f"AI offer generation failed (using fallback): {e}")
                offer_content = {}
                
        # This will be handled properly by OfferService, but for now we put it in CandidateRepo
        self.repo.create_offer(candidate_id, details, offer_content)
        self.repo.update_candidate_status(candidate_id, "Offered")
        return True

    def get_bulk_upload_job_progress(self, job_id: int) -> Dict[str, Any]:
        return self.repo.get_bulk_upload_job_progress(job_id)

    def cancel_bulk_upload_job(self, job_id: int) -> bool:
        self.repo.cancel_bulk_upload_job(job_id)
        import shutil
        import os
        job_dir = os.path.join(self.UPLOAD_DIR, f"job_{job_id}")
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
        return True

    def pause_bulk_upload_job(self, job_id: int) -> bool:
        self.repo.pause_bulk_upload_job(job_id)
        return True

    def resume_bulk_upload_job(self, job_id: int) -> bool:
        return self.repo.resume_bulk_upload_job(job_id)

    def retry_failed_bulk_upload_job(self, job_id: int) -> bool:
        return self.repo.retry_failed_bulk_upload_items(job_id)

    def get_global_activity(self, limit: int = 10) -> List[Dict[str, Any]]:
        return self.repo.get_global_activity(limit=limit)
