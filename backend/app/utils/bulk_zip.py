import os
import re
import shutil
import zipfile
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import unquote, urlsplit
from PyPDF2 import PdfReader


VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}
PDF_EXTS = {".pdf"}
TEXT_EXTS = {".txt", ".md"}
SCORM_LAUNCH_EXTS = {".html", ".htm"}
PREFERRED_SCORM_LAUNCH_NAMES = (
    "index_lms.html",
    "index_lms.htm",
    "story.html",
    "story.htm",
    "index.html",
    "index.htm",
)


def extract_text_from_pdf(pdf_path: str) -> str:
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages[:10]: # Cap at 10 pages for analysis
            text += (page.extract_text() or "") + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return ""


def _safe_extract(zip_path: str, extract_path: str) -> None:
    target = Path(extract_path).resolve()
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        for member in zip_ref.infolist():
            destination = (target / member.filename).resolve()
            try:
                destination.relative_to(target)
            except ValueError:
                raise ValueError(f"Unsafe ZIP entry blocked: {member.filename}")
        
        # Check disk space before extraction
        # Heuristic: ZIP size * 3 is usually safe for extraction peak
        zip_size_mb = os.path.getsize(zip_path) / (1024 * 1024)
        from app.utils.disk import get_free_space_mb
        free_mb = get_free_space_mb(str(target.parent))
        if free_mb < zip_size_mb * 2:
            raise OSError(28, f"Not enough disk space to extract ZIP. Required: ~{zip_size_mb*2:.1f}MB, Free: {free_mb:.1f}MB")

        zip_ref.extractall(extract_path)


