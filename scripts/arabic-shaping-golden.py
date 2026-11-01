# /// script
# dependencies = ["arabic-reshaper==3.0.0"]
# ///
"""Build test/core/arabic-shaping.golden.txt.

    uv run scripts/arabic-shaping-golden.py

Each line is a sentence and the presentation forms arabic_reshaper gives it, as
code points. It is the oracle for `shaped` because it is not drawn from
`src/core/bidi.ts`: a second implementation reading no table of ours, so a
`shaped` that returned isolated forms for every letter fails here. Ligatures are
off and harakat kept, which is what `shaped` promises: one form per letter.
"""

from pathlib import Path

import arabic_reshaper

OUT = Path(__file__).resolve().parent.parent / "test/core/arabic-shaping.golden.txt"

SENTENCES = [
    "مرحبا بالعالم",
    "السلام عليكم",
    "لا إله إلا الله",
    "كتاب جديد",
    "مَرْحَبًا",
    "در این باغ گل و پروانه است",
    "چگونه پیدا کردی",
    "ژاله و پسر",
    "اردو زبان بہت پیاری ہے",
    "ٹوپی ڈاکٹر",
]


def main() -> None:
    reshaper = arabic_reshaper.ArabicReshaper({"delete_harakat": False, "support_ligatures": False})
    rows = []
    for sentence in SENTENCES:
        forms = " ".join(f"{ord(c):04X}" for c in reshaper.reshape(sentence))
        source = " ".join(f"{ord(c):04X}" for c in sentence)
        rows.append(f"{source};{forms}\n")
    OUT.write_text("".join(rows))
    print(f"{OUT}: {len(rows)} sentences")


if __name__ == "__main__":
    main()
