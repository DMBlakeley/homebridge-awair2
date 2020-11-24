# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).

## v5.5.8
  * Added dependabot.yml file.
  * Approved and merged @dependabot pull requests.
  * Confirmed plugin operation after merges.
  
## v5.5.7
 * Add the `Verified by Homebridge` badge and update README.md header.

## v5.5.6
  * Minimum Omni occupancy level changed to 48.0dBA per Omni specifications.
  * Addition of Wiki screenshots.

## v5.5.5
  * Omni occupancy detection improvments. Minimum sound level set to 47dBA based on dust sensor fan noise as guard for spurious low reading. Provide option to restart detection algorithm on Homebridge restart.

## v5.5.4
  * Omni occupancy detection improvments. Now based on minimum detected sound level + user defined offset.
  * Correct existing device recovery from cache on Homebridge restart. 

## v5.5.3
  * Update build.yml to only include even numbered releases of node.js [10.x, 12.x, 14.x]
  * Update README.MD to provide additional details on adding 'test' devices to 'exclude' list.
  * Add experimental support for Omni auto occupancy detection base on minimum sound level detected.

## v5.5.1 & v5.5.2
  * Update to address build error TS6059: File 'package.json' is not under 'rootDir' '/homebridge-awair2/src'. 'rootDir' is expected to contain all source files.

## v5.5.0
  * Add Omni occupancy detection based on sound pressure level.
  * Check that Awair MAC contains Awair OUI "70886B" for 'end user' devices.
  * Add "Development" mode to allow use of 'test' devices.
  * Define MAC addresses for unregistered 'test' devices based on deviceId. Will begin with '000000'.
  * Rename "updateStatus" to "updateAirData" to better reflect intent of function.
  * Update comments to provide additional information.
  * Update README.md, config-sample.json, config-schema.json for these changes.

## v5.4.3
  * General code review for consistency.
  * Removed Mint battery check as this function only applies to Omni.

## v5.4.2
  * Revise Omni battery check to include Mint. Applies to v1.3.0 firmware and below.
  * Re-implemented 'vocMw' as an optional configuration in the settings

## v5.4.1
  * Fixed minor typos
  * Fixed typo on Air Quality conversion for method `aqi` to `awair-aqi`
  * Corrected Awair 1st Edition `dust` convertAwairAqi thresholds
  * Reverted `limit` behavior for `5-min-avg` and `15-min-avg` endpoints, but not `latest`
  * Changed default `limit` to `1` and default `endpoint` to `15-min-avg`
  * Added more thorough description of `limit` behavior to README.md

## v5.4.0
  * Add support for Omni to use LocalAPI capability for battery-charge, battery-plugged, lux and spl_a (spl_a not currently supported in HomeKit).
  
## v5.3.0
  * Add option to define Awair account devices to be ignored and not be published in HomeKit.
  * Updates to index.ts, configTypes.ts, config.schema.json, config-sample.json, package.json, and package-lock.json to support ignoredDevices funcionality.

## v5.2.7
  * Republish of v5.2.5 due to v5.2.6 error.

## v5.2.6
  * Version published in error and removed from npm.

## v5.2.5
  * Added `getUserInfo` and `getApiUsage` functions.
  * `polling_interval` now based on `userType` and `endpoint`.
  * Added `UserInfoConfig` to `configTypes.ts`.
  * Corrected logic in `setInterval` to fetch Omni battery status on 4th `updateStatus` check.
  * Updated use of `limit` in config.json to only apply to `raw` endpoint. Defaults to 1 for other endpoints.
  * Added `verbose` logging flag which will log results from API data calls.
  * Updates to config.schema.json for `limit` description and removal of `polling_interval`.
  * Update to `config-sample.json` to remove `polling_interval`.
  * Updates to README.md.

## v5.2.4
  * Updates from testing multiple Awair units. Base functionality confirmed for Awair, Awair-r2, Awair Element, Awair Glow C and Awair Omni.
  * Corrected data sampling when multiple units are configured.
  * Updated Awair Omni battery sampling.
  * Reverse order of CHANGELOG.md entries with most recent at top.
  * Updates to README.md.

## v5.2.3
  * Added low battery alert (<30%) for Omni. Battery status shows up on all 4 sensors (Air Quality, CO2, Humidity & Temperature).
  * Updated README.md with battery status details and added screenshot example for iOS14.

## v5.2.1
  * Awair Onmi has battery, not Awair Mint. Updates to README.md and indes.ts files.

## v5.1.2
  * Cleanup of comments in index.js code (no functional changes). Files updated: README.md, src/index.ts, package.json, package-lock.json, CHANGLOG.md.

## v5.1.1
  * Update of Class declarations to remove Readonly for changeable variables and provide default values. Added check for presence of optional parameteres in config.json to override defaults.

## v5.1.0
  * Update to correctly handle default configuration values plus general cleanup of code. 
  * Files updated: README.md, src/index.ts, src/configType.ts, config.schema.json, package.json, package-lock.json, CHANGLOG.md.

## v5.0.0
  * First version of awair2 plugin in TypeScript format implementing Homebridge dynamic platform.
  * Started at version 5.0.0 as homebridge-awair was at version 4.6.3.