import aiodocker
import asyncio
import traceback

from core.dispatcher import register
from core.protocol import calculate_cpu_percent, calculate_memory_percent, format_uptime_sec, send_to_ts, log_debug

CONTAINERS = {}
CONTAINER_METRICS_TASKS = {}

@register("containers.list")
async def containers_list(payload, ctx):
    client = ctx["docker"]
    data = []
    for container in await client.containers.list():
        CONTAINERS[container.id] = container
        stats = await container.stats(stream=False)
        stats = stats[0]
        details = await container.show()
        log_debug(stats["memory_stats"])
        data.append({
            "id": container.id,
            "name": container["Name"],
            "image": container["Config"]["Image"],
            "status": container["State"]["Status"],
            "ports": "->".join([p["HostPort"] for port in container["HostConfig"]["PortBindings"].values() for p in port]),
            "cpu": calculate_cpu_percent(stats),
            "cpuHistory": [], # TODO: deal with cpuHistory
            "memUsedBytes": calculate_memory_percent(stats),
            "memLimitBytes": stats.get("memory_stats", {}).get("limit", 0),
            "uptimeSec": format_uptime_sec(details["State"]["StartedAt"]) if details["State"]["Running"] else None,
            "netRxKbs": round(stats.get("networks", {}).get("eth0", {}).get("rx_bytes", 0) / 1024),
            "netTxKbs": round(stats.get("networks", {}).get("eth0", {}).get("tx_bytes", 0) / 1024)
        })
    return {"packet_type": "containers", "data": data}

@register("containers.metrics")
async def containers_metrics(payload, ctx):
    for container_id, container in CONTAINERS.items():
        task = asyncio.create_task(get_metrics(container))
        CONTAINER_METRICS_TASKS[container_id] = task
    return {"packet_type": "success", "data": {}}

async def get_metrics(container: aiodocker.docker.DockerContainer):
    while True:
        try:
            stats = await container.stats(stream=False)
            stats = stats[0]
            details = await container.show()
            payload = {
                "id": container.id,
                "cpu": calculate_cpu_percent(stats),
                "memUsedBytes": calculate_memory_percent(stats),
                "memLimitBytes": stats.get("memory_stats", {}).get("limit", 0),
                "uptimeSec": format_uptime_sec(details["State"]["StartedAt"]) if details["State"]["Running"] else None,
                "netRxKbs": round(stats.get("networks", {}).get("eth0", {}).get("rx_bytes", 0) / 1024),
                "netTxKbs": round(stats.get("networks", {}).get("eth0", {}).get("tx_bytes", 0) / 1024)
            }

            send_to_ts("container.metrics", payload)
            await asyncio.sleep(0.7)
        except asyncio.CancelledError:
            log_debug(f"metrics task cancelled for {container.id}")
            raise

        except Exception:
            log_debug(f"metrics failed for {container.id}: {traceback.format_exc()}")
            await asyncio.sleep(3)