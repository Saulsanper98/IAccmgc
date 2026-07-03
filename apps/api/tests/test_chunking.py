from app.services.chunking import chunk_markdown, estimate_tokens, split_markdown_sections


SAMPLE_DOC = """# Servidores

## DNS

### Zonas inversas

Configurar la zona inversa para la red 10.0.0.0/24 en el servidor primario.

El registro PTR debe apuntar al hostname correcto.

## DHCP

Reservas para impresoras y equipos fijos.
"""


def test_estimate_tokens_positive():
    assert estimate_tokens("hola mundo") >= 2


def test_split_markdown_sections():
    sections = split_markdown_sections(SAMPLE_DOC)
    paths = [path for path, _ in sections]
    assert any("DNS" in path for path in paths)
    assert any("Zonas inversas" in path for path in paths)


def test_chunk_markdown_produces_chunks_with_heading_path():
    chunks = chunk_markdown(SAMPLE_DOC, min_tokens=10, max_tokens=80, overlap_tokens=5)
    assert len(chunks) >= 1
    assert all(chunk.heading_path for chunk in chunks)
    assert all(chunk.content.strip() for chunk in chunks)
