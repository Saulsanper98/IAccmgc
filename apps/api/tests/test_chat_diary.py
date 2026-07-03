from datetime import date

from app.services.chat import format_diary_answer, parse_diary_query


def test_parse_diary_query_today_sistemas():
    result = parse_diary_query("Que se puso en el diario del dia de hoy en sistemas?")
    assert result is not None
    dept, target = result
    assert dept == "sistemas"
    assert target == date.today()


def test_parse_diary_query_yesterday_operadores():
    from datetime import timedelta

    from app.services.chat import local_today

    result = parse_diary_query("Resumen del diario de ayer en operadores")
    assert result is not None
    dept, target = result
    assert dept == "Operadores"
    assert target == local_today() - timedelta(days=1)


def test_parse_diary_query_without_date_returns_none():
    assert parse_diary_query("¿Cómo se configura Zabbix?") is None


def test_parse_diary_query_explicit_date():
    result = parse_diary_query("diario del 02/07 en sistemas")
    assert result is not None
    dept, target = result
    assert dept == "sistemas"
    assert target.day == 2
    assert target.month == 7


SAMPLE_DIARY_HTML = """
<h1>03 - Diario</h1>
<h2>Turno Mañana</h2>
<p><strong>Nombre del trabajador:</strong></p>
<h3>Notas</h3>
<ul>
  <li>Mendoza<ul>
      <li>Sergio, tema de wiki y keepass.</li>
      <li>Hikvision: 20 actualizaciones pendientes, no se harán.</li>
  </ul></li>
</ul>
"""


def test_format_diary_answer_extracts_notes():
    from uuid import uuid4

    from app.services.search import ChunkHit

    hit = ChunkHit(
        chunk_id=uuid4(),
        page_id=uuid4(),
        page_title="03 - Diario",
        page_path="sistemas/diario/2026/07/03",
        heading_path="Documento",
        content=SAMPLE_DIARY_HTML,
        ordinal=0,
        score=1.0,
    )
    answer = format_diary_answer([hit])
    assert answer is not None
    assert "Sergio, tema de wiki" in answer
    assert "Hikvision" in answer
    assert "01 - Diario" not in answer
