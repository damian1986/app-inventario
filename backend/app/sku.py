"""
Generador automático de SKU para el inventario.

Formatos por categoría:
  Playeras  → P-{SEGMENTO}-300-{TALLA}    ej: P-DAMA-300-M
  Hoodies   → H-{SEGMENTO}-300-{TALLA}    ej: H-CABALLERO-300-XL
  MDF Láser → MDF-{NNN}                   ej: MDF-001
  3D Print  → 3D-{NNN}                    ej: 3D-001
  Otro      → PRD-{NNN}                   ej: PRD-001

Segmentos válidos (se detectan desde el nombre del producto):
  DAMA, CABALLERO, JOVEN, NINO, BEBE

Tallas válidas (se detectan desde las variantes):
  Ropa : XS, S, M, L, XL, XXL, XXXL
  Bebé : 0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M
  Niño : 2, 4, 6, 8, 10, 12, 14, 16
"""

import re

# ── Mapeo de palabras clave → segmento ──────────────────────────────────────
_SEGMENTOS = {
    "dama":      "DAMA",
    "mujer":     "DAMA",
    "femenil":   "DAMA",
    "caballero": "CABALLERO",
    "hombre":    "CABALLERO",
    "varonil":   "CABALLERO",
    "masculino": "CABALLERO",
    "joven":     "JOVEN",
    "juvenil":   "JOVEN",
    "teen":      "JOVEN",
    "niño":      "NINO",
    "nino":      "NINO",
    "infantil":  "NINO",
    "kids":      "NINO",
    "bebe":      "BEBE",
    "bebé":      "BEBE",
    "baby":      "BEBE",
}

# Tallas estándar en orden para detectar la primera disponible
_TALLAS_ROPA  = ["XXXL", "XXL", "XL", "XS", "S", "M", "L"]
_TALLAS_BEBE  = ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M"]
_TALLAS_NINO  = ["16", "14", "12", "10", "8", "6", "4", "2"]
_TODAS_TALLAS = _TALLAS_ROPA + _TALLAS_BEBE + _TALLAS_NINO

# Prefijos por categoría para SKUs secuenciales
_PREFIJOS = {
    "MDF Láser": "MDF",
    "3D Print":  "3D",
    "Otro":      "PRD",
}


def _detectar_segmento(nombre: str) -> str:
    """Detecta el segmento a partir del nombre del producto."""
    nombre_lower = nombre.lower()
    for keyword, segmento in _SEGMENTOS.items():
        if keyword in nombre_lower:
            return segmento
    return "UNISEX"


def _detectar_talla(variantes: list[str]) -> str:
    """Extrae la primera talla reconocida de la lista de variantes."""
    texto = " ".join(variantes).upper()
    for talla in _TODAS_TALLAS:
        # Busca la talla como palabra completa (evita que 'S' coincida en 'XS')
        if re.search(rf"(?<![A-Z0-9]){re.escape(talla)}(?![A-Z0-9])", texto):
            return talla
    return "UT"   # "UT" = Talla única / sin detectar


def generar_sku(
    categoria: str,
    nombre: str,
    variantes: list[str],
    contador: int = 1,
) -> str:
    """
    Genera el SKU automático según la categoría.

    Args:
        categoria: Categoría del producto (Playeras, Hoodies, MDF Láser, 3D Print, Otro).
        nombre:    Nombre del producto (se usa para detectar segmento).
        variantes: Lista de variantes (se usa para detectar talla).
        contador:  Número secuencial para categorías sin segmento/talla.

    Returns:
        SKU generado como string.
    """
    if categoria in ("Playeras", "Hoodies"):
        prefijo   = "P" if categoria == "Playeras" else "H"
        segmento  = _detectar_segmento(nombre)
        talla     = _detectar_talla(variantes)
        return f"{prefijo}-{segmento}-300-{talla}"

    if categoria in _PREFIJOS:
        prefijo = _PREFIJOS[categoria]
        return f"{prefijo}-{contador:03d}"

    # Fallback genérico
    return f"PRD-{contador:03d}"
