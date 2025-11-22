#!/usr/bin/env python3
"""Convert plain-text transcripts into a structured JSON array."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List

from dotenv import load_dotenv

try:
    from llama_index.llms.openai import OpenAI
except ImportError as exc:
    OpenAI = None  # type: ignore[assignment]

load_dotenv()

DEFAULT_MODEL = "gpt-4o-mini"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Call an LLM (or heuristic fallback) to convert transcripts into JSON.",
    )
    parser.add_argument("input", help="Path to the plain-text transcript file.")
    parser.add_argument(
        "-o",
        "--output",
        help="Where to write the JSON array (defaults to <input>.json next to the source).",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"LLM name to use when calling OpenAI (default: {DEFAULT_MODEL}).",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Skip the LLM call and use a simple speaker-splitting heuristic instead.",
    )
    parser.add_argument(
        "--speaker-delimiter",
        default=":",
        help="Token separating speaker name from utterance when using --mock (default: ':').",
    )
    return parser.parse_args()


def read_transcript(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Transcript not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def call_llm(transcript: str, model: str) -> List[dict]:
    if OpenAI is None:
        raise RuntimeError("llama-index-llms-openai is not installed.")
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set; export it to call OpenAI models.")

    llm = OpenAI(model=model, temperature=0)
    prompt = (
        "You are a meticulous note-taker. Convert the following transcript into a JSON "
        "array. Each element must include: speaker (string), timestamp (string, "
        "use 'unknown' if missing), and text (the cleaned utterance). Only output JSON."
        "\n\nTranscript:\n"
        f"{transcript}\n\nJSON:"
    )

    completion = llm.complete(prompt)
    raw = completion.text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(
            "Model output was not valid JSON. Inspect stdout/stderr for details."
        ) from exc


def mock_parse(transcript: str, delimiter: str) -> List[dict]:
    """Best-effort parser when no LLM is available."""
    entries: List[dict] = []
    for line in transcript.splitlines():
        line = line.strip()
        if not line:
            continue

        if delimiter in line:
            speaker, text = line.split(delimiter, 1)
            speaker = speaker.strip()
            text = text.strip()
        else:
            speaker = "unknown"
            text = line

        entries.append(
            {
                "speaker": speaker or "unknown",
                "timestamp": "unknown",
                "text": text,
            }
        )

    return entries


def main() -> int:
    args = parse_args()
    source = Path(args.input)
    transcript = read_transcript(source)

    if not transcript:
        print("Input transcript is empty.", file=sys.stderr)
        return 1

    try:
        if args.mock:
            entries = mock_parse(transcript, args.speaker_delimiter)
        else:
            entries = call_llm(transcript, args.model)
    except Exception as exc:  # pragma: no cover - surfaced to CLI user.
        print(f"Failed to convert transcript: {exc}", file=sys.stderr)
        return 1

    if not isinstance(entries, list) or not entries:
        print("No entries were produced from the transcript.", file=sys.stderr)
        return 1

    output_path = Path(args.output) if args.output else source.with_suffix(".json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(entries, indent=2), encoding="utf-8")

    print(f"Wrote {len(entries)} entries to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
