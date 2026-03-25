from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base

class Producto(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    sku = Column(String(100), default="")
    categoria = Column(String(100), default="Otro")
    qty = Column(Integer, default=0)
    min_stock = Column(Integer, default=5)
    costo = Column(Float, default=0)
    venta = Column(Float, default=0)
    variantes = Column(JSON, default=list)
    creado = Column(DateTime(timezone=True), server_default=func.now())
    actualizado = Column(DateTime(timezone=True), onupdate=func.now())

class Movimiento(Base):
    __tablename__ = "movimientos"
    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(50), nullable=False)   # venta | entrada | ajuste
    producto_id = Column(Integer, nullable=True)
    producto_nombre = Column(String(200))
    variante = Column(String(200), default="")
    qty = Column(Integer)
    precio = Column(Float, default=0)
    canal = Column(String(100), default="")
    notas = Column(Text, default="")
    fecha = Column(DateTime(timezone=True), server_default=func.now())
