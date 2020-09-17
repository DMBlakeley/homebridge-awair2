# Changelog

All notable changes to this project will be documented in this file. This project uses [Semantic Versioning](https://semver.org/).

## v5.0.0
  ## Changes

  * First version of awair2 plugin in TypeScript format implementing Homebridge dynamic platform.

## v5.1.0
  ## Changes

  * Update to correctly handle default configuration values plus general cleanup of code. 
  * Files updated: README.md, src/index.ts, src/configType.ts, config.schema.json, package.json, package-lock.json, CHANGLOG.md.

## v5.1.1
  ## Changes

  * Update of Class declarations to remove Readonly for changeable variables and provide default values. Added check for presence of optional parameteres in config.json to override defaults.

## v5.1.2
  ## Changes

  * Cleanup of comments in index.js code (no functional changes). Files updated: README.md, src/index.ts, package.json, package-lock.json, CHANGLOG.md.

## v5.2.0
  ## Changes

  * Added (beta) battery support for Awair Mint. Updates to README.md and config.schema.json.

## v5.2.1
  ## Changes

  * Awair Onmi has battery, not Awair Mint. Updates to README.md and indes.ts files.

## v5.2.2
  ## Changes

  * Limit battery status check frequency to every 4th data check.

## v5.2.3
  ## Changes

  * Added low battery alert (<30%) for Omni. Battery status shows up on all 4 sensors (Air Quality, CO2, Humidity & Temperature).
  * Updated README.md with battery status details and added screenshot example for iOS14.
