# Procedimiento de backup de servidores

> **Tipo:** Procedimiento operativo  
> **Última revisión:** 2025-11-15  
> **Responsable:** Equipo de Sistemas CCMGC

## Objetivo

Establecer el procedimiento estándar para realizar copias de seguridad de servidores críticos del entorno CCMGC.

## Alcance

Aplica a todos los servidores Windows Server y Linux gestionados por el departamento de Sistemas.

## Prerrequisitos

- Acceso al servidor de backup `backup01.ejemplo.interno`
- Credenciales de operador en el panel Veeam Backup & Replication
- Espacio disponible en el repositorio de backup (mínimo 20% libre)

## Procedimiento

### 1. Verificar estado del repositorio

1. Conectar a `https://backup01.ejemplo.interno:9419`
2. Ir a **Backup Infrastructure → Backup Repositories**
3. Confirmar que el espacio libre es superior al 20%

### 2. Ejecutar backup manual

1. Seleccionar el job correspondiente al servidor objetivo
2. Clic derecho → **Start**
3. Esperar a que el estado cambie a **Success**

### 3. Verificar integridad

1. Abrir **History** del job ejecutado
2. Confirmar que no hay warnings críticos
3. Registrar la ejecución en el log de operaciones

## Restauración de emergencia

En caso de necesitar restaurar un servidor:

1. Abrir Veeam → **Home → Restore**
2. Seleccionar **Entire VM** o **Guest files** según el caso
3. Elegir el punto de restauración más reciente anterior al incidente
4. Notificar al responsable de área antes de iniciar

## Contactos

| Rol | Contacto |
|-----|----------|
| Operador backup | sistemas@ejemplo.interno |
| Escalado L2 | jefe.sistemas@ejemplo.interno |

## Referencias

- [Política de retención de backups](/sistemas/politicas/retencion-backups)
- [Inventario de servidores críticos](/sistemas/inventario/servidores-criticos)
