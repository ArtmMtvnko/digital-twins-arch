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
