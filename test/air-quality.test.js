const assert = require('node:assert/strict');
const { test } = require('node:test');
const register = require('../dist/index.js');

let Platform;
register({
  registerPlatform: (_plugin, _name, platform) => { Platform = platform; },
});
const platform = Object.create(Platform.prototype);
platform.config = { logging: false };

for (const method of ['convertAwairAqi', 'convertAwairPm']) {
  test(`${method} reports unknown when sensor readings are empty`, () => {
    for (const sensors of [[], {}]) {
      assert.equal(platform[method]({}, sensors), 0);
    }
  });

  test(`${method} preserves air quality for valid readings`, () => {
    assert.equal(platform[method]({}, { pm25: 0, dust: 0 }), 1);
    assert.equal(platform[method]({}, { pm25: 35, dust: 50 }), 3);
    assert.equal(platform[method]({}, { pm25: 15, dust: 250 }), 5);
  });
}
