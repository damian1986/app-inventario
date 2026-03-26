from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://inventario:inventario_secret_pwd_123@localhost:5432/inventario_db")

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(
    autocommit=False, autoflush=False, expire_on_commit=False, bind=engine, class_=AsyncSession
)
Base = declarative_base()

async def get_db():
    async with SessionLocal() as db:
        yield db
