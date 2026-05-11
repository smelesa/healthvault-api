"""Biomarker parser — regex-based extraction from OCR/text."""
import re
from typing import Optional
from dataclasses import dataclass
from app.utils.reference_ranges import get_reference_ranges


@dataclass
class ParsedBiomarker:
    code: str
    value: float
    unit: str
    display_name: str
    reference_range_low: Optional[float]
    reference_range_high: Optional[float]
    standard_reference_range_low: float
    standard_reference_range_high: float
    lab_reference_range_low: Optional[float]
    lab_reference_range_high: Optional[float]
    interpretation: str
    reference_source: str


# Regex patterns for known biomarkers
# Format: code -> (display_name, unit, list of patterns, ref_male, ref_female)
BIOMARKER_PATTERNS = {
    "GLU": {
        "name": "Fasting Glucose",
        "unit": "mg/dL",
        "patterns": [
            r"Glucose[\s:,]+(?:Fasting[\s:,]+)?(\d+\.?\d*)\s*(?:mg/dL)?",
            r"Glucose,\s*Fasting[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"FBG[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"(\d+\.?\d*)\s*mg/dL\s+Glucose",
        ],
        "ref_male": (70, 100),
        "ref_female": (70, 100),
    },
    "HbA1c": {
        "name": "Hemoglobin A1c",
        "unit": "%",
        "patterns": [
            r"HbA1c[:\s]+(\d+\.?\d*)\s*(?:%|%)?",
            r"Hemoglobin\s*A1c[:\s]+(\d+\.?\d*)\s*(?:%|%)?",
            r"A1c[:\s]+(\d+\.?\d*)\s*(?:%|%)?",
            r"HbA1\s*[:\s]+(\d+\.?\d*)\s*(?:%|%)?",
        ],
        "ref_male": (4.0, 5.6),
        "ref_female": (4.0, 5.6),
    },
    "CHOL": {
        "name": "Total Cholesterol",
        "unit": "mg/dL",
        "patterns": [
            r"Cholesterol[\s:,]+Total[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"Total Chol(?:esterol)?[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"Chol[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
        ],
        "ref_male": (0, 200),
        "ref_female": (0, 200),
    },
    "HDL": {
        "name": "HDL Cholesterol",
        "unit": "mg/dL",
        "patterns": [
            r"HDL[\s:,]+(?:Cholesterol[\s:,]+)?(\d+\.?\d*)\s*(?:mg/dL)?",
            r"HDL[- ]Chol[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
        ],
        "ref_male": (40, 60),
        "ref_female": (50, 60),
    },
    "LDL": {
        "name": "LDL Cholesterol",
        "unit": "mg/dL",
        "patterns": [
            r"LDL[\s:,]+(?:Cholesterol[\s:,]+)?(\d+\.?\d*)\s*(?:mg/dL)?",
            r"LDL[- ]Chol[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"LDL\s+(\d+\.?\d*)\s*(?:mg/dL)?",
        ],
        "ref_male": (0, 100),
        "ref_female": (0, 100),
    },
    "TG": {
        "name": "Triglycerides",
        "unit": "mg/dL",
        "patterns": [
            r"Triglycerides[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"Trig[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"TG[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
        ],
        "ref_male": (0, 150),
        "ref_female": (0, 150),
    },
    "CREAT": {
        "name": "Creatinine",
        "unit": "mg/dL",
        "patterns": [
            r"Creatinine[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"Creat[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
        ],
        "ref_male": (0.7, 1.3),
        "ref_female": (0.6, 1.1),
    },
    "BUN": {
        "name": "Blood Urea Nitrogen",
        "unit": "mg/dL",
        "patterns": [
            r"BUN[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
            r"Urea\s*Nitrogen[:\s]+(\d+\.?\d*)\s*(?:mg/dL)?",
        ],
        "ref_male": (7, 20),
        "ref_female": (7, 20),
    },
    "ALT": {
        "name": "Alanine Aminotransferase",
        "unit": "U/L",
        "patterns": [
            r"ALT[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
            r"GPT[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
            r"Alanine\s*Aminotransferase[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
        ],
        "ref_male": (0, 40),
        "ref_female": (0, 40),
    },
    "AST": {
        "name": "Aspartate Aminotransferase",
        "unit": "U/L",
        "patterns": [
            r"AST[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
            r"GOT[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
            r"Aspartate\s*Aminotransferase[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
        ],
        "ref_male": (0, 40),
        "ref_female": (0, 40),
    },
    "ALP": {
        "name": "Alkaline Phosphatase",
        "unit": "U/L",
        "patterns": [
            r"ALP[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
            r"Alkaline\s*Phosphatase[:\s]+(\d+\.?\d*)\s*(?:U/L)?",
        ],
        "ref_male": (30, 120),
        "ref_female": (30, 120),
    },
    "HGB": {
        "name": "Hemoglobin",
        "unit": "g/dL",
        "patterns": [
            r"Hemoglobin[:\s]+(\d+\.?\d*)\s*(?:g/dL)?",
            r"HGB[:\s]+(\d+\.?\d*)\s*(?:g/dL)?",
            r"Hb[:\s]+(\d+\.?\d*)\s*(?:g/dL)?",
        ],
        "ref_male": (13.5, 17.5),
        "ref_female": (12.0, 16.0),
    },
    "WBC": {
        "name": "White Blood Cell Count",
        "unit": "×10³/µL",
        "patterns": [
            r"WBC[:\s]+(\d+\.?\d*)\s*(?:×10³/µL)?",
            r"White\s*Blood\s*Cell[s]?[:\s]+(\d+\.?\d*)",
        ],
        "ref_male": (4.5, 11.0),
        "ref_female": (4.5, 11.0),
    },
    "RBC": {
        "name": "Red Blood Cell Count",
        "unit": "×10⁶/µL",
        "patterns": [
            r"RBC[:\s]+(\d+\.?\d*)\s*(?:×10⁶/µL)?",
            r"Red\s*Blood\s*Cell[s]?[:\s]+(\d+\.?\d*)",
        ],
        "ref_male": (4.4, 5.8),
        "ref_female": (3.9, 5.2),
    },
    "PLT": {
        "name": "Platelet Count",
        "unit": "×10³/µL",
        "patterns": [
            r"Platelets?[:\s]+(\d+\.?\d*)\s*(?:×10³/µL)?",
            r"PLT[:\s]+(\d+\.?\d*)",
        ],
        "ref_male": (150, 400),
        "ref_female": (150, 400),
    },
    "TSH": {
        "name": "Thyroid Stimulating Hormone",
        "unit": "mIU/L",
        "patterns": [
            r"TSH[:\s]+(\d+\.?\d*)\s*(?:mIU/L)?",
            r"Thyrotropin[:\s]+(\d+\.?\d*)\s*(?:mIU/L)?",
        ],
        "ref_male": (0.4, 4.0),
        "ref_female": (0.4, 4.0),
    },
    "VITD": {
        "name": "Vitamin D (25-OH)",
        "unit": "ng/mL",
        "patterns": [
            r"Vitamin\s*D[\s:,]+(?:25[- ]OH[\s:,]+)?(\d+\.?\d*)\s*(?:ng/mL)?",
            r"25[- ]OH\s*Vitamin\s*D[:\s]+(\d+\.?\d*)\s*(?:ng/mL)?",
            r"25OHD[:\s]+(\d+\.?\d*)\s*(?:ng/mL)?",
        ],
        "ref_male": (30, 100),
        "ref_female": (30, 100),
    },
    "IRON": {
        "name": "Serum Iron",
        "unit": "µg/dL",
        "patterns": [
            r"Iron[\s:,]+(?:Serum[\s:,]+)?(\d+\.?\d*)\s*(?:µg/dL)?",
            r"Fe[:\s]+(\d+\.?\d*)\s*(?:µg/dL)?",
        ],
        "ref_male": (65, 175),
        "ref_female": (50, 170),
    },
    "FERR": {
        "name": "Ferritin",
        "unit": "ng/mL",
        "patterns": [
            r"Ferritin[:\s]+(\d+\.?\d*)\s*(?:ng/mL)?",
        ],
        "ref_male": (20, 300),
        "ref_female": (20, 200),
    },
}


def parse_lab_reference_range(text: str) -> tuple[float, float] | None:
    """Extract [low-high] or (low-high) from OCR text, e.g. '[70-100]'."""
    patterns = [
        r'\[(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\]',  # [70-100]
        r'\((\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\)',  # (70-100)
        r'(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*(?:mg/dL|%)',  # 70-100 mg/dL
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return (float(match.group(1)), float(match.group(2)))
    return None


def parse_biomarkers_from_text(
    text: str,
    sex: str = "M",
) -> list[ParsedBiomarker]:
    """Parse all known biomarkers from extracted text."""
    results = []
    ref_ranges = get_reference_ranges()

    for code, config in BIOMARKER_PATTERNS.items():
        for pattern in config["patterns"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if not match:
                continue

            value_str = match.group(1).strip()
            try:
                value = float(value_str)
            except ValueError:
                continue

            # Find surrounding context for lab range (look for [...] nearby)
            start = max(0, match.start() - 10)
            end = min(len(text), match.end() + 30)
            context = text[start:end]

            lab_range = parse_lab_reference_range(context)
            standard_low, standard_high = config[f"ref_{sex.lower()}"]

            if lab_range:
                effective_low, effective_high = lab_range
                lab_ref_low, lab_ref_high = lab_range
                ref_source = "lab_document"
            else:
                effective_low, effective_high = standard_low, standard_high
                lab_ref_low, lab_ref_high = None, None
                ref_source = "CLSI/ADA/ESC"  # Default source

            # Interpretation based on effective range
            if value < effective_low * 0.8:
                interpretation = "critical_low"
            elif value < effective_low:
                interpretation = "low"
            elif value > effective_high * 1.3:
                interpretation = "critical_high"
            elif value > effective_high:
                interpretation = "high"
            else:
                interpretation = "normal"

            results.append(ParsedBiomarker(
                code=code,
                value=value,
                unit=config["unit"],
                display_name=config["name"],
                reference_range_low=effective_low,
                reference_range_high=effective_high,
                standard_reference_range_low=standard_low,
                standard_reference_range_high=standard_high,
                lab_reference_range_low=lab_ref_low,
                lab_reference_range_high=lab_ref_high,
                interpretation=interpretation,
                reference_source=ref_source,
            ))
            break  # One match per biomarker is enough

    return results