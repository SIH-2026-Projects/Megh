import logging
import time
import uuid
from contextvars import ContextVar
from fastapi import Request

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("megh")

async def request_context(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request_id_ctx.set(rid)
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    response.headers["x-response-time-ms"] = f"{(time.perf_counter()-start)*1000:.1f}"
    return response
