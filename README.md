# homebridge-awair2
This is a second generation Homebridge Dynamic Platform plugin implemented in TypeScript for Nfarina's [Homebridge project](https://github.com/nfarina/homebridge) based on the [homebridge-awair](https://github.com/deanlyoung/homebridge-awair#readme) plugin developed by Dean L. Young.

The Awair2 plugin will query your Awair account as setup through the Awair app on your iOS device to determine your registered Awair devices and details. While running, the plugin will fetch current sensor conditions for each Awair device (e.g. Awair, Awair Glow, Awair Mint, Awair Omni, Awair 2nd Edition or Awair Element) and provide available sensor readings (e.g. temperature, humidity, carbon dioxide, TVOC, and dust/PM2.5/PM10) information for HomeKit. You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

The plugin will fetch new data once every 15 minutes (default), but it can be customized via the Homebridge Config UI X plugin or directly by editing the homebridge `config.json` file.

With iOS14, the icons and status have been refined for HomeKit. Air quality, temperature and humidity are grouped under a single "climate" status icon at the top of the HomeKit screen (first screen shots below). If you touch and hold this icon a screen opens with all of the Climate devices in your HomeKit home (second screen shot).

![Status](screenshots/image.jpeg)

For Awair Omni, battery charge level, charging status and low battery are also provided for Awair Omni. Battery Status does not appear as a separate tile in the HomeKit interface. Battery charge level and status will be found in the Status menu for each of the sensors. A low battery indication will be identified as an alert in the HomeKit status (see 3rd and 4th screen shots).


Acknowledgment to @Sunoo for the homebridge-philips-air plugin which was used as a reference for implementation of the Awair Dynamic Platform TypeScript plugin.

# Installation

1. Install homebridge using: `[sudo] npm install -g homebridge`
2. Install this plugin using: `[sudo] npm install -g homebridge-awair2`
3. Update your configuration file. See the sample below.

The Awair2 plugin queries your Awair account to determine devices that you have registered. This is the same informaton that you have entered via the Awair app on your iOS dev ice.

You will need to request access to the [Awair Developer Console](https://developer.getawair.com) to obtain your Developer Token (`token`).

The [Awair Developer API Documentation](https://docs.developer.getawair.com) explains the inner workings of the Awair Developer API, but for the most part is not necessary to use this plugin.

# Changelog

Changelog is available [here](https://github.com/DMBlakeley/homebridge-awair2/blob/master/CHANGELOG.md).

# Plugin Configuration

Configuration sample:

See [config-sample.json](https://github.com/DMBlakeley/homebridge-awair2/blob/master/config-sample.json)

```
"platforms": [{
   "platform": "Awair2",
   "token": "AAA.AAA.AAA",
   "userType": "users/self",
   "airQualityMethod": "awair-score",
   "endpoint": "15-min-avg",
   "polling_interval": 900,
   "limit": 12,
   "logging": false,
   "carbonDioxideThreshold": 1200,
   "carbonDioxideThresholdOff": 800,
}]
```

## Descriptions

Parameter | Description
------------ | -------------
`platform` | The Homebridge Accessory (REQUIRED, must be exactly: `Awair2`)
`token` | Developer Token (REQUIRED, see [Installation](#installation)) above.
`userType` | The type of user account (OPTIONAL, default = `users/self`, options: `users/self` or `orgs/###`, where ### is the Awair Organization `orgId`)
`airQualityMethod` | Air quality calculation method used to define the Air Quality Chracteristic (OPTIONAL, default = `awair-score`, options: `awair-score`, `aqi`, `nowcast-aqi`)
`endpoint` | The `/air-data` endpoint to use (OPTIONAL, default = `15-min-avg`, options: `15-min-avg`, `5-min-avg`, `raw`, or `latest`)
`polling_interval` | The frequency (OPTIONAL, default = `900` (15 minutes), units: seconds, that you would like to update the data in HomeKit. Recommended minimums: `900` for `15-min-avg`, `300` for `5-min-avg` or `latest`, and `200` for `raw` so as not to exceed Awair developer account daily Tier Quotas.)
`limit` | Number of consecutive 10 second data points returned per request, used for custom averaging of sensor values from `/raw` endpoint (OPTIONAL, default = `12` i.e. 2 minute average)
`logging` | Whether to output logs to the Homebridge logs (OPTIONAL, default = `false`)
`carbonDioxideThreshold` | (OPTIONAL, default = `0` [i.e. OFF], the level at which HomeKit will trigger an alert for the CO2 in ppm)
`carbonDioxideThresholdOff` | (OPTIONAL, default = `0` [i.e. `carbonDioxideThreshold`], the level at which HomeKit will turn off the trigger alert for the CO2 in ppm, to ensure that it doesn't trigger on/off too frequently choose a number lower than `carbonDioxideThreshold`)


# Resources

- Awair API: https://docs.developer.getawair.com/
- Homebridge: https://github.com/nfarina/homebridge
- Homebridge API: https://developers.homebridge.io/#/
- Homebridge examples: https://github.com/homebridge/homebridge-examples
- Homebridge Platform Plugin Template: https://github.com/homebridge/homebridge-plugin-template
- Homebridge plugin development: http://blog.theodo.fr/2017/08/make-siri-perfect-home-companion-devices-not-supported-apple-homekit/
- Using async-await and npm-promise with TypeScript: https://github.com/patdaburu/request-promise-typescript-example
- Another Awair plugin: https://github.com/henrypoydar/homebridge-awair-glow
- Reference AQ plugin: https://github.com/toto/homebridge-airrohr
- Refenerce temperature plugin: https://github.com/metbosch/homebridge-http-temperature
- AQI Calculation NPM package: https://www.npmjs.com/package/aqi-bot
- Homebridge-philips-air plugin: https://github.com/Sunoo/homebridge-philips-air
