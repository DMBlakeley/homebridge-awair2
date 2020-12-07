<table align="center">
    <tr>
      <td><a href="https://github.com/homebridge/homebridge"><img alt="Homebridge" src="https://user-images.githubusercontent.com/3979615/78016493-9b89a800-7396-11ea-9442-414ad9ffcdf2.png" width="250px"></a></td>
      <td><a href="https://www.getawair.com"><img alt="Get Awair" src="https://assets.website-files.com/5e740636238c35d731ff790a/5eba093c3c1a0a9ae493429a_Logo_Horizontal_g.png" width="350px"></a></td>
    </tr>    
</table>

# homebridge-awair2
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

This is a second generation Homebridge Dynamic Platform plugin for the Awair family of air quality sensors implemented in TypeScript for Nfarina's [Homebridge project](https://github.com/nfarina/homebridge). The Awair2 plugin is based on the [homebridge-awair](https://github.com/deanlyoung/homebridge-awair#readme) plugin developed by Dean L. Young.

---

<u><h3 align=center>NOTE:</h3></u>
<p>When migrating from `homebridge-awair` to `homebridge-awair2` please first uninstall `homebridge-awair` (copy your Developer Token first), restart Homebridge to clear 'homebridge-awair' cached accessories, install `homebridge-awair2`, add your Developer Token, and finally restart Homebridge one more time.</p>

---

The Awair2 plugin will query your Awair account using a Developer Token to determine your registered Awair devices which were setup through the Awair app on your iOS device. While running, the plugin will fetch current sensor conditions for each Awair device (e.g. Awair 1st Edition, Awair Glow, Awair Mint, Awair Omni, Awair 2nd Edition, Awair Glow C, or Awair Element) and provide sensor status and value (e.g. temperature, humidity, carbon dioxide, TVOC, dust/PM2.5/PM10, Omni lux, and Omni battery) to HomeKit. You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

