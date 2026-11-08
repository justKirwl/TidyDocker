from core.dispatcher import register

@register("ping")
def pong(payload, ctx):
    return {"packet_type": "pong", "data": {"msg": "Pong"}}

@register("core_exit")
def core_exit(payload, ctx):
    exit(0)