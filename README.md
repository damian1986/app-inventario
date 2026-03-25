# 📦 Inventario Pro — Docker Edition

## Stack
- **Frontend**: HTML/CSS/JS puro servido por Nginx
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Base de datos**: PostgreSQL 16
- **Orquestación**: Docker Compose

## 🚀 Inicio rápido

### Requisitos
- Docker Desktop instalado y corriendo
- Docker Compose v2+

### Levantar la app

```bash
# 1. Clona o descarga este proyecto
cd inventario_app

# 2. Levanta todos los servicios
docker compose up --build

# 3. Abre en tu navegador:
#    Frontend:  http://localhost:3000
#    API Docs:  http://localhost:8000/docs
#    API:       http://localhost:8000
```

### Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f

# Detener sin borrar datos
docker compose stop

# Detener Y borrar contenedores (datos se conservan en volumen)
docker compose down

# ⚠️ Borrar TODO incluyendo la base de datos
docker compose down -v
```

## 📁 Estructura del proyecto

```
inventario_app/
├── docker-compose.yml       # Orquestación de servicios
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py          # Endpoints FastAPI
│       ├── models.py        # Tablas PostgreSQL
│       ├── schemas.py       # Validación de datos
│       └── database.py      # Conexión a BD
└── frontend/
    └── index.html           # UI completa
```

## 🔗 Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /productos | Listar todos |
| POST | /productos | Crear producto |
| PUT | /productos/{id} | Editar producto |
| DELETE | /productos/{id} | Eliminar |
| PATCH | /productos/{id}/qty?delta=N | Ajuste rápido |
| POST | /productos/{id}/ajuste | Ajuste formal |
| POST | /ventas | Registrar venta |
| GET | /movimientos | Historial |
| GET | /reporte | Resumen de ventas |
| GET | /docs | Swagger UI automático |
