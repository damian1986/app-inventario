from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProductoCreate(BaseModel):
    nombre: str
    sku: str = ""
    categoria: str = "Otro"
    qty: int = 0
    min_stock: int = 5
    costo: float = 0
    venta: float = 0
    variantes: List[str] = []

class ProductoUpdate(ProductoCreate):
    pass

class ProductoOut(ProductoCreate):
    id: int
    creado: Optional[datetime] = None
    class Config:
        from_attributes = True

class MovimientoCreate(BaseModel):
    tipo: str
    producto_id: Optional[int] = None
    producto_nombre: str
    variante: str = ""
    qty: int
    precio: float = 0
    canal: str = ""
    notas: str = ""

class MovimientoOut(MovimientoCreate):
    id: int
    fecha: Optional[datetime] = None
    class Config:
        from_attributes = True

class VentaRequest(BaseModel):
    producto_id: int
    variante: str = ""
    qty: int
    precio: float
    canal: str = "Venta directa"
    notas: str = ""

class AjusteRequest(BaseModel):
    nueva_qty: int
    motivo: str = "Ajuste manual"
    notas: str = ""
