"""Перевірка узгодженості стану двійника з джерелом даних.

Запуск з кореня репозиторію після сеансу емулятора, під час якого
працював історик: python sync/consistency.py
Порівнює results/source.csv (що надіслало джерело) з історією станів
у InfluxDB і з поточним станом двійника в Ditto.
"""
import csv
import statistics

import requests
from influxdb_client import InfluxDBClient

THING = "org.pzks:station-1"
API = f"http://localhost:8090/api/2/things/{THING}"
INFLUX = {"url": "http://localhost:8086", "token": "dt-lab-token",
          "org": "pzks"}
TARGET_MS = 500                    # NFR-01: затримка синхронізації, мс
# поле пристрою → (feature, властивість моделі)
FIELDS = {
    "pi": ("station", "inletPressure"), "po": ("station", "outletPressure"),
    "q": ("station", "flow"), "sp": ("station", "setpoint"),
    "mode": ("station", "mode"), "dry": ("station", "dryRun"),
    "v1": ("pump1", "vibration"), "n1": ("pump1", "speed"),
    "w1": ("pump1", "power"), "t1": ("pump1", "bearingTemperature"),
    "s1": ("pump1", "state"),
    "v2": ("pump2", "vibration"), "n2": ("pump2", "speed"),
    "w2": ("pump2", "power"), "t2": ("pump2", "bearingTemperature"),
    "s2": ("pump2", "state"),
}


def same(src_value, value):
    """Чи збігається значення з CSV джерела зі значенням у двійнику чи історії."""
    if isinstance(value, str):                      # режим, стан насоса
        return src_value == value
    if src_value in ("True", "False"):              # сухий хід
        return float(src_value == "True") == float(value)
    return abs(float(src_value) - float(value)) < 1e-9


def source():
    with open("results/source.csv", newline="") as f:
        return {int(row["seq"]): row for row in csv.DictReader(f)}


def history(start_ms, stop_ms):
    """Стани двійника з InfluxDB за інтервал часу джерела: {seq: запис}."""
    start, stop = start_ms * 1_000_000, (stop_ms + 1) * 1_000_000
    query = f'''from(bucket: "twin")
  |> range(start: time(v: {start}), stop: time(v: {stop}))
  |> filter(fn: (r) => r._measurement == "twin_state")
  |> filter(fn: (r) => r.thing == "{THING}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")'''
    with InfluxDBClient(**INFLUX) as client:
        tables = client.query_api().query(query)
    return {int(r["seq"]): r.values for t in tables for r in t.records}


def main():
    src = source()
    stamps = [int(r["ts"]) for r in src.values()]
    hist = history(min(stamps), max(stamps))
    missing = sorted(set(src) - set(hist))
    wrong = [s for s in set(src) & set(hist)
             if not all(same(src[s][k], hist[s][f"{f}_{p}"])
                        for k, (f, p) in FIELDS.items())]
    order = sorted(hist.values(), key=lambda r: r["revision"])
    reordered = sum(1 for a, b in zip(order, order[1:]) if b["seq"] < a["seq"])
    revs = [int(r["revision"]) for r in order]
    gaps = revs[-1] - revs[0] + 1 - len(revs) if revs else 0
    twin = requests.get(API, timeout=10).json()["features"]
    last = src[max(src)]
    final_ok = all(same(last[k], twin[f]["properties"][p])
                   for k, (f, p) in FIELDS.items())
    delays = sorted(r["sync_ms"] for r in hist.values())
    latency = "немає даних"
    if delays:
        p95 = delays[max(0, round(0.95 * len(delays)) - 1)]
        verdict = "виконано" if p95 <= TARGET_MS else "НЕ виконано"
        latency = (f"{statistics.median(delays):.0f} / {p95:.0f} "
                   f"(ціль ≤ {TARGET_MS}: {verdict})")
    report = "\n".join([
        "| Перевірка | Результат |",
        "|---|---|",
        f"| Надіслано джерелом | {len(src)} |",
        f"| Є в історії двійника | {len(hist)} ({len(hist) / len(src):.1%}) |",
        f"| Втрачено (номери) | {len(missing)} {missing[:10]} |",
        f"| Розбіжність значень | {len(wrong)} |",
        f"| Позачергові оновлення | {reordered} |",
        f"| Пропущені ревізії (не дійшли до історика) | {gaps} |",
        f"| Кінцевий стан = останній відлік | {'так' if final_ok else 'НІ'} |",
        f"| Затримка синхронізації p50 / p95, мс | {latency} |",
    ])
    print(report)
    with open("results/consistency.md", "w", encoding="utf-8") as f:
        f.write(report + "\n")


if __name__ == "__main__":
    main()
