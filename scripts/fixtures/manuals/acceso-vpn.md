# Guía de acceso VPN

> **Tipo:** Guía de usuario  
> **Última revisión:** 2026-01-10  
> **Responsable:** Equipo de Sistemas CCMGC

## Descripción

Esta guía explica cómo conectarse a la VPN corporativa de CCMGC para acceder a recursos internos (Wiki.js, servidores, aplicaciones) desde fuera de la oficina.

## Requisitos

- Usuario de Active Directory activo
- Cliente VPN instalado (FortiClient 7.x o superior)
- Certificado de la CA interna instalado en el equipo

## Instalación del cliente

1. Descargar FortiClient desde el portal interno: `https://portal.ejemplo.interno/vpn`
2. Ejecutar el instalador con permisos de administrador
3. Reiniciar el equipo si se solicita

## Configuración de conexión

| Parámetro | Valor |
|-----------|-------|
| Tipo | SSL-VPN |
| Gateway | `vpn.ejemplo.interno` |
| Puerto | 443 |
| Usuario | `DOMINIO\usuario` |
| Autenticación | LDAP + token MFA |

## Conectar paso a paso

1. Abrir FortiClient → **Remote Access**
2. Seleccionar el perfil **CCMGC-VPN**
3. Introducir usuario y contraseña de AD
4. Aprobar la notificación MFA en el móvil
5. Esperar el mensaje **Connected**

## Verificar conectividad

Tras conectar, comprobar acceso a:

```bash
ping wiki.ejemplo.interno
ping dns01.ejemplo.interno
```

Abrir en el navegador: `https://wiki.ejemplo.interno`

## Problemas frecuentes

### Error "Authentication failed"

- Verificar que la contraseña de AD no ha expirado
- Confirmar que el usuario tiene permiso VPN en el grupo `VPN-Users`

### Conecta pero no accede a recursos internos

- Ejecutar `ipconfig /all` y verificar que se asignó IP de la subred VPN (10.0.50.x)
- Revisar que las rutas incluyen 10.0.0.0/8

### MFA no llega

- Verificar la app Authenticator está sincronizada
- Contactar con sistemas@ejemplo.interno para reset de MFA

## Soporte

- **Email:** sistemas@ejemplo.interno
- **Teléfono:** ext. 4500 (horario laboral)
