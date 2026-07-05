#!/usr/bin/env python3
"""Measure cosine similarity of questions against validated_qa (no LLM, no threshold filter).

Usage (inside API container):
  python /tmp/measure_qa_similarity.py
  python /tmp/measure_qa_similarity.py --verify
  python /tmp/measure_qa_similarity.py --verify "pregunta 1" "pregunta 2"
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date

from sqlalchemy import text

from app.config import get_settings
from app.db.session import async_session_factory
from app.services.ollama import OllamaClient
from app.services.query_embedding import embed_query_text, prepare_query_text
from app.services.validated_qa import (
    QA_VERIFY_SYSTEM_PROMPT,
    ValidatedQAService,
    build_verify_user_message,
    effective_recall_threshold,
    parse_verification_json,
)

DEFAULT_QUESTIONS = [
    "¿Cómo levanto nginx si está caído en el servidor de la wiki?",
    "nginx caído en wikijs, ¿qué hago?",
    "Reiniciar nginx wiki interna",
    "¿Cómo reinicio el servicio postgres en el servidor wiki interno?",
    "¿Cómo veo los logs de nginx en el servidor wiki interno?",
    "¿Cómo reinicio mi ordenador?",
    "¿Cómo reinicio el servicio redis en el servidor wiki interno?",
    "¿Cómo reinicio el worker en el servidor wiki interno?",
    "¿Cómo paro nginx en el servidor wiki interno?",
]

PROBE_QUESTIONS = [
    "El nginx del servidor wiki no responde, ¿cómo lo levanto de nuevo?",
    "¿Cómo relanzo el nginx de la wiki interna?",
]

ALL_VERIFY_QUESTIONS = DEFAULT_QUESTIONS + PROBE_QUESTIONS


async def nearest_validated_qa(
    question: str,
    *,
    reference_date: date,
    ollama: OllamaClient,
    session,
) -> tuple[str | None, str | None, float]:
    """Return (validated_qa_id, stored_question, max_similarity) for the closest row."""
    normalized = prepare_query_text(question)
    embedding = await embed_query_text(normalized, ollama)
    embedding_literal = "[" + ",".join(str(v) for v in embedding) + "]"

    result = await session.execute(
        text(
            """
            SELECT
                id,
                question,
                1 - (question_embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM validated_qa
            WHERE status = 'validated'
              AND valid_from <= :reference_date
              AND (valid_until IS NULL OR valid_until >= :reference_date)
            ORDER BY question_embedding <=> CAST(:embedding AS vector)
            LIMIT 1
            """
        ),
        {
            "embedding": embedding_literal,
            "reference_date": reference_date,
        },
    )
    row = result.mappings().first()
    if not row:
        return None, None, 0.0
    return str(row["id"]), row["question"], float(row["similarity"])


def _in_verify_window(similarity: float, recall_threshold: float, verify_bypass: float) -> bool:
    return recall_threshold <= similarity < verify_bypass


def _format_raw_response(raw: str) -> str:
    display = raw if len(raw) <= 200 else raw[:200]
    suffix = f"... (+{len(raw) - 200} chars)" if len(raw) > 200 else ""
    return f"{repr(display)}{suffix}"


async def _run_production_verify_call(
    *,
    service: ValidatedQAService,
    user_question: str,
    stored_question: str,
) -> tuple[str, bool]:
    """Same path as ValidatedQAService._verify_question_match (single Ollama call)."""
    raw = await service._call_verify_llm(stored_question, user_question)
    return raw, parse_verification_json(raw)


def _print_verify_diagnostics(
    *,
    stored_question: str,
    user_question: str,
    raw: str,
) -> None:
    user_msg = build_verify_user_message(stored_question, user_question)
    print(f"  [verify] system (verbatim): {QA_VERIFY_SYSTEM_PROMPT}")
    print(f"  [verify] user (verbatim):\n{user_msg}")
    print(f"  [verify] raw (repr, max 200 chars): {_format_raw_response(raw)}")


async def _resolve_injection_verdict(
    *,
    question: str,
    stored_question: str | None,
    similarity: float,
    recall_threshold: float,
    verify_bypass: float,
    service: ValidatedQAService,
    settings,
    verify: bool,
    show_verify_diagnostics: bool,
) -> tuple[str, str]:
    """Return (llm_verdict_label, would_inject_label)."""
    if similarity >= verify_bypass:
        return "bypass", "SÍ"
    if similarity < recall_threshold:
        return "fuera_recall", "NO"
    if not verify:
        return "pendiente_llm", "?"
    if not stored_question:
        return "sin_candidato", "NO"
    user_question = prepare_query_text(question)
    try:
        raw, accepted = await _run_production_verify_call(
            service=service,
            user_question=user_question,
            stored_question=stored_question,
        )
        if show_verify_diagnostics:
            _print_verify_diagnostics(
                stored_question=stored_question,
                user_question=user_question,
                raw=raw,
            )
    except Exception as exc:
        if show_verify_diagnostics:
            user_msg = build_verify_user_message(stored_question, user_question)
            print(f"  [verify] system (verbatim): {QA_VERIFY_SYSTEM_PROMPT}")
            print(f"  [verify] user (verbatim):\n{user_msg}")
            print(f"  [verify] raw (repr, max 200 chars): {repr(f'<error: {exc}>')}")
        return "error", "NO"
    verdict = "SÍ" if accepted else "NO"
    return verdict, ("SÍ" if accepted else "NO")


async def run(questions: list[str], *, verify: bool) -> int:
    settings = get_settings()
    recall_threshold = effective_recall_threshold(settings)
    verify_bypass = settings.validated_qa_verify_bypass
    reference_date = date.today()
    ollama = OllamaClient(settings)

    print(f"Recall threshold (settings): {recall_threshold:.2f}")
    print(f"Verify bypass (settings): {verify_bypass:.2f}")
    if verify:
        print(f"Verify model: {settings.validated_qa_verify_model}")
        print(
            f"{'pregunta':<70} | {'max_sim':>8} | {'veredicto LLM':>14} | {'¿inyecta?':>9}"
        )
        print("-" * 115)
    else:
        print(f"{'pregunta':<70} | {'max_sim':>8} | {'>= recall':>9} | {'>= bypass':>9} | closest_id")
        print("-" * 130)

    async with async_session_factory() as session:
        service = ValidatedQAService(session, settings)
        for question in questions:
            qa_id, stored_q, similarity = await nearest_validated_qa(
                question,
                reference_date=reference_date,
                ollama=ollama,
                session=session,
            )

            if verify:
                in_window = _in_verify_window(similarity, recall_threshold, verify_bypass)
                print(f"\n>>> {question}")
                llm_verdict, would_inject = await _resolve_injection_verdict(
                    question=question,
                    stored_question=stored_q,
                    similarity=similarity,
                    recall_threshold=recall_threshold,
                    verify_bypass=verify_bypass,
                    service=service,
                    settings=settings,
                    verify=True,
                    show_verify_diagnostics=in_window,
                )
                print(
                    f"    {question[:70]:<70} | {similarity:8.4f} | {llm_verdict:>14} | "
                    f"{would_inject:>9}"
                )
            else:
                passes_recall = similarity >= recall_threshold
                passes_bypass = similarity >= verify_bypass
                qa_short = (qa_id or "-")[:8]
                print(
                    f"{question[:70]:<70} | {similarity:8.4f} | "
                    f"{'SÍ' if passes_recall else 'NO':>9} | "
                    f"{'SÍ' if passes_bypass else 'NO':>9} | {qa_short}"
                )

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure validated_qa cosine similarities")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Run production LLM verification for recall <= sim < bypass candidates",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Use default 9 questions plus fresh probe questions (for --verify runs)",
    )
    parser.add_argument("questions", nargs="*", help="Questions to measure (defaults to built-in set)")
    args = parser.parse_args()
    if args.questions:
        questions = args.questions
    elif args.all or args.verify:
        questions = ALL_VERIFY_QUESTIONS
    else:
        questions = DEFAULT_QUESTIONS
    return asyncio.run(run(questions, verify=args.verify))


if __name__ == "__main__":
    sys.exit(main())
