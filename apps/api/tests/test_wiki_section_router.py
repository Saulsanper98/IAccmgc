from app.services.wiki_section_router import parse_wiki_section_query


def test_vmware_section():
    section = parse_wiki_section_query("¿Cómo reinicio un host ESXi en el cluster VMware?")
    assert section is not None
    assert section.path_prefix == "sistemas/vmware"


def test_almacenamiento_section():
    section = parse_wiki_section_query("IP del NAS QNAP de almacenamiento")
    assert section is not None
    assert section.path_prefix == "sistemas/almacenamiento"


def test_redes_section():
    section = parse_wiki_section_query("Configuración de VLAN en redes")
    assert section is not None
    assert section.path_prefix == "sistemas/redes"


def test_salas_section():
    section = parse_wiki_section_query("Equipamiento de la sala de reuniones")
    assert section is not None
    assert section.path_prefix == "sistemas/salas"


def test_diary_query_skips_section_router():
    section = parse_wiki_section_query("Qué pasó en el diario de sistemas el 22 de junio?")
    assert section is None


def test_generic_query_returns_none():
    assert parse_wiki_section_query("¿Cómo se configura Zabbix?") is None
