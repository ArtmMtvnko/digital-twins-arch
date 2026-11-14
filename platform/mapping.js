// Відображення «формат пристрою → модель двійника» (домен DCE → DTE)
function mapToDittoProtocolMsg(headers, textPayload, bytePayload, contentType) {
  var m = JSON.parse(textPayload);
  var name = headers["mqtt.topic"].split("/")[1];      // pzks/<name>/telemetry
  var features = {
    station: { properties: {
      inletPressure: m.pi, outletPressure: m.po, flow: m.q,
      setpoint: m.sp, mode: m.mode, dryRun: m.dry } },
    pump1: { properties: {
      vibration: m.v1, speed: m.n1, power: m.w1,
      bearingTemperature: m.t1, state: m.s1 } },
    pump2: { properties: {
      vibration: m.v2, speed: m.n2, power: m.w2,
      bearingTemperature: m.t2, state: m.s2 } },
    sync: { properties: { seq: m.seq, ts: m.ts } }
  };
  return Ditto.buildDittoProtocolMsg("org.pzks", name, "things", "twin",
    "commands", "merge", "/features",
    { "content-type": "application/merge-patch+json" }, features);
}
