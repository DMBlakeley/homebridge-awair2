# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).

## v5.13.1
* Append .local domain suffix to localAPI calls (credit to Brent Comnes for submission).

## v5.13.0
* Add `localAPI` data collection option for Awair R2, Awair Element and Awair Omni.
* Update `README.md` with additional information on use of `localAPI`.
* Update `config.schema.json` to provide configuration for use of `localAPI`.

## v5.12.7
* Correct operation with node v20.x

## v5.12.6
* Update node revisions to: [18.x, 20.x, 22.x]
* Housekeeping

## v5.12.5
* Update eslint rules to include `'@typescript-eslint/no-unused-expressions': 'off'` for compatibility with eslint v9.15.0. 

## v5.12.4
* Updates for compatibility with Homebridge v1.8.5.

## v5.12.3
* Add support for updated Developer Token preamble text.

## v5.12.2
* Update @typescript-eslint/eslint-plugin to "^8.0.0", and @typescript-eslint/parser: "^8.0.1".
* Update eslint to "^9.0.0".

## v5.12.1
* Housekeeping of error warning levels for consistency.
* Address Server-Side Request Forgery in axios by making minimum axios revision level 1.7.3 - https://github.com/advisories/GHSA-8hc4-vh64-cxmj

## v5.12.0
* Confirm plug-in operation with Homebridge 2.0.0. Updated package.json per homebridge instructions.

