# Feedback y conocimiento validado en WikiBridge

Manual para el equipo de Sistemas del CCMGC. Describe cómo corregir respuestas del chat, qué ocurre con esas correcciones y cómo las revisan los administradores.

---

## Parte 1 — Para todos los usuarios

## Qué es este sistema

WikiBridge responde consultas buscando en la documentación indexada de la wiki. A veces la respuesta es incorrecta, incompleta o desactualizada. En lugar de repetir la misma corrección en cada conversación, el equipo puede **señalar qué funcionó y qué no**, y proponer **la respuesta correcta** para que un administrador la revise.

Cuando una corrección se valida, WikiBridge la guarda como **conocimiento validado**: ante preguntas parecidas, puede devolver **exactamente ese texto**, con sello del equipo, sin volver a improvisar. Así el conocimiento operativo del CCMGC mejora de forma acumulativa.

## Los botones debajo de cada respuesta

Tras cada mensaje del asistente aparece la pregunta «¿Útil?» y dos botones: 👍 y 👎. Solo puedes votar **una vez** por mensaje; tras enviar el voto, los botones quedan deshabilitados.

### El botón 👍 (útil)

Púlsalo cuando la respuesta te sirve tal cual: procedimiento correcto, datos fiables, formato claro. No hace falta escribir nada más.

Al pulsarlo, el sistema registra un voto positivo asociado a tu usuario y a esa pregunta/respuesta. Verás el texto «Gracias». **No crea una entrada de conocimiento validado**; sirve sobre todo como señal de calidad para el equipo.

### El botón 👎 (no útil)

Púlsalo cuando la respuesta no te vale. Se abre un panel con el campo **«¿Cuál habría sido la respuesta correcta?»** y los botones **Cancelar** y **Enviar**.

Aquí está la diferencia importante:

- **👎 y Enviar con el campo vacío:** indicas que la respuesta fue mala, pero no propones sustituto. El voto negativo queda registrado y ayuda a detectar respuestas problemáticas. **No entra en la cola de revisión** para convertirse en conocimiento validado.

- **👎 y Enviar con texto en el campo:** además del voto negativo, envías una **corrección propuesta**. El sistema crea una entrada en estado **pendiente** que un administrador verá en Admin → Conocimiento validado. Hasta que no la validen, **nadie más recibirá esa respuesta** en el chat.

Si enviaste corrección, verás: *«Tu corrección quedará pendiente de revisión por un administrador.»*

El campo admite hasta 8000 caracteres. La corrección debe ser texto plano o markdown; el chat la renderizará igual que una respuesta normal.

## Cómo escribir una buena corrección

Piensa que lo que escribes **puede servirse literalmente** a un compañero que haga una pregunta similar. No redactes una crítica («esto está mal porque…»); escribe **la respuesta buena**, como se la darías por Teams o correo.

### Respuesta completa y autocontenida

Incluye contexto mínimo, pasos, nombres de servicios, rutas y matices necesarios. Quien la lea no debería necesitar la conversación original.

### Comandos y rutas en bloques de código

El chat interpreta markdown. Texto con guiones bajos (`zabbix_agent2.conf`), asteriscos o rutas puede **corromperse** si va suelto. Los comandos y fragmentos técnicos van **siempre** en bloques fenced:

```bash
sudo apt install zabbix-agent2
sudo systemctl enable --now zabbix-agent2
```

### Pasos numerados sin listas «1.» junto a código

