from typing import Callable, Any

HANDLERS = {}

def register(command: str) -> Callable:
    def decorator(func) -> Callable:
        HANDLERS[command] = func
        return func
    return decorator

async def dispatch(command: str, payload: dict, ctx: dict) -> Any:
    handler = HANDLERS.get(command)
    if not handler:
        return {"packet_type": "error", "data": f"Unknown command `{command}`."}
    if bool(handler.__code__.co_flags & 0x0080):
        return await handler(payload, ctx)
    return handler(payload, ctx)