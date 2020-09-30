# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).

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