# Платформа цифрового двійника

## Перевірка API

Стенд запущено командою `docker compose up -d` у каталозі `platform/`. Служби Ditto перейшли в стан `healthy`, перевірка стану платформи повертає `UP`:

```
$ curl http://localhost:8080/health
{"status":"UP"}
```

**1. Створення тестового двійника.** Запит `PUT` створює двійник із заданим ідентифікатором або замінює наявний.

```
$ curl -i -u ditto:ditto -X PUT -H "Content-Type: application/json" \
  -d '{"attributes": {"purpose": "перевірка"}}' \
  http://localhost:8080/api/2/things/org.pzks:test-1
HTTP/1.1 201 Created
Location: http://localhost:8080/api/2/things/org.pzks:test-1
ditto-originator: nginx:ditto
entity-revision: 1
etag: "rev:1"

{"thingId":"org.pzks:test-1","policyId":"org.pzks:test-1","attributes":{"purpose":"?????????"}}
```

Код `201 Created` підтверджує, що двійник створено. Заголовок `entity-revision: 1` — номер ревізії: кожна зміна двійника збільшує його на 1 (на цьому ґрунтується перевірка пропущених оновлень на занятті 4). `ditto-originator` показує, від чийого імені виконано запит.

*Примітка.* Замість слова «перевірка» збереглися знаки питання: у Git Bash на Windows кирилиця в аргументі командного рядка передається в `curl` не в кодуванні UTF-8. Для справжніх двійників станції дані надсилаються з файлів (`--data @файл`), де кодування UTF-8 зберігається.

**2. Читання двійника.**

```
$ curl -u ditto:ditto http://localhost:8080/api/2/things/org.pzks:test-1
{"thingId":"org.pzks:test-1","policyId":"org.pzks:test-1","attributes":{"purpose":"?????????"}}
```

Двійник містить ідентифікатор `thingId`, посилання на політику доступу `policyId` і атрибут, заданий під час створення.

**3. Читання політики доступу.**

```
$ curl -u ditto:ditto http://localhost:8080/api/2/policies/org.pzks:test-1
{"policyId":"org.pzks:test-1","imports":{},
 "entries":{"DEFAULT":{
   "subjects":{"nginx:ditto":{"type":"generated"}},
   "resources":{
     "thing:/":{"grant":["READ","WRITE"],"revoke":[]},
     "policy:/":{"grant":["READ","WRITE"],"revoke":[]},
     "message:/":{"grant":["READ","WRITE"],"revoke":[]}},
   "importable":"implicit"}}}
```

Політику не задавали явно, тому Ditto створив її автоматично з тим самим ідентифікатором і одним записом `DEFAULT`: суб’єкт `nginx:ditto` (користувач, від імені якого виконано запит) отримав права `READ` і `WRITE` на сам двійник (`thing:/`), на його політику (`policy:/`) і на повідомлення (`message:/`). Для двійника станції на кроці 7 політику буде задано явно, з окремим обмеженим записом для з’єднання телеметрії.

Також перевірено вебконсоль Ditto (http://localhost:8080/ui/) та опис API (http://localhost:8080/apidoc/).

## Структура двійника

Станцію описано **одним двійником** `org.pzks:station-1`. Склад двійника — чотири функціональні блоки (features): `station` (вузли станції), `pump1` і `pump2` (насоси Н1 і Н2, обидва одного типу) та службовий `sync`. Елементи поділено на чотири види з табл. 1 методички.

| Елемент | Вид | Ditto | Джерело |
|---|---|---|---|
| Назва станції | паспорт | `attributes/name` | паспорт станції |
| Адреса станції | паспорт | `attributes/address` | паспорт станції |
| Номінальний тиск на виході | паспорт | `attributes/ratedOutletPressure` | проєкт станції |
| Модель насосів | паспорт | `attributes/pumpModel` | паспорт насоса |
| Заводські номери Н1 і Н2 | паспорт | `attributes/pump1SerialNo`, `attributes/pump2SerialNo` | паспорт насоса |
| Квартал, який обслуговує станція | зв’язок `serves` | `attributes/district` (thingId `org.pzks:district-1`) | проєкт станції |
| Тиск на вході | стан | `features/station/properties/inletPressure` | S-03 |
| Тиск на виході | стан | `features/station/properties/outletPressure` | S-04 |
| Витрата води | стан | `features/station/properties/flow` | S-05 |
| Сухий хід | стан | `features/station/properties/dryRun` | S-14 |
| Режим станції | стан | `features/station/properties/mode` | S-15 |
| Фактична уставка тиску | стан | `features/station/properties/setpoint` | S-16 |
| Вібрація (СКЗ) Н1 / Н2 | стан | `features/pump1/properties/vibration`, `features/pump2/…` | S-01, S-02 |
| Частота обертання Н1 / Н2 | стан | `features/pump1/properties/speed`, `features/pump2/…` | S-06, S-07 |
| Електрична потужність Н1 / Н2 | стан | `features/pump1/properties/power`, `features/pump2/…` | S-08, S-09 |
| Температура підшипника Н1 / Н2 | стан | `features/pump1/properties/bearingTemperature`, `features/pump2/…` | S-10, S-11 |
| Стан насоса Н1 / Н2 | стан | `features/pump1/properties/state`, `features/pump2/…` | S-12, S-13 |
| Номер повідомлення, час відліку | стан (службовий) | `features/sync/properties/seq`, `ts` | шлюз станції |
| Змінити уставку тиску | функція | повідомлення inbox `set-setpoint` | оператор (FR-08) |
| Пустити / зупинити насос | функція | повідомлення inbox `start-pump`, `stop-pump` | оператор (FR-08) |
| Перемкнути режим | функція | повідомлення inbox `set-mode` | оператор (FR-08) |
| Квитувати тривогу | функція | повідомлення inbox `acknowledge-alarm` | оператор (FR-06) |

**Як виражено зв’язки.** У Ditto немає окремої сутності «зв’язок», тому використано два способи:
- **зв’язок з іншим двійником** (станція *обслуговує* квартал) зберігається як атрибут `district` з ідентифікатором іншого двійника. Ditto бачить у ньому лише рядок, а що саме означає цей зв’язок, фіксує онтологія (заняття 2, властивість `serves`);
- **склад** (станція *має частину* насос) виражено функціональними блоками `pump1` і `pump2` всередині одного двійника. В онтології це зв’язок `hasPart`.

**Паспорт і стан** розділено так, як вимагає вісь «тип — екземпляр»: паспортні дані змінюються рідко й зберігаються в атрибутах, а значення сигналів оновлюються телеметрією у функціональних блоках.