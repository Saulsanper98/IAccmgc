# Wiki.js API — Instancia CCMGC

> Generado automáticamente el 2026-07-02T16:39:52.450816+00:00
> Instancia: `https://wiki.movilidadgc.org`

## Endpoint

- **GraphQL:** `https://wiki.movilidadgc.org/graphql`
- **Autenticación:** `Authorization: Bearer <WIKIJS_API_KEY>`
- **SSL:** certificado interno; usar `WIKIJS_SSL_VERIFY=false` en desarrollo si aplica

## Campos raíz disponibles

- `analytics`
- `assets`
- `authentication`
- `comments`
- `contribute`
- `groups`
- `localization`
- `logging`
- `mail`
- `navigation`
- `pages`
- `rendering`
- `search`
- `site`
- `storage`
- `system`
- `theming`
- `users`

## Estadísticas de páginas

- Total páginas listadas: **133**
- Páginas en español (`es`): **133**
- Locales detectados: `es`

## Tipo `PageQuery`

```json
{
  "name": "PageQuery",
  "fields": [
    {
      "name": "history",
      "args": [
        {
          "name": "id",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Int",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "offsetPage",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "offsetSize",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        }
      ],
      "type": {
        "name": "PageHistoryResult",
        "kind": "OBJECT",
        "ofType": null
      }
    },
    {
      "name": "version",
      "args": [
        {
          "name": "pageId",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Int",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "versionId",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Int",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": "PageVersion",
        "kind": "OBJECT",
        "ofType": null
      }
    },
    {
      "name": "search",
      "args": [
        {
          "name": "query",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "path",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "locale",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "PageSearchResponse",
          "kind": "OBJECT",
          "ofType": null
        }
      }
    },
    {
      "name": "list",
      "args": [
        {
          "name": "limit",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "orderBy",
          "type": {
            "name": "PageOrderBy",
            "kind": "ENUM",
            "ofType": null
          }
        },
        {
          "name": "orderByDirection",
          "type": {
            "name": "PageOrderByDirection",
            "kind": "ENUM",
            "ofType": null
          }
        },
        {
          "name": "tags",
          "type": {
            "name": null,
            "kind": "LIST",
            "ofType": {
              "name": null,
              "kind": "NON_NULL"
            }
          }
        },
        {
          "name": "locale",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "creatorId",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "authorId",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": null,
          "kind": "LIST",
          "ofType": {
            "name": null,
            "kind": "NON_NULL"
          }
        }
      }
    },
    {
      "name": "single",
      "args": [
        {
          "name": "id",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Int",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": "Page",
        "kind": "OBJECT",
        "ofType": null
      }
    },
    {
      "name": "singleByPath",
      "args": [
        {
          "name": "path",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "locale",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": "Page",
        "kind": "OBJECT",
        "ofType": null
      }
    },
    {
      "name": "tags",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": null,
          "kind": "LIST",
          "ofType": {
            "name": "PageTag",
            "kind": "OBJECT"
          }
        }
      }
    },
    {
      "name": "searchTags",
      "args": [
        {
          "name": "query",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": null,
          "kind": "LIST",
          "ofType": {
            "name": "String",
            "kind": "SCALAR"
          }
        }
      }
    },
    {
      "name": "tree",
      "args": [
        {
          "name": "path",
          "type": {
            "name": "String",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "parent",
          "type": {
            "name": "Int",
            "kind": "SCALAR",
            "ofType": null
          }
        },
        {
          "name": "mode",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "PageTreeMode",
              "kind": "ENUM"
            }
          }
        },
        {
          "name": "locale",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "includeAncestors",
          "type": {
            "name": "Boolean",
            "kind": "SCALAR",
            "ofType": null
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "LIST",
        "ofType": {
          "name": "PageTreeItem",
          "kind": "OBJECT",
          "ofType": null
        }
      }
    },
    {
      "name": "links",
      "args": [
        {
          "name": "locale",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "String",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "LIST",
        "ofType": {
          "name": "PageLinkItem",
          "kind": "OBJECT",
          "ofType": null
        }
      }
    },
    {
      "name": "checkConflicts",
      "args": [
        {
          "name": "id",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Int",
              "kind": "SCALAR"
            }
          }
        },
        {
          "name": "checkoutDate",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Date",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Boolean",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "conflictLatest",
      "args": [
        {
          "name": "id",
          "type": {
            "name": null,
            "kind": "NON_NULL",
            "ofType": {
              "name": "Int",
              "kind": "SCALAR"
            }
          }
        }
      ],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "PageConflictLatest",
          "kind": "OBJECT",
          "ofType": null
        }
      }
    }
  ]
}
```

## Tipo `PageListItem` (pages.list)