The plugin will fetch new data based on selected `endpoint` and User Account tier. For 'Hobbyist' tier, `15-min-avg` endpoint samples every 15 minutes, `5-min-avg` every 5 minutes, `latest` every 5 minutes and `raw` every 3.3 minutes (200 seconds). The main difference between the `latest` and `raw` endpoints is that you can define a `limit` (i.e. number of consecutive data points) for the `raw` endpoint, in order to create your own averaging (e.g. `.../raw?limit=12` for a 2 minute average.

With iOS14, the icons and status have been refined in the iOS/iPadOS/macOS Home app. Air quality, temperature and humidity are grouped under a single "climate" status icon at the top of the HomeKit screen (first screenshots below). If you touch this icon a screen opens with all of the Climate devices in your HomeKit home (second screenshot).

![iOS14 Screenshots](https://github.com/DMBlakeley/homebridge-awair2/blob/master/screenshots/Image.png)

For those with multiple Awair devices, you can optionally list the macAddress of the device (found on the back or bottom of the device) which you want to exclude from HomeKit.

For Awair Omni, battery charge level, charging status, low battery, light level and occupancy detection based on ambient sound level [experimental] are also provided using the Local Sensors capability which is configured in the Awair App (reference screenshot below). Battery Status does not appear as a separate tile in the HomeKit interface. Battery charge level and status will be found in the Status menu for each of the sensors. A low battery indication will be identified as an alert in the HomeKit status section (see third and fourth screenshots).

![iOS14 Screenshots](https://github.com/DMBlakeley/homebridge-awair2/blob/master/screenshots/Image2.png)

<b>NOTE:</b> If you are setting up an Awair 1st Edition (i.e. deviceType = `awair`) unit for the first time, it is recommended that you allow 6 to 12 hours after adding to the iOS Awair App for the unit to calibrate, update firmware if necessary and establish connection to the Awair API cloud.

Acknowledgment to @Sunoo for the homebridge-philips-air plugin which was used as a reference for implementation of the Awair Dynamic Platform TypeScript plugin.

# Installation

1. Install homebridge, reference [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki)
2. Install this plugin using: `[sudo] npm install -g homebridge-awair2`
3. Update your configuration file. See the sample below.

The Awair2 plugin queries your Awair account to determine devices that you have registered. This is the same informaton that you have entered via the Awair app on your iOS device.

You will need to request access to the [Awair Developer Console](https://developer.getawair.com) to obtain your Developer Token (`token`).

The [Awair Developer API Documentation](https://docs.developer.getawair.com) explains the inner workings of the Awair Developer API, but for the most part is not necessary to use this plugin.

# Changelog

Changelog is available [here](https://github.com/DMBlakeley/homebridge-awair2/blob/master/CHANGELOG.md).

# Plugin Configuration

Configuration sample:

See [config-sample.json](https://github.com/DMBlakeley/homebridge-awair2/blob/master/config-sample.json)

```
"platforms": [
  {
    "platform": "Awair2",
    "token": "AAA.AAA.AAA",
    "userType": "users/self",
    "airQualityMethod": "awair-aqi",
    "endpoint": "15-min-avg",
    "limit": 1,
    "carbonDioxideThreshold": 1200,
    "carbonDioxideThresholdOff": 800,
    "vocMw": 72.66578273019740,
    "occupancyDetection": false,
    "occupancyOffset": 2,
    "occupancyRestart": false,
    "logging": false,
    "verbose": false,
    "development": false,
    "ignoredDevices": [
      "70886Bxxxxxx"
    ]
  }
]
```

## Descriptions

Parameter | Description
------------ | -------------
`platform` | The Homebridge Accessory (REQUIRED, must be exactly: `Awair2`)
`token` | Developer Token (REQUIRED, see [Installation](#installation)) above.
`userType` | The type of user account (OPTIONAL, default = `users/self`, options: `users/self` or `orgs/###`, where ### is the Awair Organization `orgId`)
`airQualityMethod` | Air quality calculation method used to define the Air Quality Chracteristic (OPTIONAL, default = `awair-aqi`, options: `awair-aqi`, `awair-score` or `nowcast-aqi`)
`endpoint` | The `/air-data/` endpoint to use (OPTIONAL, default = `15-min-avg`, options: `15-min-avg`, `5-min-avg`, `raw` or `latest`)
`limit` | Number of consecutive data points returned per request, used for custom averaging of sensor values (OPTIONAL, default = `1` i.e. one `15-min-avg`). Defaults to 1 for  `latest`.
`carbonDioxideThreshold` | (OPTIONAL, default = `0` [i.e. OFF], the level at which HomeKit will trigger an alert for the CO2 in ppm)
`carbonDioxideThresholdOff` | (OPTIONAL, default = `0` [i.e. `carbonDioxideThreshold`], the level at which HomeKit will turn off the trigger alert for the CO2 in ppm, to ensure that it doesn't trigger on/off too frequently choose a number lower than `carbonDioxideThreshold`)
`vocMw` | (OPTIONAL, default = `72.66578273019740`) The Molecular Weight (g/mol) of a reference gas or mixture that you use to convert from ppb to ug/m^3
`occupancyDetection` | (OPTIONAL - Omni only, default = `false`) Enables Omni occupancy detection based on minimum environmental sound level detected.
`occupancyOffset` | (OPTIONAL - Omni only, default = `2`) Used when `occupancy detection` enabled. Offset value in dBA above background sound level to set `not occupied` level, `occupied` is 0.5dBA higher.
`occupancyRestart` | (OPTIONAL - Omni only, default = `false`, use historical data) `true` enables restart of occupancy detection algorithm on Homebridge reboot.
`logging` | Whether to output logs to the Homebridge logs (OPTIONAL, default = `false`)
`verbose` | Whether to log results from API data calls (OPTIONAL, default = `false`). Requires `logging` to be `true`.
`development` | Enables Development mode to allow use of `test` Awair devices lacking `end user`/Awair OUI formatted Serial numbers.
`ignoredDevices` | (OPTIONAL) Array of Awair device macAddresses (12 characters in length) to be excluded from HomeKit (OPTIONAL). `End user` devices with begin with Awair OUI "70886B", `test` devices are concatnation of right 12 characters of '00000000000' + deviceId.

Reference Wiki for detailed description of [Configurion Options](https://github.com/DMBlakeley/homebridge-awair2/wiki/3.-Awair2-Configuration-Options). 


# Resources

Reference Wiki for complete list of [Resources](https://github.com/DMBlakeley/homebridge-awair2/wiki/6.-Resources).
