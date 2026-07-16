import os
import re
import json
import time
import threading
from dotenv import load_dotenv

# Load explicitly from backend/ folder or fallback to root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), '.env')
load_dotenv(dotenv_path=env_path)

# ---------------------------------------------------------------------------
# Global per-provider rate limiters (token bucket, thread-safe)
# Groq free tier: 30 RPM → we cap at 28 to stay safe
# Gemini free tier: 15 RPM → we cap at 13 to stay safe
# ---------------------------------------------------------------------------

class _TokenBucketLimiter:
    """Thread-safe token bucket rate limiter used across all workers."""
    def __init__(self, rpm: int, burst: float = 1.0):
        self._capacity = burst  # Strict spacing by default to prevent TPM bursts
        self._tokens = burst
        self._refill_rate = rpm / 60.0   # tokens per second
        self._lock = threading.Lock()
        self._last_refill = time.monotonic()

    def acquire(self, block: bool = True) -> bool:
        """Consume one token. Blocks until a token is available if block=True."""
        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self._last_refill
                self._tokens = min(self._capacity, self._tokens + elapsed * self._refill_rate)
                self._last_refill = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return True
            if not block:
                return False
            time.sleep(0.5)   # wait half a second then re-check


_GROQ_LIMITER   = _TokenBucketLimiter(rpm=int(os.getenv("GROQ_RPM_LIMIT", "28")))
_GEMINI_LIMITER = _TokenBucketLimiter(rpm=int(os.getenv("GEMINI_RPM_LIMIT", "13")))

# Free tiers strictly prohibit concurrent requests per key.
_gemini_keys = []
multi = os.getenv("GEMINI_API_KEYS", "")
if multi: _gemini_keys = [k.strip() for k in multi.split(",") if k.strip()]
if not _gemini_keys:
    single = os.getenv("GOOGLE_API_KEY", "")
    if single.strip(): _gemini_keys = [single.strip()]

_GEMINI_CONCURRENCY = threading.Semaphore(max(len(_gemini_keys), 1))


# ---------------------------------------------------------------------------
# Key rotation helper
# ---------------------------------------------------------------------------

class _KeyPool:
    """Round-robin key pool. On 429, rotates to the next key."""
    def __init__(self, keys: list[str]):
        self._keys = [k.strip() for k in keys if k.strip()]
        self._idx = 0
        self._lock = threading.Lock()

    def current(self) -> str | None:
        if not self._keys:
            return None
        return self._keys[self._idx % len(self._keys)]

    def rotate(self):
        with self._lock:
            self._idx = (self._idx + 1) % max(len(self._keys), 1)

    def __bool__(self):
        return bool(self._keys)


def _parse_key_list(env_var: str, single_var: str) -> list[str]:
    """Support both GROQ_API_KEYS=k1,k2 (multi) and GROQ_API_KEY=k1 (single)."""
    multi = os.getenv(env_var, "")
    keys = [k.strip() for k in multi.split(",") if k.strip()]
    if not keys:
        single = os.getenv(single_var, "")
        if single.strip():
            keys = [single.strip()]
    return keys


# ---------------------------------------------------------------------------
# Lightweight regex pre-extractor
# Pulls trivial fields from raw text before sending to LLM.
# This lets us shrink the LLM JSON schema and save tokens.
# ---------------------------------------------------------------------------

