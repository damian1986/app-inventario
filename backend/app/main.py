from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.database import get_db, engine
from app import models, schemas

app = FastAPI(title="Inventario API", version="1.0.0")

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── PRODUCTOS ──
@app.get("/productos", response_model=List[schemas.ProductoOut])
async def listar_productos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Producto).order_by(models.Producto.nombre))
    return result.scalars().all()

@app.post("/productos", response_model=schemas.ProductoOut, status_code=201)
async def crear_producto(data: schemas.ProductoCreate, db: AsyncSession = Depends(get_db)):
    p = models.Producto(**data.model_dump())
    db.add(p)
    await db.flush()
    if p.qty > 0:
        mov = models.Movimiento(tipo="entrada", producto_id=p.id, producto_nombre=p.nombre,
                                qty=p.qty, canal="Inventario inicial")
        db.add(mov)
    await db.commit()
    await db.refresh(p)
    return p

@app.get("/productos/{id}", response_model=schemas.ProductoOut)
async def obtener_producto(id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Producto, id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return p

@app.put("/productos/{id}", response_model=schemas.ProductoOut)
async def actualizar_producto(id: int, data: schemas.ProductoUpdate, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Producto, id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p

@app.delete("/productos/{id}", status_code=204)
async def eliminar_producto(id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Producto, id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    await db.delete(p)
    await db.commit()

@app.patch("/productos/{id}/qty")
async def cambiar_qty(id: int, delta: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Producto, id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    p.qty = max(0, p.qty + delta)
    mov = models.Movimiento(tipo="entrada" if delta > 0 else "ajuste",
                            producto_id=p.id, producto_nombre=p.nombre,
                            qty=abs(delta), canal="Ajuste rápido")
    db.add(mov)
    await db.commit()
    await db.refresh(p)
    return p

# ── VENTAS ──
@app.post("/ventas", response_model=schemas.MovimientoOut, status_code=201)
async def registrar_venta(data: schemas.VentaRequest, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Producto, data.producto_id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    if data.qty > p.qty:
        raise HTTPException(400, f"Stock insuficiente (disponible: {p.qty})")
    p.qty -= data.qty
    mov = models.Movimiento(tipo="venta", producto_id=p.id, producto_nombre=p.nombre,
                            variante=data.variante, qty=data.qty, precio=data.precio,
                            canal=data.canal, notas=data.notas)
    db.add(mov)
    await db.commit()
    await db.refresh(mov)
    return mov

# ── AJUSTES ──
@app.post("/productos/{id}/ajuste", response_model=schemas.MovimientoOut)
async def ajustar_inventario(id: int, data: schemas.AjusteRequest, db: AsyncSession = Depends(get_db)):
    p = await db.get(models.Producto, id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    diff = data.nueva_qty - p.qty
    p.qty = data.nueva_qty
    mov = models.Movimiento(tipo="entrada" if diff >= 0 else "ajuste",
                            producto_id=p.id, producto_nombre=p.nombre,
                            qty=abs(diff), canal=data.motivo, notas=data.notas)
    db.add(mov)
    await db.commit()
    await db.refresh(mov)
    return mov

# ── HISTORIAL ──
@app.get("/movimientos", response_model=List[schemas.MovimientoOut])
async def listar_movimientos(tipo: str = None, db: AsyncSession = Depends(get_db)):
    stmt = select(models.Movimiento).order_by(models.Movimiento.fecha.desc())
    if tipo:
        stmt = stmt.where(models.Movimiento.tipo == tipo)
    stmt = stmt.limit(500)
    result = await db.execute(stmt)
    return result.scalars().all()

# ── REPORTE ──
@app.get("/reporte")
async def reporte(db: AsyncSession = Depends(get_db)):
    ventas_result = await db.execute(select(models.Movimiento).where(models.Movimiento.tipo == "venta"))
    ventas = ventas_result.scalars().all()
    
    productos_result = await db.execute(select(models.Producto))
    productos = productos_result.scalars().all()
    
    prod_map = {p.id: p for p in productos}
    ingresos = sum(v.precio * v.qty for v in ventas)
    costo_vendido = sum((prod_map[v.producto_id].costo if v.producto_id in prod_map else 0) * v.qty for v in ventas)
    unidades = sum(v.qty for v in ventas)
    top = {}
    for v in ventas:
        if v.producto_nombre not in top:
            top[v.producto_nombre] = {"qty": 0, "ingresos": 0, "costo": 0}
        costo = prod_map[v.producto_id].costo if v.producto_id in prod_map else 0
        top[v.producto_nombre]["qty"] += v.qty
        top[v.producto_nombre]["ingresos"] += v.precio * v.qty
        top[v.producto_nombre]["costo"] += costo * v.qty
    top_sorted = sorted(top.items(), key=lambda x: x[1]["qty"], reverse=True)
    return {
        "ingresos": ingresos,
        "costo_vendido": costo_vendido,
        "ganancia": ingresos - costo_vendido,
        "unidades": unidades,
        "top_productos": [{"nombre": k, **v} for k, v in top_sorted]
    }

@app.get("/health")
def health():
    return {"status": "ok"}
