import sys
import json
from datetime import datetime, timezone
from typing import Any

def send_to_ts(packet_type: str, data: dict) -> None:
    data = {
        "type": packet_type,
        "data": data
    }

    sys.stdout.write(json.dumps(data) + "\n")
    sys.stdout.flush()

def log_debug(message: str) -> None:
    sys.stderr.write(f"INFO|{message}")
    sys.stderr.flush()


def calculate_cpu_percent(stats: dict[str, Any]) -> float:
    cpu_stats = stats.get("cpu_stats", {})
    precpu_stats = stats.get("precpu_stats", {})

    cpu_delta = cpu_stats.get("cpu_usage", {}).get("total_usage", 0) - precpu_stats.get("cpu_usage", {}).get("total_usage", 0)

    system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get("system_cpu_usage", 0)

    online_cpus = cpu_stats.get("online_cpus", len(cpu_stats.get("cpu_usage", {}).get("percpu_usage", [])))
    if online_cpus == 0:
        online_cpus = 1

    if system_delta > 0 and cpu_delta > 0:
        cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0
        return round(cpu_percent, 2)
    return 0.0

def calculate_memory_percent(stats: dict[str, Any]) -> float:
    mem_stats = stats.get("memory_stats", {})

    usage = mem_stats.get("usage", 0)

    stats_details = mem_stats.get("stats", {})
    cache = stats_details.get("inactive_file", 0)

    used_memory = usage - cache

    limit = mem_stats.get("limit", 0)

    if limit > 0:
        mem_percent = (used_memory / limit) * 100.0
        return round(mem_percent, 2)
    return 0.0

def format_uptime_sec(started_at_str: str) -> int:
    clean_date = started_at_str[:26] + "Z" if "." in started_at_str else started_at_str

    started_at = datetime.strptime(clean_date, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
    uptime = (datetime.now(timezone.utc) - started_at).total_seconds()

    return int(uptime)