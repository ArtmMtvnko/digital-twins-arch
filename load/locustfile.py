"""Навантажувальне тестування каналу телеметрії: ступінчасте зростання частоти.

Запуск з кореня репозиторію (історик має працювати):
    locust -f load/locustfile.py --headless --csv results/locust
Кожен користувач Locust — шлюз, що публікує RATE повідомлень за секунду;
кількість шлюзів зростає за STEPS. Кожне надіслане повідомлення
записується в results/sent.csv для підрахунку втрат.
"""
import csv
import itertools
import json
import os
import time

import paho.mqtt.client as mqtt
from locust import LoadTestShape, User, constant_throughput, task

TOPIC = "pzks/station-1/telemetry"
RATE = 5                            # повідомлень за секунду на один шлюз
STEPS = [1, 2, 5, 10, 20, 40, 80]   # кількість шлюзів на кожному ступені
STEP_TIME = int(os.getenv("STEP_TIME", "60"))   # тривалість ступеня, с

SEQ = itertools.count(1_000_000)    # номери не перетинаються з емулятором
LOG_FILE = open("results/sent.csv", "w", newline="")
LOG = csv.writer(LOG_FILE)
LOG.writerow(["seq", "ts", "rate"])

# Постійні валідні значення всіх 16 сигналів станції (формат пристрою)
VALUES = {"pi": 2.0, "po": 5.0, "q": 60.0, "sp": 5.0, "mode": "auto", "dry": False,
          "v1": 2.2, "n1": 2200, "w1": 9.0, "t1": 55.0, "s1": "running",
          "v2": 0.3, "n2": 0, "w2": 0.0, "t2": 25.0, "s2": "standby"}


class Gateway(User):
    wait_time = constant_throughput(RATE)

    def on_start(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.client.connect("localhost", 1883)
        self.client.loop_start()

    def on_stop(self):
        self.client.loop_stop()
        self.client.disconnect()

    @task
    def publish(self):
        msg = {"seq": next(SEQ), "ts": int(time.time() * 1000), **VALUES}
        start = time.perf_counter()
        info = self.client.publish(TOPIC, json.dumps(msg), qos=1)
        info.wait_for_publish(timeout=5)
        rate = self.environment.runner.user_count * RATE
        LOG.writerow([msg["seq"], msg["ts"], rate])
        error = None if info.is_published() else TimeoutError("немає PUBACK")
        self.environment.events.request.fire(
            request_type="MQTT", name="publish", response_length=0,
            response_time=(time.perf_counter() - start) * 1000,
            exception=error)


class Steps(LoadTestShape):
    """Ступінчасте зростання кількості шлюзів; після останнього — стоп."""

    def tick(self):
        step = int(self.get_run_time() // STEP_TIME)
        if step >= len(STEPS):
            LOG_FILE.flush()
            return None
        return STEPS[step], 100     # кількість шлюзів, швидкість запуску
