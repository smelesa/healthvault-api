"""PDF text extraction service."""
import os


async def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using pdfminer.six."""
    try:
        from pdfminer.high_level import extract_text
        return extract_text(file_path)
    except Exception as e:
        return f"[PDF extraction error: {e}]"