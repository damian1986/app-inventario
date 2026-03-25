from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException
from app import models, schemas
from typing import Optional

async def get_productos(db: AsyncSession, skip: int = 0, limit: int = 100):
    stmt = select(models.Producto).order_by(models.Producto.nombre).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

async def get_all_productos(db: AsyncSession):
    # Usado internamente para reportes u operaciones que necesiten todos
    stmt = select(models.Producto).order_by(models.Producto.nombre)
    res = await db.execute(stmt)
    return res.scalars().all()

async def crear_producto(db: AsyncSession, data: schemas.ProductoCreate):
    p = models.Producto(**data.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    if p.qty > 0:
        mov = models.Movimiento(tipo="entrada", producto_id=p.id, producto_nombre=p.nombre,
                                qty=p.qty, canal="Inventario inicial")
        db.add(mov)
        await db.commit()
    return p

async def get_producto(db: AsyncSession, id: int):
    p = await db.get(models.Producto, id)
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return p

async def actualizar_producto(db: AsyncSession, id: int, data: schemas.ProductoUpdate):
    p = await get_producto(db, id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p

async def eliminar_producto(db: AsyncSession, id: int):
    p = await get_producto(db, id)
    await db.delete(p)
    await db.commit()

async def cambiar_qty(db: AsyncSession, id: int, delta: int):
    p = await get_producto(db, id)
    p.qty = max(0, p.qty + delta)
    mov = models.Movimiento(tipo="entrada" if delta > 0 else "ajuste",
                            producto_id=p.id, producto_nombre=p.nombre,
                            qty=abs(delta), canal="Ajuste rápido")
    db.add(mov)
    await db.commit()
    await db.refresh(p)
    return p

async def registrar_venta(db: AsyncSession, data: schemas.VentaRequest):
    p = await get_producto(db, data.producto_id)
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

async def ajustar_inventario(db: AsyncSession, id: int, data: schemas.AjusteRequest):
    p = await get_producto(db, id)
    diff = data.nueva_qty - p.qty
    p.qty = data.nueva_qty
    mov = models.Movimiento(tipo="entrada" if diff >= 0 else "ajuste",
                            producto_id=p.id, producto_nombre=p.nombre,
                            qty=abs(diff), canal=data.motivo, notas=data.notas)
    db.add(mov)
    await db.commit()
    await db.refresh(mov)
    return mov

async def get_movimientos(db: AsyncSession, tipo: Optional[str] = None, skip: int = 0, limit: int = 200):
    stmt = select(models.Movimiento).order_by(models.Movimiento.fecha.desc())
    if tipo:
        stmt = stmt.filter(models.Movimiento.tipo == tipo)
    stmt = stmt.offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

async def get_all_ventas(db: AsyncSession):
    stmt = select(models.Movimiento).filter(models.Movimiento.tipo == "venta")
    res = await db.execute(stmt)
    return res.scalars().all()
