# Desarrollo en casa — Windows

Guía mínima para probar el chat con manuales ficticios en tu PC Windows, **sin Wiki.js** y **sin afectar el despliegue del trabajo**.

## Requisitos

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) (PostgreSQL + Redis)
2. [Ollama para Windows](https://ollama.com/download) (app + modelos)
3. Node.js 20+
4. Python 3.12+

## Instalación (una sola vez)

Abre **PowerShell** en la carpeta del proyecto:

```powershell
git checkout cursor/dev-offline-manuals-895b
git pull

# Permite ejecutar scripts (solo esta sesión)
Set-ExecutionPolicy -Scope Process Bypass

# Instala todo: Docker BD, deps, migraciones, manuales
.\scripts\setup-windows-home.ps1
```

Antes del setup, abre **Ollama** y descarga los modelos (desde la app o terminal):

```
phi3:mini
bge-m3
```

## Arrancar la app

```powershell
.\scripts\start-all-home.ps1
```

## Probar el chat

- URL: http://localhost:3000/chat
- Login: **admin** / **admin**
- Preguntas de prueba:
  - *¿Cómo hago un backup de servidores?*
  - *¿Cómo me conecto a la VPN?*
  - *¿Cuáles son las subredes de la red interna?*

## Parar

```powershell
.\scripts\stop-all-home.ps1
```

## Logs si algo falla

```powershell
Get-Content .dev\logs\api.log -Tail 30
Get-Content .dev\logs\web.log -Tail 30
```

## ¿Afecta al trabajo?

**No.** Todo usa `.env` local (no se sube a git) y scripts solo para casa. En el trabajo sigues con Docker Compose y tu `.env` de producción.

## Cuando vuelvas al trabajo

Configura `WIKIJS_URL` y `WIKIJS_API_KEY` en el `.env` del servidor y sincroniza desde `/admin`. No hace falta mergear esta rama para seguir en producción.
