"""
Generador automático de SKU.

Formato Playeras:
  Adulto Caballero : PA-CABALLERO-{COLOR}-C300-{TALLA}   ej: PA-CABALLERO-JADE-C300-S
  Adulto Dama      : PA-DAMA-{COLOR}-D300-{TALLA}        ej: PA-DAMA-JADE-D300-M
  Joven            : PJ-UNISEX-{COLOR}-J300-{TALLA}      ej: PJ-UNISEX-JADE-J300-XL
  Niño             : PN-UNISEX-{COLOR}-N300-{TALLA}      ej: PN-UNISEX-JADE-N300-L
  Bebé             : PB-UNISEX-{COLOR}-B300-{TALLA}      ej: PB-UNISEX-JADE-B300-M

Otras categorías:
  MDF Láser : MDF-{NNN}    ej: MDF-001
  3D Print  : 3D-{NNN}     ej: 3D-001
  Otro      : PRD-{NNN}    ej: PRD-001
"""

import re

# ── Segmentos ───────────────────────────────────────────────────
# Cada entrada: keyword -> (prefijo_seg, etiqueta, codigo_300)
_SEGMENTOS = {
    # Adulto Caballero
    "caballero":  ("A", "CABALLERO", "C300"),
    "hombre":     ("A", "CABALLERO", "C300"),
    "varonil":    ("A", "CABALLERO", "C300"),
    "masculino":  ("A", "CABALLERO", "C300"),
    # Adulto Dama
    "dama":       ("A", "DAMA",      "D300"),
    "mujer":      ("A", "DAMA",      "D300"),
    "femenil":    ("A", "DAMA",      "D300"),
    "femenino":   ("A", "DAMA",      "D300"),
    # Joven
    "joven":      ("J", "UNISEX",    "J300"),
    "juvenil":    ("J", "UNISEX",    "J300"),
    "teen":       ("J", "UNISEX",    "J300"),
    # Niño
    "niño":       ("N", "UNISEX",    "N300"),
    "nino":       ("N", "UNISEX",    "N300"),
    "infantil":   ("N", "UNISEX",    "N300"),
    "kids":       ("N", "UNISEX",    "N300"),
    # Bebé
    "bebe":       ("B", "UNISEX",    "B300"),
    "bebé":       ("B", "UNISEX",    "B300"),
    "baby":       ("B", "UNISEX",    "B300"),
}

# Tallas en orden de mayor a menor para detectar la más larga primero
_TALLAS = ["XXXL", "XXL", "XL", "XS",
           "18-24M", "12-18M", "9-12M", "6-9M", "3-6M", "0-3M",
           "16", "14", "12", "10", "8", "6", "4", "2",
           "S", "M", "L"]

# Prefijos para categorías sin segmento
_PREFIJOS = {
    "MDF Láser": "MDF",
    "3D Print":  "3D",
    "Otro":      "PRD",
    "Hoodies":   "H",   # se ampliará con el mismo esquema que Playeras en el futuro
}


def _detectar_segmento(nombre: str):
    """Retorna (prefijo_seg, etiqueta, codigo_300) según keywords en el nombre."""
    texto = nombre.lower()
    for keyword, datos in _SEGMENTOS.items():
        if keyword in texto:
            return datos
    # Default: Adulto Caballero
    return ("A", "CABALLERO", "C300")


def _detectar_color(nombre: str) -> str:
    """
    Extrae el color del nombre del producto.
    Estrategia: toma la última palabra en mayúsculas o la última palabra
    que no sea una talla ni palabra reservada.
    """
    palabras_reservadas = {
        "playera", "playeras", "hoodie", "hoodies", "sudadera", "sudaderas",
        "adulto", "adultos", "caballero", "dama", "joven", "jovenes",
        "niño", "nino", "bebe", "bebé", "baby", "manga", "corta", "larga",
        "cuello", "redondo", "v", "premium", "básica", "basica",
        "hombre", "mujer", "unisex", "kids", "teen",
    }
    tallas_lower = {t.lower() for t in _TALLAS}

    palabras = nombre.split()
    for palabra in reversed(palabras):
        limpia = re.sub(r"[^a-zá-úüñA-ZÁ-ÚÜÑ]", "", palabra).lower()
        if limpia and limpia not in palabras_reservadas and limpia not in tallas_lower:
            return limpia.upper()
    return "COLOR"


def _detectar_talla(variantes: list) -> str:
    """Extrae la primera talla reconocida de la lista de variantes."""
    texto = " ".join(variantes).upper()
    for talla in _TALLAS:
        if re.search(rf"(?<![A-Z0-9]){re.escape(talla)}(?![A-Z0-9])", texto):
            return talla
    return "UT"  # Talla única / no detectada


def generar_sku(
    categoria: str,
    nombre: str,
    variantes: list,
    contador: int = 1,
) -> str:
    """
    Genera el SKU automático según categoría.

    Playeras:
      PA-CABALLERO-{COLOR}-C300-{TALLA}
      PA-DAMA-{COLOR}-D300-{TALLA}
      PJ-UNISEX-{COLOR}-J300-{TALLA}
      PN-UNISEX-{COLOR}-N300-{TALLA}
      PB-UNISEX-{COLOR}-B300-{TALLA}

    Otras categorías:
      MDF-{NNN} | 3D-{NNN} | PRD-{NNN}
    """
    if categoria == "Playeras":
        prefijo_seg, etiqueta, codigo = _detectar_segmento(nombre)
        color = _detectar_color(nombre)
        talla = _detectar_talla(variantes)
        return f"P{prefijo_seg}-{etiqueta}-{color}-{codigo}-{talla}"

    if categoria in _PREFIJOS:
        prefijo = _PREFIJOS[categoria]
        return f"{prefijo}-{contador:03d}"

    return f"PRD-{contador:03d}"
