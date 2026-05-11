"""OCR service — PaddleOCR for image/scanned document processing."""
import os
from PIL import Image


async def extract_text_from_image(file_path: str) -> str:
    """Extract text from image using PaddleOCR."""
    try:
        from paddleocr import PaddleOCR

        ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
        result = ocr.ocr(file_path, cls=True)

        if not result or not result[0]:
            return ""

        lines = []
        for line in result[0]:
            if line and len(line) >= 2:
                text = line[1][0] if isinstance(line[1], (list, tuple)) else line[1]
                lines.append(str(text))

        return "\n".join(lines)
    except Exception as e:
        # If PaddleOCR fails, fallback to basic tesseract
        return await _fallback_tesseract(file_path)


async def _fallback_tesseract(file_path: str) -> str:
    """Fallback OCR using tesseract via pytesseract."""
    try:
        import pytesseract
        img = Image.open(file_path)
        return pytesseract.image_to_string(img)
    except Exception:
        return ""