```json
{
  "name": "PageListItem",
  "fields": [
    {
      "name": "id",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Int",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "path",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "locale",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "title",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "description",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "contentType",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "isPublished",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Boolean",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "isPrivate",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Boolean",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "privateNS",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "createdAt",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Date",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "updatedAt",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Date",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "tags",
      "args": [],
      "type": {
        "name": null,
        "kind": "LIST",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    }
  ]
}
```

## Tipo `Page` (pages.single)

```json
{
  "name": "Page",
  "fields": [
    {
      "name": "id",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Int",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "path",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "hash",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "title",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "description",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "isPrivate",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Boolean",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "isPublished",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Boolean",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "privateNS",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "publishStartDate",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Date",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "publishEndDate",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Date",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "tags",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": null,
          "kind": "LIST",
          "ofType": {
            "name": "PageTag",
            "kind": "OBJECT"
          }
        }
      }
    },
    {
      "name": "content",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "render",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "toc",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "contentType",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "createdAt",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Date",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "updatedAt",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Date",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "editor",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "locale",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "scriptCss",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "scriptJs",
      "args": [],
      "type": {
        "name": "String",
        "kind": "SCALAR",
        "ofType": null
      }
    },
    {
      "name": "authorId",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Int",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "authorName",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "authorEmail",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "creatorId",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "Int",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "creatorName",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    },
    {
      "name": "creatorEmail",
      "args": [],
      "type": {
        "name": null,
        "kind": "NON_NULL",
        "ofType": {
          "name": "String",
          "kind": "SCALAR",
          "ofType": null
        }
      }
    }
  ]
}
```

## Muestra `pages.list`

```json
[
  {
    "id": 1,
    "path": "sistemas/almacenamiento",
    "title": "2.Almacenamiento e Infraestructura",
    "locale": "es",
    "updatedAt": "2026-06-21T07:18:43.511Z"
  },
  {
    "id": 2,
    "path": "sistemas",
    "title": "Técnicos de Sistemas",
    "locale": "es",
    "updatedAt": "2026-06-29T08:08:48.386Z"
  },
  {
    "id": 3,
    "path": "sistemas/vmware",
    "title": "3.Virtualización VMware vSphere",
    "locale": "es",
    "updatedAt": "2026-06-29T11:43:42.439Z"
  },
  {
    "id": 4,
    "path": "sistemas/redes",
    "title": "4.Redes y Conectividad FC",
    "locale": "es",
    "updatedAt": "2026-03-22T13:40:42.366Z"
  },
  {
    "id": 5,
    "path": "sistemas/salas",
    "title": "6.Salas y Puestos Especiales",
    "locale": "es",
    "updatedAt": "2026-03-22T13:39:53.947Z"
  }
]
```

## Muestra `pages.single`

```json
{
  "id": 1,
  "path": "sistemas/almacenamiento",
  "hash": "4d8b2fad0d620e8bfc005935276cb1bbc5836eab",
  "title": "2.Almacenamiento e Infraestructura",
  "description": "Gestión de cabinas DM5100F, DE6400F y unidades NAS QNAP/Synology.",
  "isPrivate": false,
  "isPublished": true,
  "createdAt": "2026-03-22T12:38:39.932Z",
  "updatedAt": "2026-06-21T07:18:43.511Z",
  "locale": "es",
  "contentType": "markdown",
  "tags": [
    {
      "tag": "almacenamiento"
    },
    {
      "tag": "lenovo"
    },
    {
      "tag": "qnap"
    },
    {
      "tag": "synology"
    },
    {
      "tag": "nas"
    },
    {
      "tag": "san"
    }
  ],
  "authorName": "Técnicos de sistemas",
  "content_preview": "# 📊 Almacenamiento e Infraestructura\n\n## 📂 Almacenamiento Centralizado\n\n### 1. Cabinas de Discos Principales (Nivel Empresarial)\n\n**DM5100F (NetApp ONTAP)** > ℹ️ **Documentación Oficial NetApp** > [Acceder a la guía ONTAP](https://docs.netapp.com/) *(Actualizar con URL interna/directa)*\n\n**DE6400F (Lenovo SAN)** > ℹ️ **Documentación Lenovo DE Series** > [Acceder al centro de soporte Lenovo](https:",
  "content_length": 1254
}
```

## Queries usadas por WikiBridge

### Listado completo

```graphql
{
  pages {
    list {
      id
      path
      title
      locale
      updatedAt
    }
  }
}
```

### Página individual

```graphql
query PageSingle($id: Int!) {
  pages {
    single(id: $id) {
      id
      path
      hash
      title
      description
      isPrivate
      isPublished
      createdAt
      updatedAt
      locale
      contentType
      content
      tags { tag }
      authorName
    }
  }
}
```

## Notas de implementación

- La ingesta filtra por `locale = "es"` según configuración del proyecto.
- Sync incremental compara `updatedAt` y `hash` de Wiki.js con `content_hash` local.
- Páginas ausentes en listados posteriores se marcan `is_deleted = true`.
- Deep-link a wiki: `{WIKIJS_URL}/{path}`
