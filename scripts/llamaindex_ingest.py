#!/usr/bin/env python3
"""Utility helpers for building and querying a local LlamaIndex store."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Iterable, List

from dotenv import load_dotenv
from llama_index.core import (
    Document,
    Settings,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

load_dotenv()

DEFAULT_STORAGE_DIR = Path(".llamaindex") / "agents"
DEFAULT_SAMPLE_DATA = Path("examples/llamaindex/sample_agents.json")
EMBED_MODEL_NAME = "BAAI/bge-small-en-v1.5"


def configure_settings(model_name: str = EMBED_MODEL_NAME) -> None:
    """Ensure deterministic local embeddings so the example works offline."""
    if isinstance(Settings.embed_model, HuggingFaceEmbedding):
        return

    Settings.embed_model = HuggingFaceEmbedding(model_name=model_name)


def summarize_text(text: str, limit: int = 280) -> str:
    """Return a single-line summary with a soft character limit."""
    collapsed = " ".join(text.split())
    if len(collapsed) <= limit:
        return collapsed

    truncated = collapsed[:limit]
    last_space = truncated.rfind(" ")
    if last_space > 0:
        truncated = truncated[:last_space]
    return f"{truncated}..."


def load_documents(path: Path) -> List[Document]:
    """Load `Document` objects from supported file types."""
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    suffix = path.suffix.lower()
    if suffix == ".json":
        return _load_from_json(path)

    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"File {path} is empty")

    metadata = {"title": path.stem, "source": str(path)}
    return [Document(text=text, metadata=metadata)]


def _load_from_json(path: Path) -> List[Document]:
    """Parse a JSON array of objects into Documents."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    entries: Iterable[dict] = raw if isinstance(raw, list) else [raw]

    documents: List[Document] = []
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"JSON entry #{idx} is not an object")

        text = entry.get("body") or entry.get("text") or entry.get("content")
        if not text:
            raise ValueError(f"JSON entry #{idx} missing `body|text|content`")

        metadata = {
            "title": entry.get("title", f"entry-{idx}"),
            "source": entry.get("source", str(path)),
            **{k: v for k, v in entry.items() if k not in {"body", "text", "content"}},
        }

        documents.append(Document(text=str(text), metadata=metadata))

    if not documents:
        raise ValueError(f"No readable items found in {path}")

    return documents


def handle_ingest(args: argparse.Namespace) -> int:
    """Build a fresh vector index from the provided files."""
    configure_settings()

    sources = args.inputs or [DEFAULT_SAMPLE_DATA]
    docs: List[Document] = []
    for source in sources:
        docs.extend(load_documents(Path(source)))

    if not docs:
        print("Refusing to create an empty index.", file=sys.stderr)
        return 1

    storage_dir = Path(args.storage_dir).expanduser()
    if args.reset and storage_dir.exists():
        shutil.rmtree(storage_dir)

    storage_dir.mkdir(parents=True, exist_ok=True)

    index = VectorStoreIndex.from_documents(docs)
    index.storage_context.persist(persist_dir=str(storage_dir))

    print(f"Indexed {len(docs)} document(s) into {storage_dir}")
    return 0


def handle_query(args: argparse.Namespace) -> int:
    """Open an existing vector index and retrieve matching nodes."""
    configure_settings()

    storage_dir = Path(args.storage_dir).expanduser()
    if not storage_dir.exists():
        print(
            f"Storage directory {storage_dir} does not exist. "
            "Run the ingest command first.",
            file=sys.stderr,
        )
        return 1

    storage_context = StorageContext.from_defaults(persist_dir=str(storage_dir))
    index = load_index_from_storage(storage_context)

    retriever = index.as_retriever(similarity_top_k=args.top_k)
    matches = retriever.retrieve(args.question)

    if not matches:
        print("No matching context was found for that question.")
        return 0

    top = matches[0]
    title = top.node.metadata.get("title") or "Document"
    snippet = summarize_text(top.node.get_content(metadata_mode="LLM"))

    print(f"Answer: {title} -> {snippet}")
    print("\nSources:")
    for match in matches:
        meta = match.node.metadata
        score = getattr(match, "score", None)
        label = meta.get("title") or meta.get("source") or "Document"
        if score is None:
            print(f"- {label}")
        else:
            print(f"- {label} (score: {score:.3f})")

    print(
        "\nTip: swap in your preferred LLM inside scripts/llamaindex_ingest.py "
        "if you want full natural-language responses."
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--storage-dir",
        default=str(DEFAULT_STORAGE_DIR),
        help=f"Directory for the persisted index (default: {DEFAULT_STORAGE_DIR})",
    )

    parser = argparse.ArgumentParser(
        description="Create or query a lightweight LlamaIndex vector store."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest = subparsers.add_parser(
        "ingest",
        parents=[common],
        help="Build or extend the vector store.",
        description="Ingest JSON/text files into the vector store.",
    )
    ingest.add_argument(
        "-i",
        "--input",
        action="append",
        dest="inputs",
        metavar="PATH",
        help="Path to a JSON or text file. Defaults to the bundled sample dataset.",
    )
    ingest.add_argument(
        "--reset",
        action="store_true",
        help="Delete the existing storage directory before ingesting.",
    )

    query = subparsers.add_parser(
        "query",
        parents=[common],
        help="Query an existing vector store.",
        description="Retrieve the best matching nodes for a question.",
    )
    query.add_argument("question", help="Natural-language question to answer.")
    query.add_argument(
        "--top-k",
        type=int,
        default=2,
        help="Number of source nodes to display (default: 2).",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "ingest":
        return handle_ingest(args)
    if args.command == "query":
        return handle_query(args)

    parser.error(f"Unknown command {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
