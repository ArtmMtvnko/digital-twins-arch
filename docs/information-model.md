# Інформаційна модель двійника

## Відповідність реєстру сигналів

Тип об’єкта описано моделями W3C WoT Thing Model у каталозі `twin/`:

| Файл | Що описує | У двійнику Ditto |
|---|---|---|
| `station-1.0.0.tm.jsonld` | тип «насосна станція»: паспорт, зв’язок, функції, склад із підмоделей | атрибути, повідомлення inbox, посилання `definition` |
| `station-node-1.0.0.tm.jsonld` | вузли станції: тиски, витрата, режим, уставка, сухий хід | функціональний блок `station` |
| `pump-1.0.0.tm.jsonld` | тип «насосний агрегат» | блоки `pump1` і `pump2` — **один тип, два примірники** |
| `sync-1.0.0.tm.jsonld` | службові відомості: номер повідомлення й час відліку | блок `sync` |

Версія моделі входить до назви файлу. Модель верхнього рівня доступна за адресою http://localhost:8090/twin/station-1.0.0.tm.jsonld.

**Частота оновлення двійника — 1 раз на секунду.** Двійник зберігає стан, а не сирі потоки: шлюз станції надсилає одне повідомлення на секунду з поточними значеннями всіх сигналів. Як це узгоджується з реєстром ЛР 1:
- **вібрація:** шлюз рахує СКЗ 10 разів на секунду (ADR-0003), а у двійник передає **максимум** із цих десяти значень за секунду. Максимум, а не середнє — щоб короткий кидок вібрації не загубився для тривоги з порогом 4,5 мм/с. Повний ряд 10 Гц залишається на рівні периферії;
- **сигнали 1 Гц** (тиски, витрата, оберти, потужність) передаються як є;
- **температура** змінюється повільно (0,1 Гц), тож між змінами у двійник приходить останнє відоме значення;
- **дискретні сигнали** (стани насосів, сухий хід, режим, уставка) передаються як поточний стан у кожному повідомленні, а не лише в момент зміни. Так двійник завжди має повну картину, навіть якщо окрему подію буде втрачено.

| ID | Сигнал | Елемент моделі (Ditto) | Тип | Одиниця | Діапазон | Частота у двійнику |
|---|---|---|---|---|---|---|
| S-01 | Вібрація Н1 | `features/pump1/properties/vibration` | number | мм/с (`qudt:MilliM-PER-SEC`) | 0–20 | 1 Гц (максимум СКЗ за 1 с) |
| S-02 | Вібрація Н2 | `features/pump2/properties/vibration` | number | мм/с | 0–20 | 1 Гц (максимум СКЗ за 1 с) |
| S-03 | Тиск на вході | `features/station/properties/inletPressure` | number | бар (`qudt:BAR`) | 0–10 | 1 Гц |
| S-04 | Тиск на виході | `features/station/properties/outletPressure` | number | бар | 0–10 | 1 Гц |
| S-05 | Витрата води | `features/station/properties/flow` | number | м³/год (`qudt:M3-PER-HR`) | 0–120 | 1 Гц |
| S-06 | Частота обертання Н1 | `features/pump1/properties/speed` | number | об/хв (`qudt:REV-PER-MIN`) | 0–3000 | 1 Гц |
| S-07 | Частота обертання Н2 | `features/pump2/properties/speed` | number | об/хв | 0–3000 | 1 Гц |
| S-08 | Потужність Н1 | `features/pump1/properties/power` | number | кВт (`qudt:KiloW`) | 0–15 | 1 Гц |
| S-09 | Потужність Н2 | `features/pump2/properties/power` | number | кВт | 0–15 | 1 Гц |
| S-10 | Температура підшипника Н1 | `features/pump1/properties/bearingTemperature` | number | °C (`qudt:DEG_C`) | 0–120 | 1 Гц (значення змінюється з частотою 0,1 Гц) |
| S-11 | Температура підшипника Н2 | `features/pump2/properties/bearingTemperature` | number | °C | 0–120 | 1 Гц (значення змінюється з частотою 0,1 Гц) |
| S-12 | Стан Н1 | `features/pump1/properties/state` | string, перелік | — | running / standby / stopped / fault | 1 Гц (поточний стан) |
| S-13 | Стан Н2 | `features/pump2/properties/state` | string, перелік | — | running / standby / stopped / fault | 1 Гц (поточний стан) |
| S-14 | Сухий хід | `features/station/properties/dryRun` | boolean | — | true / false | 1 Гц (поточний стан) |
| S-15 | Режим станції | `features/station/properties/mode` | string, перелік | — | auto / night / service / emergency | 1 Гц (поточний стан) |
| S-16 | Фактична уставка тиску | `features/station/properties/setpoint` | number | бар | 4,0–6,0 | 1 Гц (поточний стан) |
| — | Номер повідомлення | `features/sync/properties/seq` | integer | — | ≥ 0 | 1 Гц |
| — | Час відліку на шлюзі | `features/sync/properties/ts` | integer | мс від 1970-01-01 UTC | ≥ 0 | 1 Гц |

Діапазони в моделях збігаються з реєстром сигналів ЛР 1, тож Ditto відхилятиме значення, що виходять за них (перевірка — на кроці 7). Значення `@type` (`ps:PumpStation`, `ps:PumpUnit`, `ps:OutletPressure` тощо) пов’язують моделі з онтологією `twin/ontology.ttl`.

## Словник понять

Онтологію збережено у `twin/ontology.ttl` (IRI `http://example.org/pumpstation`, префікс `ps:` у моделях TM), схему — у `docs/diagrams/ontology.mmd` і `.svg`. Класи онтології збігаються зі значеннями `@type` у моделях TM.

