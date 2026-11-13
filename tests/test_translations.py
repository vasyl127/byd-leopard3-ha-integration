"""Every translation file has the same keys and placeholders as en.json."""
import json
import re
from pathlib import Path

import pytest

DIR = Path(__file__).parent.parent / "custom_components/byd_leopard3/translations"
PH = re.compile(r"\{[^{}]*\}")


def _flat(d, p=""):
    out = {}
    for k, v in d.items():
        out.update(_flat(v, f"{p}{k}.") if isinstance(v, dict) else {p + k: v})
    return out


EN = _flat(json.loads((DIR / "en.json").read_text()))


@pytest.mark.parametrize("path", sorted(p for p in DIR.glob("*.json") if p.name != "en.json"), ids=lambda p: p.stem)
def test_translation_matches_english(path):
    tr = _flat(json.loads(path.read_text()))
    assert tr.keys() == EN.keys()
    for k, v in EN.items():
        assert tr[k].strip(), k
        assert sorted(PH.findall(tr[k])) == sorted(PH.findall(v)), k


def test_languages():
    assert {p.stem for p in DIR.glob("*.json")} == {
        "en", "uk", "de", "es", "fr", "it", "nl", "pl", "pt-BR", "zh-Hans", "ja"}
