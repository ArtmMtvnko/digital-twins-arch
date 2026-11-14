"""Емулятор датчиків насосної станції: публікує телеметрію за MQTT.

Запуск з кореня репозиторію: python emulator/emulator.py --rate 1
Кожне повідомлення записується також у results/source.csv — це «істина
джерела», з якою порівнюють стан двійника.

Формат пристрою — короткі назви полів, як у реальних шлюзах:
станція: pi, po, q, sp, mode, dry; насоси Н1 і Н2: v, n, w, t, s з номером 1 або 2.
"""
import argparse
import csv
import json
import math
import random
import time

import paho.mqtt.client as mqtt

BROKER, PORT = "localhost", 1883


def load_at(t):
    """Відносне навантаження станції: повільна зміна розбору води (період 10 хв)."""
    return 0.6 + 0.25 * math.sin(2 * math.pi * t / 600)


def sample(t):
    """Один відлік усіх сигналів станції в момент t, с (формат пристрою)."""
    g = random.gauss
    load = load_at(t)
    t10 = t - t % 10                      # температура оновлюється раз на 10 с (0,1 Гц)
    return {
        # вузли станції
        "pi": round(2.0 - 0.3 * (load - 0.6) + g(0, 0.05), 3),   # тиск на вході, бар
        "po": round(5.0 + g(0, 0.04), 3),                         # тиск на виході, бар
        "q": round(80 * load + g(0, 1.5), 2),                     # витрата, м³/год
        "sp": 5.0,                                                # фактична уставка, бар
        "mode": "auto",                                           # режим станції
        "dry": False,                                             # сухий хід
        # Н1 — робочий
        "v1": round(abs(2.2 + g(0, 0.15)), 3),        # максимум СКЗ вібрації за 1 с, мм/с
        "n1": round(2200 + 900 * (load - 0.6) + g(0, 10)),        # оберти, об/хв
        "w1": round(9 + 8 * (load - 0.6) + g(0, 0.2), 2),         # потужність, кВт
        "t1": round(50 + 10 * load_at(t10), 1),                   # температура підшипника, °C
        "s1": "running",
        # Н2 — у резерві
        "v2": round(abs(0.3 + g(0, 0.05)), 3),        # фонова вібрація від сусіднього насоса
        "n2": 0,
        "w2": 0.0,
        "t2": 25.0,                                               # температура приміщення
        "s2": "standby",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="station-1", help="ім’я двійника")
    ap.add_argument("--rate", type=float, default=1.0,
                    help="повідомлень за секунду")
    ap.add_argument("--count", type=int, default=0,
                    help="кількість повідомлень; 0 — без обмеження")
    args = ap.parse_args()

    topic = f"pzks/{args.name}/telemetry"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(BROKER, PORT)
    client.loop_start()
    print(f"Публікація в {topic}, {args.rate} повідомл./с. Ctrl+C — зупинка")

    period, seq, next_time = 1 / args.rate, 0, time.time()
    with open("results/source.csv", "w", newline="") as f:
        log = None
        try:
            while args.count == 0 or seq < args.count:
                seq += 1
                now = time.time()
                msg = {"seq": seq, "ts": int(now * 1000), **sample(now)}
                client.publish(topic, json.dumps(msg), qos=1)
                if log is None:
                    log = csv.writer(f)
                    log.writerow(msg.keys())
                log.writerow(msg.values())
                next_time += period
                time.sleep(max(0.0, next_time - time.time()))
        except KeyboardInterrupt:
            pass
    client.loop_stop()
    client.disconnect()
    print(f"Надіслано повідомлень: {seq}")


if __name__ == "__main__":
    main()
