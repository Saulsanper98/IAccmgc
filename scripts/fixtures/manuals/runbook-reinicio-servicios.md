# Runbook: Reinicio de servicios críticos

> **Tipo:** Runbook  
> **Última revisión:** 2025-12-20  
> **Responsable:** Equipo de Sistemas CCMGC

## Cuándo usar este runbook

- Servicio web no responde (HTTP 502/503)
- Base de datos PostgreSQL no acepta conexiones
- Wiki.js inaccesible tras actualización

## Servicios cubiertos

| Servicio | Servidor | Puerto | Comando reinicio |
|----------|----------|--------|------------------|
| Wiki.js | wiki01.ejemplo.interno | 3000 | `systemctl restart wikijs` |
| PostgreSQL | db01.ejemplo.interno | 5432 | `systemctl restart postgresql` |
| Nginx reverse proxy | web01.ejemplo.interno | 443 | `systemctl restart nginx` |
| Ollama (IA) | ollama01.ejemplo.interno | 11434 | `systemctl restart ollama` |

## Checklist previo al reinicio

- [ ] Confirmar que el problema afecta a múltiples usuarios (no es local)
- [ ] Revisar monitorización en Zabbix / Grafana
- [ ] Notificar en canal Teams #sistemas-alertas
- [ ] Obtener aprobación del responsable si es horario laboral

## Procedimiento: Wiki.js

### Paso 1 — Verificar estado

```bash
ssh operador@wiki01.ejemplo.interno
systemctl status wikijs
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

### Paso 2 — Reiniciar servicio

```bash
sudo systemctl restart wikijs
sleep 10
systemctl status wikijs
```

### Paso 3 — Validar

- Abrir `https://wiki.ejemplo.interno` en navegador
- Confirmar que carga la página principal
- Probar búsqueda de una página conocida

## Procedimiento: PostgreSQL

> **ATENCIÓN:** Reiniciar PostgreSQL afecta a Wiki.js y WikiBridge. Coordinar con el equipo.

```bash
ssh operador@db01.ejemplo.interno
sudo systemctl restart postgresql
pg_isready -h localhost -p 5432
```

## Procedimiento: Ollama

```bash
ssh operador@ollama01.ejemplo.interno
sudo systemctl restart ollama
curl http://localhost:11434/api/tags
```

Verificar que aparecen los modelos `qwen2.5:3b-instruct` y `bge-m3`.

## Post-reinicio

- [ ] Registrar incidente en GLPI
- [ ] Actualizar canal Teams con resolución
- [ ] Si el problema persiste, escalar a L2

## Escalado

| Nivel | Contacto | Cuándo |
|-------|----------|--------|
| L1 | Operador de guardia | Primer contacto |
| L2 | jefe.sistemas@ejemplo.interno | Tras 30 min sin resolución |
| L3 | Proveedor externo | Fallo hardware |
