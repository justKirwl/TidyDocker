import sys
import json
import traceback
import asyncio
import aiodocker

from core.dispatcher import dispatch
from core.protocol import send_to_ts, log_debug

import services.system_service
import services.docker_service

async def connect_stdin():
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    return reader

async def main():
    log_debug("Backend initialized, ready to work...")

    client = aiodocker.Docker()
    ctx = {
        "docker": client
    }

    try:
        reader = await connect_stdin()
        while True:
            line_bytes = await reader.readline()
            if not line_bytes:
                break

            line = line_bytes.decode().strip()
            if not line:
                continue

            try:
                packet = json.loads(line)
                command = packet.get("command")
                payload = packet.get("payload", {})

                result = await dispatch(command, payload, ctx)
                send_to_ts(**result)
            except json.JSONDecodeError:
                log_debug(f"Cannot decode given payload: {payload}")
                send_to_ts("error", {"msg": "Invalid JSON format sent to Python"})
    except KeyboardInterrupt:
        log_debug("Keyboard interrupted, performing exit..")
    except Exception:
        log_debug(f"Unknown error occured: {traceback.format_exc()}")
        send_to_ts("error", {"msg": "Unknown server error occured."})
    finally:
        log_debug("Closing docker client...")
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())