def _pre_extract(text: str) -> dict:
    """Extract easy fields locally so the LLM focuses on hard ones only."""
    out = {}
    # Email
    m = re.search(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', text)
    if m:
        out["email"] = m.group(0).lower()

    # Phone — handles +91 9876543210, (123) 456-7890, 123-456-7890, etc.
    m = re.search(
        r'(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4,5}',
        text
    )
    if m:
        candidate = re.sub(r'[^\d+]', '', m.group(0))
        if 8 <= len(candidate) <= 15:
            out["phone"] = m.group(0).strip()

    # LinkedIn
    m = re.search(r'linkedin\.com/in/[\w\-]+', text, re.I)
    if m:
        out["linkedin_url"] = "https://" + m.group(0)

    # GitHub
    m = re.search(r'github\.com/[\w\-]+', text, re.I)
    if m:
        out["github_url"] = "https://" + m.group(0)

    # Portfolio / personal website (not linkedin/github)
    m = re.search(
        r'https?://(?!(?:www\.)?(?:linkedin|github|twitter|facebook|instagram))[\w\-]+\.[\w.\-/]+',
        text, re.I
    )
    if m:
        out["portfolio_url"] = m.group(0).rstrip("/.,")

    # Total years of experience (enhanced to handle years/months and total experience labels)
    experience_years = 0.0
    
    # Pattern 1: X Years Y Months
    m_ym = re.search(r'(\d+)\s*years?\s*(?:and\s+)?(\d+)\s*months?', text, re.I)
    if m_ym:
        try:
            years = float(m_ym.group(1))
            months = float(m_ym.group(2))
            experience_years = round(years + months / 12.0, 1)
        except ValueError:
            pass
            
    # Pattern 2: Total Experience: X Years / X.Y Years
    if experience_years == 0.0:
        m_tot = re.search(r'(?:total\s+)?experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*years?', text, re.I)
        if m_tot:
            try:
                experience_years = round(float(m_tot.group(1)), 1)
            except ValueError:
                pass
                
    # Pattern 3: X+ Years Exp
    if experience_years == 0.0:
        m_exp = re.search(r'(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|exp)\b', text, re.I)
        if m_exp:
            try:
                experience_years = round(float(m_exp.group(1)), 1)
            except ValueError:
                pass

    out["experience_years_total"] = experience_years
    return out


# ---------------------------------------------------------------------------
# Main AI Service
# ---------------------------------------------------------------------------

class AIService:
    """
    Provider-independent AI service with:
    - Multi-key rotation pools (GROQ_API_KEYS / GEMINI_API_KEYS)
    - Global token-bucket rate limiters per provider
    - Regex pre-extraction to cut LLM token usage
    - Offline rule-based fallback parser
    """

    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "mock").lower()
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        # Defaulting to 3.1-flash-lite as it has a massive 500 RPD and 250k TPM free tier limit
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

        # --- Key pools (support both single and comma-separated multi-key) ---
        self._groq_pool   = _KeyPool(_parse_key_list("GROQ_API_KEYS",   "GROQ_API_KEY"))
        self._gemini_pool = _KeyPool(_parse_key_list("GEMINI_API_KEYS", "GOOGLE_API_KEY"))

        # Backward-compat single-key references used by _sanitize_error
        self.openai_api_key  = os.getenv("OPENAI_API_KEY")
        self.groq_api_key    = self._groq_pool.current()
        self.gemini_api_key  = self._gemini_pool.current()

        # Gemini SDK client (uses current key, re-created on rotation)
        self._gemini_client_cache: dict = {}
        self._gemini_client_lock = threading.Lock()

        # OpenAI async client
        if self.openai_api_key:
            try:
                from openai import AsyncOpenAI
                self.openai_client = AsyncOpenAI(api_key=self.openai_api_key)
                self.openai_model  = "gpt-4o-mini"
            except Exception:
                self.openai_client = None
        else:
            self.openai_client = None

        # Groq SDK client (kept for async path)
        self.groq_client = None
        if self.groq_api_key:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=self.groq_api_key)
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_gemini_client(self, api_key: str):
        """Return a cached or freshly-created genai.Client for the given key."""
        with self._gemini_client_lock:
            if api_key not in self._gemini_client_cache:
                try:
                    from google import genai
                    self._gemini_client_cache[api_key] = genai.Client(api_key=api_key)
                except Exception:
                    self._gemini_client_cache[api_key] = None
            return self._gemini_client_cache[api_key]

    def _sanitize_error(self, err) -> str:
        err_str = str(err)
        secrets = [
            self.openai_api_key,
            *self._groq_pool._keys,
            *self._gemini_pool._keys,
        ]
        for key in secrets:
            if key and len(key) > 5 and key in err_str:
                err_str = err_str.replace(key, "******")
        return err_str

    @staticmethod
    def _is_rate_limit(err_str: str) -> bool:
        triggers = ['429', 'RESOURCE_EXHAUSTED', 'rate_limit', '503', 'UNAVAILABLE',
                    '413', 'timed out', 'ConnectionError', 'Timeout', 'nodename nor servname']
        return any(t in err_str for t in triggers)

    @staticmethod
    def _compress_text(text: str, max_chars: int = 5000) -> str:
        """Truncate resume text to max_chars, keeping the beginning (most info-dense)."""
        return text[:max_chars]

    @staticmethod
    def _build_compressed_prompt(resume_text: str, pre: dict) -> str:
        """
        Build the user prompt injecting pre-extracted fields so the LLM
        skips them and focuses only on hard-to-parse sections.
        Also truncates to 5000 chars to minimize token cost.
        """
        known = ", ".join(f"{k}={v!r}" for k, v in pre.items() if v)
        hint = f"\n[PRE-EXTRACTED — do NOT re-derive these, just copy them into the JSON]: {known}\n\n" if known else ""
        return f"Parse this resume and return JSON:{hint}\n{resume_text[:5000]}"

    @staticmethod
    def build_batched_prompt(items: list[dict]) -> str:
        """
        Build a batched user prompt for multiple resumes using XML tags.
        items: [{"id": 123, "text": "...", "pre": {...}}, ...]
        """
        parts = ["Parse the following resumes and return a single JSON object mapping ID to parsed data.\n"]
        for item in items:
            known = ", ".join(f"{k}={v!r}" for k, v in item.get("pre", {}).items() if v)
            hint = f"\n[PRE-EXTRACTED]: {known}" if known else ""
            # Truncate to 15000 characters to ensure we capture Education/Certifications at the bottom
            text = item.get("text", "")[:15000]
            parts.append(f'<resume id="{item["id"]}">{hint}\n{text}\n</resume>')
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # ASYNC path (single uploads, scoring, offer letters)
    # ------------------------------------------------------------------

    async def generate_json(self, prompt: str, system_prompt: str = "", provider_override: str = None) -> dict:
        provider = provider_override or self.provider

        if provider == "mock":
            return self._mock_json_response(prompt)

        elif provider == "groq":
            if not self.groq_client:
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")
            _GROQ_LIMITER.acquire()
            try:
                response = self.groq_client.chat.completions.create(
                    model=self.groq_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": prompt},
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                    response_format={"type": "json_object"},
                )
                return json.loads(response.choices[0].message.content.strip())
            except Exception as e:
                print(f"Groq async failed: {self._sanitize_error(e)}. Falling back to Gemini...")
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")

        elif provider == "openai":
            if not self.openai_client:
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")
            try:
                response = await self.openai_client.chat.completions.create(
                    model=self.openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt + "\n\nIMPORTANT: Return ONLY valid JSON."},
                        {"role": "user",   "content": prompt},
                    ],
                    response_format={"type": "json_object"},
                )
                return json.loads(response.choices[0].message.content)
            except Exception as e:
                print(f"OpenAI failed: {self._sanitize_error(e)}. Falling back to Gemini...")
                return await self.generate_json(prompt, system_prompt, provider_override="gemini")

        elif provider == "gemini":
            key = self._gemini_pool.current()
            if not key:
                return self._mock_json_response(prompt)
            _GEMINI_LIMITER.acquire()
            client = self._get_gemini_client(key)
            full_prompt = f"{system_prompt}\n\n{prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown."
            if client:
                try:
                    response = client.models.generate_content(model=self.gemini_model, contents=full_prompt)
                    clean = response.text.replace('```json', '').replace('```', '').strip()
                    return json.loads(clean)
                except Exception as e:
                    err = self._sanitize_error(e)
                    if self._is_rate_limit(err):
                        self._gemini_pool.rotate()
                    print(f"Gemini async failed: {err}")
                    raise RuntimeError(err) from None
            return self._mock_json_response(prompt)
        return {}

    # ------------------------------------------------------------------
    # SYNC path (bulk workers — called inside run_in_executor)
    # ------------------------------------------------------------------

    def generate_json_sync(self, prompt: str, system_prompt: str = "", provider_override: str = None) -> dict:
        """
        Synchronous LLM call for bulk workers.
        Provider resolution: provider_override → BULK_AI_PROVIDER → AI_PROVIDER

        Features:
        - Per-provider token-bucket rate limiting (global, shared across workers)
        - Key rotation and retry loops across the entire key pool on 429
        - Gemini SDK → REST fallback per key, with immediate rotation on 429
        """
        import requests as _req

        provider = provider_override or os.getenv("BULK_AI_PROVIDER", self.provider)

        # ── Groq ─────────────────────────────────────────────────────────────
        if provider == "groq":
            num_keys = len(self._groq_pool._keys)
            for attempt in range(max(num_keys, 1)):
                key = self._groq_pool.current()
                if not key:
                    break

                _GROQ_LIMITER.acquire()   # block until we have capacity
                try:
                    resp = _req.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                        json={
                            "model": self.groq_model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user",   "content": prompt},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 1800,
                            "response_format": {"type": "json_object"},
                        },
                        timeout=40,
                    )
                    resp.raise_for_status()
                    content = resp.json()["choices"][0]["message"]["content"].strip()
                    m = re.search(r'(\{.*\}|\[.*\])', content, re.DOTALL)
                    return json.loads(m.group(1) if m else content)

                except Exception as e:
                    err = self._sanitize_error(e)
                    if self._is_rate_limit(err):
                        print(f"Groq 429 on key[{self._groq_pool._idx}]. Rotating key...")
                        self._groq_pool.rotate()
                        continue
                    else:
                        print(f"Groq error: {err[:80]}. Rotating and falling back to Gemini...")
                        self._groq_pool.rotate()
                        break

            # If all Groq keys failed or we broke out, fall back to Gemini
            print("All Groq keys failed or exhausted. Falling back to Gemini...")
            return self.generate_json_sync(prompt, system_prompt, provider_override="gemini")

        # ── Gemini ───────────────────────────────────────────────────────────
        elif provider == "gemini":
            num_keys = len(self._gemini_pool._keys)
            if num_keys == 0:
                raise RuntimeError("Gemini: no API key available. All AI providers exhausted.")

            last_err = "No attempt made."
            for attempt in range(num_keys):
                key = self._gemini_pool.current()
                if not key:
                    break

                _GEMINI_LIMITER.acquire()   # block until we have capacity

                full_prompt = (
                    f"{system_prompt}\n\n{prompt}\n\n"
                    "IMPORTANT: Return ONLY valid JSON. No markdown, no backticks, no explanation."
                )

                # Acquire the semaphore to prevent concurrent requests on the free tier
                with _GEMINI_CONCURRENCY:
                    # 1. Try SDK first
                    client = self._get_gemini_client(key)
                    if client:
                        try:
                            response = client.models.generate_content(model=self.gemini_model, contents=full_prompt)
                            clean = response.text.replace('```json', '').replace('```', '').strip()
                            return json.loads(clean)
                        except Exception as sdk_err:
                            err = self._sanitize_error(sdk_err)
                            last_err = err
                            if self._is_rate_limit(err):
                                print(f"Gemini SDK 429 on key[{self._gemini_pool._idx}]. Error: {err[:200]}. Rotating key...")
                                self._gemini_pool.rotate()
                                continue
                            else:
                                print(f"Gemini SDK error: {err[:80]}. Trying REST...")

                    # 2. REST fallback (only if SDK failed for non-429 reason or client wasn't created)
                    try:
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent?key={key}"
                        resp = _req.post(url, json={"contents": [{"parts": [{"text": full_prompt}]}]}, timeout=40)
                        resp.raise_for_status()
                        res_json = resp.json()
                        if "candidates" in res_json and res_json["candidates"]:
                            text = res_json["candidates"][0]["content"]["parts"][0]["text"]
                            clean = text.replace('```json', '').replace('```', '').strip()
                            return json.loads(clean)
                        raise RuntimeError(f"Gemini REST unexpected payload: {res_json}")
                    except Exception as e:
                        err = self._sanitize_error(e)
                        last_err = err
                        if self._is_rate_limit(err):
                            print(f"Gemini REST 429. Error: {err[:200]}. Rotating key...")
                            self._gemini_pool.rotate()
                            continue
                        else:
                            print(f"Gemini REST error: {err[:80]}")
                            # Non-rate-limit error on REST fallback: rotate and try next key
                            self._gemini_pool.rotate()
                            continue

            raise RuntimeError(f"All Gemini keys exhausted. Last error: {last_err}")

        elif provider == "openai":
            raise RuntimeError("OpenAI async client cannot be used in sync workers. Set BULK_AI_PROVIDER=groq or gemini.")

        return self._mock_json_response(prompt)

    # ------------------------------------------------------------------
    # Public helpers used by candidate_service
    # ------------------------------------------------------------------

    def pre_extract_resume(self, text: str) -> dict:
        """Extract trivial fields locally. Call this before generate_json_sync."""
        return _pre_extract(text)

    def build_bulk_prompt(self, resume_text: str, pre: dict | None = None) -> str:
        """Build compressed prompt with pre-extracted hints to save tokens."""
        return self._build_compressed_prompt(resume_text, pre or {})

    # ------------------------------------------------------------------
    # Mock
    # ------------------------------------------------------------------

    def _mock_json_response(self, prompt: str) -> dict:
        if "resume" in prompt.lower() or "cv" in prompt.lower():
            return {
                "n": "Jane Doe",
                "e": "jane.doe@example.com",
                "p": "+1 555-0198",
                "l": "San Francisco, CA",
                "d": "Senior React Developer",
                "x": 5.5,
                "ln": "https://linkedin.com/in/janedoe",
                "pt": "https://janedoe.dev",
                "s": "Mock candidate with 5+ years of React experience.",
                "p_sk": ["React", "TypeScript", "JavaScript", "HTML5"],
                "s_sk": ["FastAPI", "Git", "Docker", "AWS"],
                "exp": [
                    {"c": "Tech Innovators Inc.", "r": "Senior React Developer", "s": "2021-01", "e": "Present"}
                ],
                "edu": [
                    {"d": "Bachelors in Computer Science", "c": "State University", "s": "2014-08", "e": "2018-05"}
                ],
                "cert": []
            }
        return {}
