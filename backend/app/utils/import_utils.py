import fitz  # PyMuPDF
import docx
import openpyxl
import io
import json
import logging
from typing import List, Dict
from app.agents.agents import call_llm

logger = logging.getLogger(__name__)

async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extracts raw text from PDF, DOCX, or XLSX."""
    text = ""
    extension = filename.split('.')[-1].lower()

    try:
        if extension == 'pdf':
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text()
            doc.close()
        
        elif extension == 'docx':
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        
        elif extension in ['xlsx', 'xls']:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            for sheet in wb.worksheets:
                for row in sheet.iter_rows(values_only=True):
                    text += " | ".join([str(cell) for cell in row if cell is not None]) + "\n"
        
        else:
            # Try plain text if unknown
            text = file_bytes.decode('utf-8', errors='ignore')
            
    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {e}")
        raise ValueError(f"Could not read {extension.upper()} file: {str(e)}")

    return text

async def parse_questions_with_ai(text: str) -> List[Dict]:
    """Uses LLM to parse raw text into structured question objects."""
    
    system_prompt = """
    You are an expert recruitment assistant. Your task is to extract assessment questions from the provided text and return them in a strict JSON format.
    
    Supported Question Types:
    - 'mcq': Multiple choice (must have 'options' and 'correct_answer')
    - 'written': Essay/Written type (no options needed)
    - 'coding': Programming challenge
    - 'file_upload': Instruction to upload a file
    
    Rules:
    1. If the type is not clear, default to 'mcq' if options are present, otherwise 'written'.
    2. 'options' should be a list of strings.
    3. 'correct_answer' should match one of the options exactly.
    4. Provide a 'marks' field (default 5 if not found).
    5. Return ONLY a JSON array of objects.
    
    JSON Schema:
    [
      {
        "question_text": "string",
        "question_type": "mcq|written|coding|file_upload",
        "marks": number,
        "options": ["string", "string", ...],
        "correct_answer": "string",
        "model_answer": "string (optional)",
        "starter_code": "string (optional)",
        "test_cases": [{"input": "string", "expected_output": "string"}] (optional)
      }
    ]
    """
    
    user_prompt = f"EXTRACT ALL QUESTIONS FROM THIS TEXT AND RETURN RAW JSON ARRAY:\n\n{text[:12000]}"
    
    try:
        data = call_llm(system_prompt, user_prompt)
        
        extracted = []
        if isinstance(data, list):
            extracted = data
        elif isinstance(data, dict):
            for key in ['questions', 'results', 'data', 'items']:
                if key in data and isinstance(data[key], list):
                    extracted = data[key]
                    break
            if not extracted and len(data.keys()) == 1:
                val = list(data.values())[0]
                if isinstance(val, list):
                    extracted = val
            if not extracted:
                # Maybe it returned a single question as an object? wrap it.
                extracted = [data]
        
        if not extracted or not isinstance(extracted, list):
            raise ValueError("AI could not find any structured questions in the text.")
            
        # Basic validation of items
        valid_qs = []
        for q in extracted:
            if isinstance(q, dict) and 'question_text' in q:
                # Ensure type is valid
                if q.get('question_type') not in ['mcq', 'written', 'coding', 'file_upload']:
                    q['question_type'] = 'mcq' if 'options' in q else 'written'
                valid_qs.append(q)
                
        if not valid_qs:
            raise ValueError("No valid questions found after AI parsing.")
            
        return valid_qs

    except Exception as e:
        logger.error(f"AI Parsing failed: {e}")
        raise ValueError(f"AI Parsing Error: {str(e)}")