## v5.11.0
* Incorporates updated Awair Score methodology for Awair Element (Firmware v1.4.0) and Awair Omni (Firmware v1.8.0) introduced by Awair in Dec 2023. NOTE that updated methology does not apply to Awair R2. See Awair [Reference](https://support.getawair.com/hc/en-us/articles/19504367520023#h_01HE1QVJ85K55N7QS8NAVBXWJM) and plugin README for additional details.
* Change default IAQ method to `awair-score`.

## v5.10.9
* Add plug-in Setting option to select temperature units (C or F) and time format (12hr or 24hr) when Display Modes are enabled.

## v5.10.8
* Update node-version: [18.x, 20.x], remove 16.x which is no longer supported by homebridge.

## v5.10.7
* [Housekeeping] Update devDependencies for "@typescript-eslint/eslint-plugin": "^6.1.0", and "@typescript-eslint/parser": "^6.1.0".

## v5.10.6
* [Housekeeping] Update supported node-versions to [16.x, 18.x, 20.x] dropping 14.x which is end-of-life.

## v5.10.5
* [Housekeeping] Additional logging improvements.
* [Housekeeping] Update README.md to include npm version and number of npm downloads.

## v5.10.4
* [Enhancement] Check if tvoc > 100,000 and if so set to 100,000.
* [Housekeeping] Update devDependencies to latest versions.
* [Housekeeping] Improved logging.

## v5.10.3
* [Housekeeping] Update `node.js` compatible build versions. Add `18.x`, remove `12.x`, as Homebridge supports versions `14.x`, `16.x` and `18.x`.
* [Housekeeping] Update `package.json` `engines` and `dependencies` to current supported versions.

## v5.10.2
* [Housekeeping] Add 'ambient.d.ts' src file as workaround when updating to Homebridge 1.6.0 for "node_modules/hap-nodejs/dist/lib/Advertiser.d.ts:5:29 - error TS7016: Could not find a declaration file for module '@homebridge/dbus-native'. '…/node_modules/@homebridge/dbus-native/index.js' implicitly has an 'any' type."

## v5.10.1
* [Housekeeping] Roll back axios from 1.1.3 to 0.27.2 to address plug-in startup errors.

## v5.10.0
* [Functionality] Remove support for Awair v1, Glow and Glow-C which are 'sunsetted' by Awair as of 30 Nov 2022. With this change, Awair removed iOS app and Awair Cloud support for these devices which is required by the plug-in.
* [Housekeeping] Update README.md and Wiki for iOS 16 and removal of 'sunsetted' devices.
* [Housekeeping] Add check to confirm that Developer Token is valid JSON Web Token (JWT) as condition to starting plugin.
* [Housekeeping] Bump axios from 0.27.2 to 1.1.3.

## v5.9.10
* [Security] Address potential vunerabilites by updating to `minimist ^1.2.7` and `optimist ^0.5.2`.
* [Housekeeping] Update dependent node modules to latest versions.

## v5.9.9
* [Enhancement] Verify Awair server status prior to axios.get call to Awair servers (axios 'validateStatus' option). Add additional error logging.
* [Housekeeping] Update dependent node modules to latest versions.

## v5.9.8
* [Housekeeping] Check if device exists based on `deviceUUID` rather than `serial` for consistency with cache restore checks. `deviceUUID` used as basis for Homebridge `UUID`.
* [Logging] Add accType to logging messages added in v5.9.7 so that UUIDs can be more easily tracked.

## v5.9.7
* [Logging] Add additional logging for homebridge accessory UUID during addition of new Awair device and recovery from cache for existing Awair devices.

## v5.9.6
* [Housekeeping] Plug-in initialization code and logging improvements.
* [Housekeeping] Update dependent node modules to latest versions.

## v5.9.5
* [Enhancement] Add option to enable/disable VOC and PM2.5 binary limit switches.
* [Housekeeping] Update dependent node modules to latest versions.

## v5.9.4
* [Security] Update `minimist` dependecy to version `>=0.2.1` to address [CVE-2020-7598](https://github.com/advisories/GHSA-vh95-rmgr-6w4m) security advisory.
* [Housekeeping] Improve error logging for `updateAirQualityData`, `getBatteryStatus` and `getOccupancyStatus` to include `accessory.context.serial` in logging output.

## v5.9.3
* [Bug] Correctly report humidity. Was returning `0%` for all Awair devices.

## v5.9.2
* [Housekeeping] Added explicit return types for all functions. Added explicit `return` to close all functions as appropriate.
* [Improvement] Refactored `updateAirQualityData` function for cleaner operation. Updated `axios.get` syntax.
* [Bug] Corrected syntax of `voc` and `pm25` cases in `updateAirQualityData` function to correctly use `getCharacteristic` for current `value`.

## v5.9.1
* [Housekeeping] Update node_module dependencies to latest versions.
* [Security] Update `follow-redirects` to version 1.14.7 to address [CVE-2022-0155](https://github.com/advisories/GHSA-74fj-2j2h-c42q) security advisory.

## v5.9.0
* [Enhancement] Add binary limit switches for VOC and PM2.5. The switches are implemented as dummy `occupancy sensors` and can be used to trigger HomeKit automations.
* <b><u>NOTE</u>:</b> Awair device(s) need to be deleted from Homebridge cache followed by Homebridge restart in order to add VOC and PM2.5 limit switch capability. This also will require that the Awair device(s) be reconfigured in HomeKit including room location and automations.
* [Housekeeping] Typescript syntax and readability improvements.

## v5.8.14
* Updates to `index.ts`, `package.json`, and `package-lock.json` for compatibility with `eslint v8.50` and `@typescript-eslint v5.7.0`.

## v5.8.13
* Update to `lockfileversion 2`. The lockfile version used by npm v7, which is backwards compatible to v1 lockfiles.

## v5.8.12
* Updated index.ts for compatibility with axios v0.24.0 which changed `never` type to `unknown`. Added specification that response data should be `any`.

## v5.8.11
* Update index.ts code comments to support future updates. No functional changes to code.

## v5.8.10
* Address dns-packet security vulnerability. Reference [CVE-2021-23386](https://github.com/advisories/GHSA-3wcq-x3mq-6r9p).

## v5.8.9
* Correct `switch` statement for fall through condition in `getUserInfo()` function.
* Confirm latest @dependabot updates.
* Removed node v10.x from support versions.

## v5.8.8
* Added node v16.x to supported versions.
* Housekeeping. No functional changes.

## v5.8.7
* [Bug] Correct Display and LED Mode initialization of compatible devices to ensure that 'Score' and 'Auto' are selected as defaults.
* [Bug] Initialize IAQ characteristics with numberic values to address Homebride v1.3.x warning.
* [Housekeeping] Remove duplicate entries from package-lock.json.
* [Housekeeping] In config.schema.json change 'default' to 'placeholder' for 'carbonDioxideThreshold' and 'carbonDioxideThresholdOff' entries.

## v5.8.6
* [Enhancement] Awair Device and LED modes cache values are used if available - applies to Omni, R2 and Element. For new device, Device mode is set to 'Score' and LED mode is set to 'Auto'.
* [Housekeeping] Update of function names for clarity.

## v5.8.5
* [Enhancement] Update 'changeLEDMode' Manual mode and brightness behavior.

## v5.8.4
* [Housekeeping] aligning with @dependabot merges.
* [Bug] Correct error in 'changeLEDMode' function.

## v5.8.3
* Updates for Homebridge 1.3.x compatibility. Set minimum level for Omni lux to 0.0001.

## v5.8.2
* [Bug] Corrected issue - `Multiple air data API calls during a single polling interval #66`. Determined that accessories were being duplicated resulting in additional API calls. For the Hobbyist `Request failed with status code 429`, was returned on API calls as API call limits were exceeded.
* Update if statement logic with `()` to ensure consistency and readability.
* Update logging for consistency.

## v5.8.1
* [Bug] Fix correctly checking whether config entries exist [PR #66](https://github.com/DMBlakeley/homebridge-awair2/pull/65).

## v5.8.0
* [Enhancement] If `awair-pm` selected, Glow and Glow-C will use `awair-aqi` method with configured `endpoint` and `limit`. 

## v5.7.3
 * [New] Add `awair-pm` 'air quality method'. When 'awair-pm' selected, the HomeKit Air Quality tile only reflects the particulates value, which is useful for automating air purifiers.

## v5.7.2
 * [Enhancement] Update config schema titles to provide better description and consistency across titles.
 * [Enhancement] Update README.md to be consistent with config schema changes. Clarify that when upgrading from 5.6.4 to 5.7.x that you should first uninstall plug-in, reboot, reinstall, configure and reboot. This is due to change in device accessory cache format.

## v5.7.0 & v5.7.1
 * [New] Added functionality to control Awair display and brightness. Only applies to Omni, Awair-R2 and Element. <p align = center><b>NOTE:</b></p> <p>When migrating from `v5.6.3` to `v5.7.0` please first uninstall `homebridge-awair2` (copy your Developer Token first), restart Homebridge to clear 'homebridge-awair' cached accessories, install `homebridge-awair2`, add your Developer Token, and finally restart Homebridge one more time.</p>

## v5.6.4
  * Change `carbonDioxideThreshold` default from 0 to 1000 and `carbonDioxideThresholdOff` default from 0 to 800.

## v5.6.3
  * Updates for setting up Raspberry Pi for Homebridge and awair2.
  * config.schema.json - changed `placeholder` to `default` on `userType`, `airQualityMethod`, `carbonDioxideThreshold` and `carbonDioxideThresholdOff`.
  * Add check that `carbonDioxideThresholdOff` is less than `carbonDioxideThreshold`. If not, set to `default` values.

## v5.6.2
  * Housekeeping - remove unused functions (getLocalData, getLocalConfig, getApiUsage).

## v5.6.1
  * Correctly define Awair devices as 'air quality monitor', not 'air purifier'.

## v5.6.0
  * Add NowCast-AQI `airQualityMethod` for Omni, Mint, Awair, Awair-R2 and Element. NowCast-AQI fixes `endpoint` to `15-min-avg` and `data points returned` to `48` (12 hours) for these devices. For Awair Glow and Awair Glow C, `airQualityMethod` is set to `awair-aqi` with same fixed `endpoint` and `data points returned`.
  * Correct Awair, Glow and Glow-C reporting of PM25 which is not available on these devices. <u>NOTE:</u> Installed devices need to be removed from Homebridge followed by reboot to correct. Individual devices can be removed through Homebridge UI settings.
  * Update config.schema.json to conditionally show options based on prior entries.
  * Logging clean-up.

## v5.5.10
  * Add instructions to README.md for migrating from `homebridge-awair` to `homebridge-awair2`.
  * Address "StatusCodeError: 400" and "404" due to errors in handling of config.json entries.
  * Check that data sampling `limit` does not exceed maximum allowed per `endpoint`.
  * Set `raw` data sampling for `non-Hobbyist` tier to have minimum `polling_interval` of 60 seconds.
  * Improve error handling for `axios` HTTP calls.

## v5.5.9
  * Replace request-promise with axios as request-promise has been depricated.
  * Change @dependabot scanning from 'daily' to 'weekly'.
  * Removed extraneous packages from package-lock.json.

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