def _clean_title(value: str) -> str:
    name = os.path.splitext(os.path.basename(value))[0]
    name = re.sub(r"^[\d\W_]+", "", name)
    name = re.sub(r"[_\-]+", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name.title() if name else "Lesson"


def _natural_key(value: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def _rel_url(path: str) -> str:
    return path.replace("\\", "/")


def _normalize_manifest_href(href: Optional[str]) -> Optional[str]:
    if not href:
        return None
    split = urlsplit(href.strip())
    # SCORM exports sometimes include URL encoding or query strings in hrefs.
    # Those parts are useful in the browser but not on the local filesystem.
    path = unquote(split.path).replace("\\", "/").lstrip("/")
    return path or None


def _read_text(path: str, limit: int = 8000) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        return handle.read(limit)


def _detect_content_type(path: str) -> str:
    ext = Path(path).suffix.lower()
    if ext in VIDEO_EXTS:
        return "video"
    if ext in PDF_EXTS:
        return "pdf"
    return "article"


def _find_scorm_manifest(extract_path: str) -> Optional[str]:
    for root, _, files in os.walk(extract_path):
        for file in files:
            if file.lower() == "imsmanifest.xml":
                return os.path.join(root, file)
    return None


def _xml_text(node: Optional[ET.Element], default: str = "") -> str:
    if node is None or node.text is None:
        return default
    return node.text.strip() or default


def _find_child(node: ET.Element, tag_name: str) -> Optional[ET.Element]:
    for child in node:
        if child.tag.split("}")[-1] == tag_name:
            return child
    return None


def _iter_children(node: ET.Element, tag_name: str) -> List[ET.Element]:
    return [child for child in node if child.tag.split("}")[-1] == tag_name]


def _parse_scorm_manifest(manifest_path: str, extract_path: str) -> Optional[Dict]:
    try:
        tree = ET.parse(manifest_path)
        root = tree.getroot()
    except ET.ParseError:
        return None

    manifest_dir = os.path.dirname(manifest_path)
    resources_node = _find_child(root, "resources")
    resources = {}
    if resources_node is not None:
        for res in _iter_children(resources_node, "resource"):
            identifier = res.attrib.get("identifier")
            href = _normalize_manifest_href(res.attrib.get("href"))
            if identifier:
                resources[identifier] = {
                    "href": href,
                    "files": [
                        normalized
                        for f in _iter_children(res, "file")
                        for normalized in [_normalize_manifest_href(f.attrib.get("href"))]
                        if normalized
                    ],
                }

    organizations = _find_child(root, "organizations")
    organization = None
    if organizations is not None:
        default_org = organizations.attrib.get("default")
        orgs = _iter_children(organizations, "organization")
        organization = next((o for o in orgs if o.attrib.get("identifier") == default_org), orgs[0] if orgs else None)

    manifest_title = _xml_text(_find_child(root, "title"), "SCORM Course")
    if organization is not None:
        manifest_title = _xml_text(_find_child(organization, "title"), manifest_title)

    sections = []

    def add_items(parent: ET.Element, depth: int = 0) -> None:
        for item in _iter_children(parent, "item"):
            title = _xml_text(_find_child(item, "title"), "SCORM Lesson")
            identifierref = item.attrib.get("identifierref")
            resource = resources.get(identifierref, {}) if identifierref else {}
            href = resource.get("href")
            if href:
                launch_abs = Path(manifest_dir, href).resolve()
                extract_root = Path(extract_path).resolve()
                try:
                    launch_abs.relative_to(extract_root)
                except (ValueError, AttributeError):
                    continue
                if launch_abs.exists():
                    print(f"Found SCORM section: {title} -> {href}")
                    sections.append({
                        "title": title,
                        "content_type": "article",
                        "content_url": None,
                        "content_markdown": f"Launch the SCORM lesson: {title}",
                        "duration_minutes": 20,
                        "source_path": os.path.relpath(str(launch_abs), extract_path),
                        "package_root": os.path.relpath(manifest_dir, extract_path),
                        "is_scorm": True,
                    })
            add_items(item, depth + 1)

    if organization is not None:
        add_items(organization)

    if not sections:
        launch_candidates = []
        for root_dir, _, files in os.walk(manifest_dir):
            for file in files:
                if Path(file).suffix.lower() in SCORM_LAUNCH_EXTS:
                    launch_candidates.append(os.path.join(root_dir, file))
        def launch_sort_key(path: str):
            name = os.path.basename(path).lower()
            try:
                preferred = PREFERRED_SCORM_LAUNCH_NAMES.index(name)
            except ValueError:
                preferred = len(PREFERRED_SCORM_LAUNCH_NAMES)
            return (preferred, _natural_key(os.path.relpath(path, manifest_dir)))

        for launch_abs in sorted(launch_candidates, key=launch_sort_key)[:8]:
            sections.append({
                "title": _clean_title(launch_abs),
                "content_type": "article",
                "content_url": None,
                "content_markdown": f"Launch the SCORM lesson: {_clean_title(launch_abs)}",
                "duration_minutes": 20,
                "source_path": os.path.relpath(launch_abs, extract_path),
                "package_root": os.path.relpath(manifest_dir, extract_path),
                "is_scorm": True,
            })

    if not sections:
        return None

    return {
        "title": manifest_title,
        "description": "Imported from a SCORM/e-learning package. Lessons were arranged from the SCORM manifest.",
        "estimated_hours": max(1.0, round((len(sections) * 20) / 60, 1)),
        "difficulty": "beginner",
        "category": "Learning",
        "sections": sections[:20],
        "import_summary": {
            "mode": "scorm_manifest",
            "sections_detected": len(sections),
            "manifest": os.path.relpath(manifest_path, extract_path),
        },
    }


def _collect_materials(extract_path: str) -> Dict:
    file_list = []
    text_context = ""

    for root, _, files in os.walk(extract_path):
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, extract_path)
            ext = Path(file).suffix.lower()

            if ext in VIDEO_EXTS:
                file_list.append({"name": _rel_url(rel_path), "type": "video", "source_path": rel_path})
            elif ext in PDF_EXTS:
                file_list.append({"name": _rel_url(rel_path), "type": "pdf", "source_path": rel_path})
                text_context += f"\n--- CONTENT FROM {_rel_url(rel_path)} ---\n{extract_text_from_pdf(file_path)[:4000]}"
            elif ext == ".zip":
                file_list.append({"name": _rel_url(rel_path), "type": "lab", "source_path": rel_path})
            elif ext in TEXT_EXTS:
                file_list.append({"name": _rel_url(rel_path), "type": "article", "source_path": rel_path})
                text_context += f"\n--- CONTENT FROM {_rel_url(rel_path)} ---\n{_read_text(file_path, 4000)}"

    file_list.sort(key=lambda item: _natural_key(item["name"]))
    return {"file_list": file_list, "text_context": text_context}


def _local_plan(zip_path: str, extract_path: str, file_list: List[Dict], text_context: str) -> Dict:
    sections = []
    for idx, item in enumerate(file_list[:20]):
        content_type = item["type"]
        markdown = None
        if content_type == "article":
            markdown = f"# {_clean_title(item['name'])}\n\n"
            source_path = item.get("source_path")
            if source_path:
                try:
                    markdown += _read_text(os.path.join(extract_path, source_path), 6000)
                except Exception:
                    markdown += f"Reference material from uploaded file: {item['name']}"
            else:
                markdown += f"Reference material from uploaded file: {item['name']}"
        elif content_type == "pdf":
            markdown = f"PDF material imported from: {item['name']}"
        else:
            markdown = f"Video lesson imported from: {item['name']}"

        sections.append({
            "title": _clean_title(item["name"]),
            "content_type": content_type,
            "content_url": None,
            "content_markdown": markdown,
            "duration_minutes": 20 if content_type == "video" else 15,
            "source_path": item.get("source_path"),
        })

    if text_context.strip():
        sections.append({
            "title": "Knowledge Check",
            "content_type": "quiz",
            "content_markdown": None,
            "duration_minutes": 10,
            "quizzes": [{
                "question_text": "What should learners do after reviewing the imported materials?",
                "options": ["Skip the lessons", "Apply the concepts in the course context", "Delete the source files", "Ignore assessments"],
                "correct_answer": "Apply the concepts in the course context",
                "explanation": "The course is designed around applying the uploaded learning material.",
                "marks": 1.0,
            }],
        })

    if not sections:
        sections.append({
            "title": "Introduction",
            "content_type": "article",
            "content_markdown": "Welcome to the uploaded course material.",
            "duration_minutes": 10,
        })

    base_title = _clean_title(os.path.basename(zip_path))
    return {
        "title": base_title,
        "description": "Course automatically arranged from uploaded learning materials.",
        "estimated_hours": max(1.0, round(sum(s.get("duration_minutes", 15) for s in sections) / 60, 1)),
        "difficulty": "beginner",
        "category": "Learning",
        "sections": sections,
        "import_summary": {
            "mode": "material_ordering",
            "sections_detected": len(sections),
            "files_detected": len(file_list),
        },
    }


def _merge_ai_plan(ai_plan: Dict, fallback_plan: Dict, source_files: List[Dict]) -> Dict:
    merged_sections = []
    used_sources = set()

    for idx, section in enumerate(ai_plan.get("sections", [])[:12]):
        content_type = section.get("content_type", "article")
        if content_type == "document":
            content_type = "pdf"
        if content_type not in {"video", "pdf", "article", "quiz"}:
            content_type = "article"

        section_text = f"{section.get('title', '')} {section.get('content_markdown', '')}".lower()
        source = None
        for item in source_files:
            if item["name"] in used_sources or item["type"] != content_type:
                continue
            if item["name"].lower() in section_text or _clean_title(item["name"]).lower() in section_text:
                source = item
                break
        if source is None:
            source = next((item for item in source_files if item["name"] not in used_sources and item["type"] == content_type), None)
        if source:
            used_sources.add(source["name"])

        merged = {
            **section,
            "content_type": content_type,
            "source_path": source.get("source_path") if source else section.get("source_path"),
        }
        merged_sections.append(merged)

    if not merged_sections:
        return fallback_plan

    return {
        **fallback_plan,
        **ai_plan,
        "difficulty": ai_plan.get("difficulty") if ai_plan.get("difficulty") in {"beginner", "intermediate", "advanced"} else "beginner",
        "sections": merged_sections,
        "import_summary": {
            **fallback_plan.get("import_summary", {}),
            "mode": "ai_material_architect",
            "sections_detected": len(merged_sections),
        },
    }


def process_bulk_zip(zip_path: str, upload_dir: str) -> Dict:
    """
    Extracts ZIP, analyzes files, and returns a structured course plan.
    """
    extract_id = str(uuid.uuid4())
    extract_path = os.path.join(upload_dir, "temp", extract_id)
    os.makedirs(extract_path, exist_ok=True)
    try:
        _safe_extract(zip_path, extract_path)

        # 1. Detect SCORM and other materials
        manifest_path = _find_scorm_manifest(extract_path)
        scorm_plan = _parse_scorm_manifest(manifest_path, extract_path) if manifest_path else None
        
        materials = _collect_materials(extract_path)
        file_list = materials["file_list"]
        text_context = materials["text_context"]
        
        # If it's a simple SCORM package (1 SCO) but has many internal assets,
        # we'll let the AI Architect decide if it should be broken down.
        if scorm_plan and len(scorm_plan.get("sections", [])) <= 1 and len(file_list) > 3:
            print("Detected single-SCO manifest with multiple internal assets. Calling AI Architect for granular plan.")
        elif scorm_plan:
            # Traditional SCORM course with multiple items in manifest
            return {
                "plan": scorm_plan,
                "extract_path": extract_path,
                "extract_id": extract_id,
            }

        fallback_plan = _local_plan(zip_path, extract_path, file_list, text_context)

        # 2. Call AI Architect
        try:
            from app.agents.agents import run_course_architect_agent
            
            # If we have a SCORM manifest title, use it as context
            if scorm_plan:
                text_context = f"SCORM Package Title: {scorm_plan.get('title')}\n" + text_context

            plan = run_course_architect_agent(text_context, file_list)
            plan = _merge_ai_plan(plan, fallback_plan, file_list)
        except Exception as e:
            print(f"AI Architect failed ({e}). Constructing local fallback plan.")
            plan = fallback_plan
    except Exception:
        shutil.rmtree(extract_path, ignore_errors=True)
        raise
        
    return {
        "plan": plan,
        "extract_path": extract_path,
        "extract_id": extract_id
    }
