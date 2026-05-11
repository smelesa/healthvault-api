"""ReferenceRanges singleton — loads reference_ranges.yaml at startup."""
import yaml
from functools import lru_cache
from pathlib import Path
from typing import Optional
from dataclasses import dataclass


@dataclass
class BiomarkerRange:
    display_name: str
    unit: str
    source: str
    ref_male: tuple[float, float]
    ref_female: tuple[float, float]
    description: str = ""

    def get_range(self, sex: str) -> tuple[float, float]:
        """Return (low, high) tuple for given sex."""
        return self.ref_male if sex == "M" else self.ref_female

    def get_interpretation(self, value: float, sex: str) -> str:
        """Return interpretation: normal, low, high, critical_low, critical_high."""
        low, high = self.get_range(sex)
        if value < low * 0.8:
            return "critical_low"
        elif value < low:
            return "low"
        elif value > high * 1.3:
            return "critical_high"
        elif value > high:
            return "high"
        return "normal"


class ReferenceRanges:
    """Singleton — loaded once from config/reference_ranges.yaml."""

    def __init__(self, yaml_path: str = "config/reference_ranges.yaml"):
        self._ranges: dict[str, BiomarkerRange] = {}
        self._load(yaml_path)

    def _load(self, yaml_path: str) -> None:
        path = Path(yaml_path)
        if not path.exists():
            # Try relative to this file's directory
            path = Path(__file__).parent.parent / yaml_path
        if not path.exists():
            raise FileNotFoundError(f"reference_ranges.yaml not found at {yaml_path}")

        with open(path, "r") as f:
            data = yaml.safe_load(f)

        for code, values in data.items():
            self._ranges[code] = BiomarkerRange(
                display_name=values["display_name"],
                unit=values["unit"],
                source=values["source"],
                ref_male=tuple(values["ref_male"]),
                ref_female=tuple(values["ref_female"]),
                description=values.get("description", ""),
            )

    def get(self, code: str) -> Optional[BiomarkerRange]:
        return self._ranges.get(code)

    def get_range(self, code: str, sex: str = "M") -> Optional[tuple[float, float]]:
        """Return (low, high) for code and sex. Returns None if code not found."""
        r = self._ranges.get(code)
        return r.get_range(sex) if r else None

    def get_interpretation(self, code: str, value: float, sex: str = "M") -> Optional[str]:
        r = self._ranges.get(code)
        return r.get_interpretation(value, sex) if r else None

    def codes(self):
        return list(self._ranges.keys())

    def all(self) -> dict[str, BiomarkerRange]:
        return dict(self._ranges)


@lru_cache
def get_reference_ranges() -> ReferenceRanges:
    """Module-level singleton accessor."""
    return ReferenceRanges()