Mezclar listas numeradas automáticas (`1.`, `2.`) con bloques ``` en la misma respuesta puede hacer que el renderizado trate líneas siguientes como código. Usa **Paso 1.**, **Paso 2.** en negrita en lugar de listas numeradas.

### Comprueba antes de enviar

Verifica contra la realidad: Portainer, la consola del servicio, el servidor afectado. No envíes de memoria procedimientos que no hayas contrastado.

### Ejemplo: instalación del agente Zabbix en Linux

Pregunta del compañero: *«¿Cómo instalo el agente Zabbix en un servidor Linux?»*

La IA respondió con pasos genéricos o desactualizados. Una buena corrección sería:

**Paso 1.** Añadir el repositorio oficial de Zabbix para tu distribución (consulta la wiki interna de Zabbix si dudas de la URL exacta).

**Paso 2.** Instalar el agente:

```bash
sudo apt update
sudo apt install zabbix-agent2
```

**Paso 3.** Editar la configuración en `/etc/zabbix/zabbix_agent2.conf` (directiva `Server` apuntando al proxy o servidor Zabbix del CCMGC).

**Paso 4.** Arrancar y habilitar el servicio:

```bash
sudo systemctl enable --now zabbix-agent2
sudo systemctl status zabbix-agent2
```

**Paso 5.** Comprobar en la interfaz de Zabbix que el host aparece en verde.

Ese texto, una vez validado por un administrador, es lo que recibirá quien pregunte algo equivalente.

## El badge «✓ Respuesta validada por el equipo · fecha»

Cuando una respuesta proviene de **conocimiento validado** (no de una redacción nueva de la IA), bajo el mensaje aparece una línea verde:

**✓ Respuesta validada por el equipo ·** *5 de julio de 2026* (la fecha corresponde al día en que se validó o entró en vigor).

Significa:

- El texto lo escribió y aprobó **una persona del equipo**, no lo generó el modelo en ese momento.
- La cita asociada suele mostrar «Respuesta validada por el equipo» en lugar de una página de la wiki.

### Por qué esas respuestas llegan en segundos

WikiBridge busca primero si existe una entrada validada que encaje con la pregunta. Si la encuentra, **devuelve el texto almacenado** directamente (modelo interno `wikibridge-validated-qa`), sin buscar en la wiki ni redactar de nuevo con el modelo grande. Por eso la latencia es mucho menor que en una respuesta normal.

Si la pregunta es parecida pero no idéntica, el sistema comprueba que pida **la misma información** antes de usar la entrada validada.

## Qué NO va por este canal

No uses el feedback validado para **información que cambia a menudo**: inventarios de VMs, estados de proyectos, listas de IPs, «quién está de guardia hoy», etc. Eso se mantiene **editando la página correspondiente en la wiki** y dejando que la ingesta actualice WikiBridge.

Regla simple:

- **Procedimiento estable** (instalar un agente, reiniciar un servicio, ruta de despliegue que no cambia cada semana) → corrección validada, si hace falta.
- **Información viva** que caduca → editar la wiki, no una corrección del chat.

---

## Parte 2 — Para administradores (revisores)

Acceso: rol **admin**, menú **Admin** → sección **Conocimiento validado**. Solo administradores ven y gestionan este panel.

## El panel «Conocimiento validado»

### Pestañas

- **Pendientes:** correcciones enviadas desde el chat (👎 con texto). Aquí está el trabajo de curación.
- **Validados:** entradas activas que WikiBridge puede servir a los usuarios.
- **Rechazados:** propuestas descartadas; no se usan en el chat, pero el registro se conserva.

Cada tarjeta muestra la **pregunta** (tal como quedó registrada del mensaje anterior del usuario), la **respuesta propuesta**, el **autor** de la corrección y, si existe, la **respuesta original del sistema** para comparar.

### Contador en el menú

En la navegación lateral, la entrada **Admin** puede mostrar un **badge numérico** con el número de entradas pendientes. El contador se actualiza al revisar entradas en el panel. Si no ves el número, entra en Admin: al cargar la sección se refresca.

### Acciones disponibles

En cada entrada:

- **Editar:** modificar pregunta y/o respuesta antes de decidir (ver más abajo).
- **Validar:** pasa a **Validados** y queda disponible para el chat.
- **Rechazar:** pasa a **Rechazados**; deja de usarse. Desde Rechazados puedes **Validar** más tarde si cambias de criterio.
- **Eliminar:** borra la entrada del todo (pide confirmación). Acción irreversible.

En **Validados**, también puedes **Rechazar** una entrada ya publicada si deja de ser correcta.

## VALIDAR ES PUBLICAR

> **Lo que validas se sirve literal a quien pregunte algo equivalente**, con el sello «Respuesta validada por el equipo». **Ningún modelo reescribe ni revisa** ese texto en el momento de la respuesta.

Validar equivale a decir: «Este procedimiento lo respaldo yo, con mi nombre de administrador asociado a la validación.»

### Checklist antes de pulsar Validar

1. **¿El procedimiento es real y está verificado?** Comprueba contra la infraestructura (Portainer, SSH, consola del producto). No valides de memoria ni porque «suena bien».

2. **¿La pregunta almacenada refleja lo que la gente preguntará?** Si el compañero escribió mal o muy en concreto, **edita la pregunta** en el panel para una formulación más natural («¿Cómo instalo el agente Zabbix en Linux?»). Al cambiar solo la pregunta, el sistema **recalcula automáticamente** la coincidencia con futuras consultas. Cambiar la respuesta no afecta a esa coincidencia.

3. **¿La respuesta es autocontenida?** Sin prefijos del tipo «la respuesta correcta es:», sin referencias a «como dije arriba» ni meta-comentarios sobre la IA.

4. **¿Formato correcto?** Comandos en bloques ```bash, pasos como **Paso N.**, nombres de ficheros y paquetes en código si llevan `_` o caracteres especiales. Evita listas `1.` pegadas a bloques de código.

5. **¿Es conocimiento estable?** Si caduca en semanas, **no lo valides aquí**: actualiza la wiki. El backend admite fechas de validez (`valid_until`), pero la pantalla actual no las edita; lo habitual es no validar contenido efímero.

## Rechazar frente a eliminar

**Rechazar** mantiene el historial en la pestaña Rechazados, conserva la trazabilidad (quién propuso qué, qué respondió el sistema) y permite **validar de nuevo** tras editar. Es la opción por defecto cuando la idea es mala o prematura pero quieres conservar el contexto.

**Eliminar** borra la fila. Las conversaciones antiguas que citaron esa entrada pueden **perder la cita enlazada** (el identificador queda huérfano y ya no se resuelve a un texto). Usa eliminar solo para entradas creadas por error, duplicadas o con datos sensibles que no deban permanecer en base de datos.

En caso de duda, **rechaza**; no elimines.

## Editar entradas

**Editar la respuesta** es seguro en cualquier estado: corrige typos, añade un paso, mejora el markdown. No cambia cómo se empareja la pregunta con las consultas nuevas.

**Editar la pregunta** también es seguro: tras guardar, el sistema **recalcula el emparejamiento** (embedding) solo con el nuevo texto de la pregunta. Hazlo cuando veas que nadie preguntará exactamente como quedó registrado en el chat.

En **Pendientes**, conviene editar antes de validar. En **Validados**, edita si descubres un error; no hace falta rechazar y volver a crear la entrada.

## Flujo resumido

1. Un compañero recibe una mala respuesta → 👎 + corrección → **Pendiente**.
2. El administrador revisa, edita si hace falta, comprueba el checklist → **Validar**.
3. Otro compañero (o el mismo, en otra conversación) hace una pregunta similar → respuesta validada en segundos, con badge verde.

El feedback 👍 y el 👎 sin texto ayudan a medir calidad; solo el 👎 **con corrección** alimenta la cola de conocimiento validado. Mantén la wiki al día para lo volátil y reserva las validaciones para procedimientos que el equipo quiera fijar con garantía humana.
