from app.config import Settings
from app.services.chat import is_short_factual_query, resolve_num_predict
from app.services.ollama import resolve_num_thread


def test_resolve_num_thread_auto():
    assert resolve_num_thread(0) >= 4
    assert resolve_num_thread(6) == 6


def test_is_short_factual_query():
    assert is_short_factual_query("¿Qué puerto usa GLPI?")
    assert is_short_factual_query("¿Dónde está documentado el backup?")
    assert not is_short_factual_query("¿Cómo instalar el agente Zabbix en Linux?")
    assert not is_short_factual_query("Resume la documentación de redes")


def test_resolve_num_predict():
    settings = Settings()

    assert resolve_num_predict("¿Qué puerto usa GLPI?", settings) == settings.ollama_num_predict_short
    assert (
        resolve_num_predict("¿Cómo instalar el agente Zabbix en Linux?", settings)
        == settings.ollama_num_predict
    )
    assert (
        resolve_num_predict("Resume la documentación de redes", settings)
        == settings.ollama_num_predict
    )