| Поняття | Означення | Онтологія | Відповідник у моделі платформи |
|---|---|---|---|
| Актив | фізичний об’єкт або його складова частина | клас `Asset` | двійник або функціональний блок |
| Насосна станція | об’єкт, що підвищує тиск води для кварталу | клас `PumpStation` ⊂ `Asset` | двійник `org.pzks:station-1`, `@type` моделі `station-1.0.0` |
| Насосний агрегат | насос з двигуном, складова станції | клас `PumpUnit` ⊂ `Asset` | блоки `pump1`, `pump2`, `@type` моделі `pump-1.0.0` |
| Датчик | пристрій, що вимірює величину | клас `Sensor` (підкласи `PressureSensor`, `FlowMeter`, `VibrationSensor`, `TemperatureSensor`) | джерело сигналу в реєстрі; окремого елемента в Ditto немає |
| Спостережувана величина | властивість активу, яку вимірюють | клас `ObservableProperty` (підкласи `OutletPressure`, `VibrationVelocity` тощо) | властивість функціонального блока з `"observable": true` і відповідним `@type` |
| Квартал | житловий квартал, який обслуговує станція | клас `District` | двійник `org.pzks:district-1` (посилання в атрибуті `district`) |
| Має частину / є частиною | зв’язок складу; транзитивний | `hasPart` (транзитивна), обернена `partOf` | підмоделі `tm:submodel` → функціональні блоки |
| Має датчик | актив обладнано датчиком | `hasSensor` (Asset → Sensor) | — (зберігається лише в онтології) |
| Вимірює | датчик вимірює величину | `observes` (Sensor → ObservableProperty) | джерело в стовпці «Джерело» реєстру |
| Обслуговує | станція забезпечує водою квартал | `serves` (PumpStation → District) | атрибут `district` з thingId |
| Заводський номер | ідентифікатор від виробника | властивість-дане `serialNo` | атрибути `pump1SerialNo`, `pump2SerialNo` |
| Частота опитування | скільки разів на секунду датчик дає відлік | властивість-дане `samplingRate` | стовпець «Частота» реєстру сигналів |

**Перевірка міркувачем HermiT:**
- онтологія **несуперечлива**;
- міркувач **вивів зворотні зв’язки**: `pump-1 partOf station-1`, `pump-2 partOf station-1`, а завдяки транзитивності — ще й `motor-1 partOf station-1` (явно записано лише `station-1 hasPart pump-1` і `pump-1 hasPart motor-1`);
- **помилку міркувач ловить:** якщо додати датчику тиску `pt-out` ще й тип `PumpUnit`, онтологія стає суперечливою, бо класи `Asset` і `Sensor` оголошено такими, що не перетинаються. Твердження після перевірки видалено.

## Перевірка валідності

**Створення примірника.** Спершу створено політику `twin/policy.json` (записи `OWNER` — повні права оператора платформи, `TELEMETRY` — лише запис стану для з’єднання MQTT), потім двійник з опису `twin/station-1.json`:

```
API=http://localhost:8080/api/2
curl -u ditto:ditto -X PUT -H "Content-Type: application/json" \
  --data @twin/policy.json $API/policies/org.pzks:station-1
curl -u ditto:ditto -X PUT -H "Content-Type: application/json" \
  --data @twin/station-1.json $API/things/org.pzks:station-1
```

Опис примірника містить лише посилання на модель (`definition`) і паспорт. Функціональні блоки Ditto побудував **сам з моделі**: `station`, `pump1`, `pump2`, `sync`. Числові властивості отримали значення 0, а властивості зі значенням за замовчуванням у моделі — це значення (`mode: "auto"`, `setpoint: 5.0`, `state: "standby"`, `dryRun: false`). Блоки `pump1` і `pump2` мають однакове посилання на модель `pump-1.0.0.tm.jsonld` — один тип, два примірники:

```
"pump1":{"definition":["http://web/twin/pump-1.0.0.tm.jsonld"],
         "properties":{"vibration":0.0,"speed":0.0,"power":0.0,"bearingTemperature":0.0,"state":"standby"}},
"pump2":{"definition":["http://web/twin/pump-1.0.0.tm.jsonld"], ...}
```

**Зміни стану.** Одна валідна й чотири невалідні зміни властивостей:

| № | Зміна | Що порушено | Код | Відповідь Ditto (`validationDetails`) |
|---|---|---|---|---|
| 1 | `station/properties/outletPressure` = `4.8` | — (валідна) | **204** | — |
| 2 | `station/properties/outletPressure` = `25` | максимум 10 бар | **400** | `maximum=must have a maximum value of 10` |
| 3 | `station/properties/setpoint` = `6.5` | уставка поза 4,0–6,0 бар | **400** | `maximum=must have a maximum value of 6.0` |
| 4 | `pump1/properties/state` = `"broken"` | значення не з переліку станів | **400** | `enum=does not have a value in the enumeration ["running", "standby", "stopped", "fault"]` |
| 5 | `pump1/properties/rpm` = `1450` | властивості немає в моделі | **400** | `properties contained JSON fields which were not defined in the model: [rpm]` |

Усі невалідні зміни відхилено з помилкою `wot:payload.validation.error`. Тобто модель типу не лише документує дані, а й **захищає двійник**: значення поза діапазоном реєстру сигналів не потраплять у стан навіть від з’єднання телеметрії — це другий рубіж якості даних після перевірки на шлюзі (FR-02).

**Позначка `readOnly` запису не забороняє.** Паспортні атрибути в моделі позначено `"readOnly": true`, але це лише підказка для клієнтів у згенерованому описі Thing Description. Хто саме може змінювати двійник, визначає **політика**: власник (`OWNER`) має право запису на весь двійник, а з’єднання телеметрії (`TELEMETRY`) — лише на `thing:/features`, тож змінити паспорт воно не може.