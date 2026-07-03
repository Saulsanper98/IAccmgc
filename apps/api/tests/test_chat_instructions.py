from app.services.chat_instructions import build_rag_system_prompt

BASE = "Eres WikiBridge."


def test_build_prompt_without_instructions():
    result = build_rag_system_prompt(BASE)
    assert result.startswith(BASE)
    assert "Instrucciones del equipo" not in result
    assert "Instrucciones personales" not in result
    assert "instrucciones del equipo o personales" in result


def test_build_prompt_with_team_and_user():
    result = build_rag_system_prompt(
        BASE,
        team_instructions="Para Power BI web, revisar página Web CCMGC.",
        user_instructions="Prefiero respuestas muy breves.",
    )
    assert "Web CCMGC" in result
    assert "muy breves" in result
    assert result.index("Instrucciones del equipo") < result.index("Instrucciones personales")


def test_build_prompt_ignores_blank():
    result = build_rag_system_prompt(BASE, team_instructions="   ", user_instructions="")
    assert "Instrucciones del equipo" not in result
