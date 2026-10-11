"""Модель маршруту «датчик — подання» платформи двійника НСПТ:
наскрізна затримка, частка кожної ділянки й оцінка гіпотези Г-01."""

# Послідовні ділянки базового маршруту, мс (паралельні гілки не входять).
# Третій елемент: True, якщо ділянка входить у затримку синхронізації (NFR-01).
BASE = [
    ("Датчик → ПЛК",               20, True),
    ("ПЛК → шлюз",                 15, True),
    ("Шлюз → брокер",              45, True),
    ("Брокер → синхронізація",     10, True),
    ("Синхронізація → Ditto",      80, True),
    ("Ditto → веб-застосунок",     40, False),
    ("Веб-застосунок → екран",     50, False),
]

# Гіпотеза Г-01: Ditto сам підписується на брокер (вбудоване MQTT-з'єднання),
# валідацію перенесено на шлюз — ділянки «Брокер → синхронізація» і
# «Синхронізація → Ditto» замінює одна ділянка «Брокер → Ditto».
HYPOTHESIS = [
    ("Датчик → ПЛК",               20, True),
    ("ПЛК → шлюз",                 15, True),
    ("Шлюз → брокер",              50, True),   # +5 мс: валідація на шлюзі
    ("Брокер → Ditto",             45, True),
    ("Ditto → веб-застосунок",     40, False),
    ("Веб-застосунок → екран",     50, False),
]

TARGET_SYNC = 500    # NFR-01, мс
TARGET_E2E = 1000    # NFR-02, мс


def status(value, target):
    return "виконано" if value <= target else "НЕ виконано"


def report(title, route):
    total = sum(ms for _, ms, _ in route)
    sync = sum(ms for _, ms, in_sync in route if in_sync)
    print(title)
    for name, ms, _ in route:
        print(f"  {name:<26}{ms:>5} мс  {ms / total:>5.0%}")
    print(f"  {'Синхронізація (NFR-01)':<26}{sync:>5} мс  "
          f"ціль {TARGET_SYNC}: {status(sync, TARGET_SYNC)}")
    print(f"  {'Разом (NFR-02)':<26}{total:>5} мс  "
          f"ціль {TARGET_E2E}: {status(total, TARGET_E2E)}")
    biggest = max(route, key=lambda seg: seg[1])
    print(f"  Найбільша частка: {biggest[0]} ({biggest[1] / total:.0%})")
    return total


base = report("Базова конфігурація", BASE)
print()
hyp = report("Гіпотеза Г-01", HYPOTHESIS)
print()
print(f"Очікуване зменшення наскрізної затримки: {1 - hyp / base:.0%}")