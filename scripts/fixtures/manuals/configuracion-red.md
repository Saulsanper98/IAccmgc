# Configuración de red interna

> **Tipo:** Referencia técnica  
> **Última revisión:** 2025-09-01  
> **Responsable:** Equipo de Redes CCMGC

## Resumen de subredes

| VLAN | Subred | Gateway | Uso |
|------|--------|---------|-----|
| 10 | 10.0.10.0/24 | 10.0.10.1 | Servidores producción |
| 20 | 10.0.20.0/24 | 10.0.20.1 | Estaciones de trabajo |
| 30 | 10.0.30.0/24 | 10.0.30.1 | Servicios de gestión |
| 99 | 10.0.99.0/24 | 10.0.99.1 | Red de administración |

## Servidores DNS

### DNS primario

- **Hostname:** `dns01.ejemplo.interno`
- **IP:** 10.0.30.10
- **Rol:** DNS autoritativo zona `ejemplo.interno`

### DNS secundario

- **Hostname:** `dns02.ejemplo.interno`
- **IP:** 10.0.30.11
- **Rol:** Réplica y resolución recursiva para clientes

## DHCP

El servicio DHCP corre en `dhcp01.ejemplo.interno` (10.0.30.20).

### Reservas importantes

| Hostname | MAC | IP reservada |
|----------|-----|--------------|
| impresora-piso1 | AA:BB:CC:DD:EE:01 | 10.0.20.50 |
| impresora-piso2 | AA:BB:CC:DD:EE:02 | 10.0.20.51 |
| servidor-nas | AA:BB:CC:DD:EE:10 | 10.0.10.100 |

## Firewall perimetral

Reglas de acceso desde la red externa (VPN):

- Puerto 443 → `portal.ejemplo.interno` (HTTPS)
- Puerto 3389 → VLAN 10 (solo desde VPN autorizada)
- Todo lo demás: **denegado por defecto**

## Troubleshooting común

### No resuelve nombres internos

1. Verificar que el cliente usa DNS 10.0.30.10 / 10.0.30.11
2. Probar: `nslookup wiki.ejemplo.interno 10.0.30.10`
3. Si falla, revisar estado del servicio en dns01

### Sin conectividad entre VLANs

1. Verificar reglas en el firewall interno `fw01.ejemplo.interno`
2. Consultar logs en **Monitor → Traffic Logs**
3. Escalar a Redes si persiste más de 15 minutos

## Enlaces relacionados

- [Procedimiento de backup de servidores](/sistemas/procedimientos/backup-servidores)
- [Guía de acceso VPN](/sistemas/guias/acceso-vpn)
