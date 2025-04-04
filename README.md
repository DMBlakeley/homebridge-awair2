<table align="center">
    <tr>
      <td><a href="https://github.com/homebridge/homebridge"><img alt="Homebridge" src="https://user-images.githubusercontent.com/3979615/78016493-9b89a800-7396-11ea-9442-414ad9ffcdf2.png" width="250px"></a></td>
      <td><a href="https://www.getawair.com"><img alt="Get Awair" src="https://assets.website-files.com/5e740636238c35d731ff790a/5eba093c3c1a0a9ae493429a_Logo_Horizontal_g.png" width="350px"></a></td>
    </tr>    
</table>

# homebridge-awair2
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) ![npm-version](https://badgen.net/npm/v/homebridge-awair2?icon=npm&label) ![npm-downloads](https://badgen.net/npm/dt/homebridge-awair2?icon=npm&label) 

This is a Homebridge plugin for the Awair-R2, Awair Element and Awair Omni air quality monitors for Nfarina's [Homebridge project](https://github.com/nfarina/homebridge). The Awair2 plugin is based on the [homebridge-awair](https://github.com/deanlyoung/homebridge-awair#readme) plugin developed by Dean L. Young.

The Awair2 plugin will query your Awair account using your Developer Token to determine registered Awair devices which were setup through the Awair iOS app. While running, the plugin will fetch current sensor conditions for each Awair device (e.g. Awair Mint, Awair Omni, Awair Element, or Awair 2nd Edition) and provide sensor status and value (e.g. temperature, humidity, carbon dioxide, TVOC, PM2.5, Omni lux, and Omni battery) to HomeKit. You can look at the current Awair information via HomeKit enabled Apps on your iOS device or even ask Siri for them.

By default, the plugin uses the Awair `CloudAPI` and will fetch new data based on selected `endpoint` and User Account tier. For 'Hobbyist' tier, `15-min-avg` endpoint samples every 15 minutes, `5-min-avg` every 5 minutes, `latest` every 5 minutes and `raw` every 3.3 minutes (200 seconds). The main difference between the `latest` and `raw` endpoints is that you can define a `limit` (i.e. number of consecutive data points) for the `raw` endpoint, in order to create your own averaging (e.g. `.../raw?limit=12` for a 2 minute average. 

When the `LocalAPI` is selected, new data is sampled over your local LAN from a supported Awair device (e.g. Awair Mint, Awair Omni, Awair Element, or Awair 2nd Edition) and provides available sensor readings (e.g. temperature, humidity, carbon dioxide, TVOC, and PM2.5). Unlike the `CloudAPI`, only the `latest` data set is collected and averaging of multiple data sets is not supported. `LocalAPI` permits higher sampling rate than is supported by the `CloudAPI`. 30 second `LocalAPI` sampling is recommended, although a minimum of 10 seconds is supported. The higher sampling rate is useful when you make use of HomeKit Automation triggered by IAQ levels. Instructions for enabling `LocalAPI` on your device can be found [here](https://support.getawair.com/hc/en-us/articles/360049221014-Awair-Element-Local-API-Feature#h_01F40FBBW5323GBPV7D6XMG4J8).

For both `CloudAPI` and `LocalAPI`, your Awair devices and configuration are obtained from your Awair Account. In both cases you must acquire your `Developer Token` through the Awair app.
<br>

# Installation

1. Install homebridge, reference [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki)
2. The easiest way to install the Awair2 plugin is through the `homebridge` interface. Select `Plugins` at the top menu bar, search for `Awair2` and then select install. Alternately, the plugin may be installed from the command line using: `[sudo] npm install -g homebridge-awair2`. 
3. Update your configuration file. See the sample below.

The Awair2 plugin queries your Awair account to determine devices that you have registered. This returns the same informaton that you have entered via the Awair app on your iOS device.

You will need to request access to the [Awair Developer Console](https://developer.getawair.com) to obtain your Developer Token (`token`). You can also request your Developer Token directly through the Awair App on your iPhone. From the App, select 'Awair+' in the lower right hand corner, then select 'Awair APIs', select 'Cloud API' and finally 'Get API Token'.

![iOS16 Developer Token](https://github.com/DMBlakeley/homebridge-awair2/blob/master/screenshots/ios16_developer_token.gif)

The [Awair Developer API Documentation](https://docs.developer.getawair.com) explains the inner workings of the Awair Developer API, but for the most part is not necessary to use this plugin.
<br>

# Notes

1. If you are setting up an Awair unit for the first time, it is recommended that you allow a couple of hours after adding to the iOS Awair App for the unit to calibrate, update firmware if necessary and establish connection to the Awair Cloud. Initially the accessories may show up in Homebridge and HomeKit, however, the data field may be blank. This will correct after the data stream has been established between your Awair device and the Awair Cloud.

2. The plugin uses the new Awair Score methodology for Awair Element (Firmware v1.4.0) and Awair Omni (Firmware v1.8.0) introduced by Awair in Dec 2023. See [Reference](https://support.getawair.com/hc/en-us/articles/19504367520023#h_01HE1QVJ85K55N7QS8NAVBXWJM).

    * The IAQ Score System integrates readings from five sensors: Temperature, Humidity, Volatile Organic Compounds (VOC), Carbon Dioxide (CO2), and Particulate Matter (PM2.5). In the previous system, each factor contributed equally (approximately 20%) to the total score. The new air quality scoring system begins with normalizing sensor data to a scale where 0 represents good quality and 1 indicates the worst, assigning values that correspond to a range of scores. The final Indoor Air Quality (IAQ) score is a composite of the highest normalized values from CO2, VOC, and PM2.5 readings.

    * The new Awair Score level is displayed in Homebridge on the Accessory tile for Awair Element and Awair Omni in addition to the Homekit level. Awair r2 only displays the Homekit level. Unfortunately, HomeKit levels are defined by the HomeKit API and cannot be customized.

<table align="center" style="margin: 0px auto;">
<tr>
<th>Score</th>
<th>new Awair level</th>
<th>HomeKit level</th>
</tr>
<tr>
<td>1</td>
<td>GOOD</td>
<td>EXCELLENT</td>
</tr>
<tr>
<td>2</td>
<td>ACCEPTABLE</td>
<td>GOOD</td>
</tr>
<tr>
<td>3</td>
<td>MODERATE</td>
<td>FAIR</td>
</tr>
<tr>
<td>4</td>
<td>POOR</td>
<td>INFERIOR</td>
</tr>
<tr>
<td>5</td>
<td>HAZARDOUS</td>
<td>POOR</td>
</tr>
</table>

<p align="center">iOS Awair app version 4.7.3 is required to view the updated scores.</p>

3. With iOS16, the layout, icons and status were refined in the iOS/iPadOS/macOS Home apps. Temperature and humidity are grouped under a single "climate" status icon at the top of the HomeKit screen. If you select this icon a screen opens with all of the Climate devices in your HomeKit.

![iOS16 Climate](https://github.com/DMBlakeley/homebridge-awair2/blob/master/screenshots/ios16_climate.gif)

4. For those with multiple Awair devices, you can optionally list the macAddress of the device (found on the back or bottom of the device) which you want to exclude from HomeKit.

5. For Awair Omni, battery charge level, charging status, low battery, light level and occupancy detection based on ambient sound level [experimental] are also provided using the Local Sensors capability which is configured in the Awair App. 

![iOS16 Local API](https://github.com/DMBlakeley/homebridge-awair2/blob/master/screenshots/ios16_local_api.gif)

6. Battery Status does not appear as a separate tile in the HomeKit interface. Battery charge level and status will be found in the Status menu for each of the sensors. A low battery indication will be identified as an alert in the HomeKit status section.
<br>

# Plugin Configuration

Configuration sample: [config-sample.json](https://github.com/DMBlakeley/homebridge-awair2/blob/master/config-sample.json)
<br>

# Descriptions

Reference [Wiki Chapter 3](https://github.com/DMBlakeley/homebridge-awair2/wiki/3.-Awair2-Configuration-Options) for additional details.

(*) Introduced with v5.9.0.

Parameter | Optional? | Description
:-- | :----: | :---
`platform` |  | The Homebridge Accessory (REQUIRED, must be exactly: `Awair2`)
`token` |  | Developer Token (REQUIRED, see [Installation](#installation)) above.
`userType` | Y | The type of user account (Default = `users/self`, options: `users/self` or `orgs/###`, where ### is the Awair Organization `orgId`)
`apiMethod` | Y | The type of API used. (Default = `cloudAPI`, option: `localAPI`).
`airQualityMethod` | Y | Air quality calculation method used to define the Air Quality Chracteristic (Default = `awair-score`, options: `awair-aqi`, `awair-pm`, `awair-score` or `nowcast-aqi`)
`endpoint` | Y | The `/air-data/` endpoint to use (Default = `15-min-avg`, options: `15-min-avg`, `5-min-avg`, `raw` or `latest`). Will default to `latest` when `localAPI` enabled.
`limit` | Y | Number of consecutive data points returned per request, used for custom averaging of sensor values (Default = `1` i.e. one `15-min-avg`). Defaults to `1` for  `latest`.
`carbonDioxideThreshold` | Y | The level at which HomeKit will trigger an alert for the CO2 in ppm. (Default = `1000`)
`carbonDioxideThresholdOff` | Y | The level at which HomeKit will turn off the trigger alert for the CO2 in ppm, to ensure that it doesn't trigger on/off too frequently. Choose a number less than `carbonDioxideThreshold`. (Default = `800`)
`enableTvocPm25` | Y | Whether to enable Total VOC and PM2.5 threshold binary sensors.
`tvocThreshold`(*) | Y | Total VOC level at which HomeKit will trigger an alert in &micro;g/m&sup3;. (Default = `1000`)
`tvocThresholdOff`(*) | Y | Total VOC level at which HomeKit will turn off the trigger alert in &micro;g/m&sup3; to ensure that it doesn't trigger on/off too frequently. Choose a number less than `tvocThreshold`. (Default = `800`)
`pm25Threshold`(*) | Y | The level at which HomeKit will trigger an alert for PM2.5 in &micro;g/m&sup3;. (Default = `35`)
`pm25ThresholdOff`(*) | Y | The level at which HomeKit will turn off the trigger alert for pm2.5 in &micro;g/m&sup3; to ensure that it doesn't trigger on/off too frequently. Choose a number less than `pm25Threshold`. (Default = `20`)
`vocMw` | Y | The Molecular Weight (g/mol) of a reference gas or mixture that you use to convert from ppb to &micro;g/m&sup3;. (Default = `72.66578273019740`)
`occupancyDetection` | Y | Omni Only - Enables Omni occupancy detection based on minimum environmental sound level detected. (Default = `false`)
`occupancyOffset` | Y | Omni Only - Used when `occupancy detection` enabled. Offset value in dBA above background sound level to set `not occupied` level, `occupied` is 0.5dBA higher. (Default = `2`) 
`occupancyRestart` |  Y | Omni only - Reinitialize Occupancy detection measurement to determine unoccupied sound level on Homebridge reboot. (Default = `false`, use historical data)
`enableModes` | Y | Applies to Omni, Awair-r2 & Element - Enables creation of Display Mode and LED Mode accessories. (Default = `false`)
`logging` | Y | Whether to output logs to the Homebridge logs. (Default = `false`)
`verbose` | Y | Whether to log results from API data calls. Requires `logging` to be `true`. (Default = `false`)
`development` | Y | Enables Development mode to allow use of `test` Awair devices lacking `end user/Awair OUI` formatted Serial numbers. (Default = `false`)
`ignoredDevices` | Y | Array of Awair device macAddresses (12 characters in length) to be excluded from HomeKit (OPTIONAL). `End user` devices with begin with Awair OUI '70886B', `test` devices are concatnation of right 12 characters of '00000000000' + deviceId.

Reference Wiki for detailed description of [Configurion Options](https://github.com/DMBlakeley/homebridge-awair2/wiki/3.-Awair2-Configuration-Options). 

<br>

# Changelog

Changelog is available [here](https://github.com/DMBlakeley/homebridge-awair2/blob/master/CHANGELOG.md).

<br>

# Resources

Reference Wiki for complete list of [Resources](https://github.com/DMBlakeley/homebridge-awair2/wiki/6.-Resources).
