from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import asyncio

security = HTTPBearer()


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token with user service and return username"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://user-service:8080/api/users/validate",
                headers={"Authorization": f"Bearer {credentials.credentials}"}
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("valid"):
                    return data.get("username")

            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Token validation failed")
