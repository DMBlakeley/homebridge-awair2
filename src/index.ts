import {
  API,
  APIEvent,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  NodeCallback,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from "homebridge";

import { onlyAwairPlatformConfig, DeviceConfig} from "./configTypes";
import fetch from "node-fetch";
import * as packageJSON from ".package.json";

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = "homebridge-awair2";
const PLATFORM_NAME = "Awair2";

// Register Awair Platform
export = (api: API): void => {
  hap = api.hap;
	Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, AwairPlatform);
};

class AwairPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
	private readonly api: API;
	private readonly config: onlyAwairPlatformConfig;
	private readonly accessories: PlatformAccessory[] = [];
	private readonly manufacturer: string = "Awair";
	private readonly vocMw: number = 72.66578273019740; // Molecular Weight (g/mol) of a reference VOC gas or mixture
	private timeout: number = 0;

	constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
		this.config = config as unknown as onlyAwairPlatformConfig;
		this.api = api;

		// We need Developer token or we're not starting.
		if(!this.config.token) {
			this.log("Awair Developer token not specified. Reference installation instructions.");
			return;
		}

		// initialize timer
		if (this.config.polling_interval) {
      this.timeout = this.config.polling_interval * 1000;
    } else {
      this.timeout = 900 * 1000; // 15 minutes is default
    }

		// Create array of Awair accessories
		this.accessories = [];

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  // Start discovery of new accessories.
	didFinishLaunching(): void {

		// Get Awair devices from your account defined by token
		let devices = this.getAwairDevices();

		let serNums: string[] = [];

		// Add accessory for each Awair device
		for (let deviceIndex = 0; deviceIndex < devices.length; deviceIndex++) {
			let device = devices[deviceIndex];
			this.addAccessory.bind(this, device)();
			serNums.push(device.macAddress);
		};

 		// Remove old/no longer used accessories
    const badAccessories: Array<PlatformAccessory> = [];
    this.accessories.forEach(cachedAccessory => {
      if (!serNums.includes(cachedAccessory.context.serial)) {
        badAccessories.push(cachedAccessory);
      }
    });
    this.removeAccessories(badAccessories);

    // Add accessory info to each accessory
    this.accessories.forEach(accessory => {
			this.addAccInfo(accessory);
    });
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
		this.dataLoop(); // start collecting data
	}

	getAwairDevices(): any[] {
		let deviceURL = "https://developer-apis.awair.is/v1/" + this.config.userType + "/devices";

		let options = {
			method: "GET",
//			url: deviceURL,
//			json: true,
			headers: {
				Authorization: "Bearer " + this.config.token
			}
		};

		// Get array of your Awair device information from Awair servers
		const response = fetch(deviceURL, options);
		
		let devices: any[] = response.devices;

		return devices;
	}

	addAccessory(data: DeviceConfig): void {
    this.log('Initializing platform accessory ' + data.name + '...');

		let accessory = this.accessories.find(cachedAccessory => {
      return cachedAccessory.context.deviceId == data.deviceId;
    });

    if (!accessory) {  // accessory does not exist in cache, initialze as new
  	  const uuid = hap.uuid.generate(data.deviceUUID);
    	accessory = new Accessory(data.name, uuid);

			accessory.context.name = data.name;
			accessory.context.serial = data.macAddress;
			accessory.context.deviceType = data.deviceType;
	    // Using 'context' property of PlatformAccessory saves information to accessory cache
			accessory.context.deviceUUID = data.deviceUUID;
			accessory.context.deviceId = data.deviceId;

			accessory.addService(hap.Service.AirQualitySensor, data.name);
			accessory.addService(hap.Service.TemperatureSensor, data.name + 'Temp');
			accessory.addService(hap.Service.HumiditySensor, data.name + 'Humidity');

			if (data.deviceType != "awair-mint" && data.deviceType != "awair-glow-c") {
				accessory.addService(hap.Service.CarbonDioxideSensor, data.name + 'CO2');
			};

			if (data.deviceType == "awair-omni" || data.deviceType == "awair-mint") {
				accessory.addService(hap.Service.LightSensor, data.name + 'Light');
			};

			this.addServices(accessory);

			this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

			this.accessories.push(accessory);

		} else { // acessory exists, use data from cache
			accessory.context.name = data.name;
			accessory.context.serial = data.macAddress;
			accessory.context.deviceType = data.deviceType;
			accessory.context.deviceUUID = data.deviceUUID;
			accessory.context.deviceId = data.deviceId;
		};
	}

	removeAccessories(accessories: Array<PlatformAccessory>): void {
    accessories.forEach(accessory => {
      this.log(accessory.name + ' is removed from HomeBridge.');
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.splice(this.accessories.indexOf(accessory), 1);
    });
	}

	// add Services and Characteristics to each Accessory
  addServices(accessory: PlatformAccessory): void {

		accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log(accessory.context.name + ' identify requested!');
		});

	  // Add Air Quality Service
		const airQualityService = accessory.getService(hap.Service.AirQualitySensor);
		if (accessory.context.devType == "awair-glow" || accessory.context.devType == "awair-glow-c") {
			airQualityService
				.setCharacteristic(hap.Characteristic.AirQuality, "--")
				.setCharacteristic(hap.Characteristic.VOCDensity, "--")
		} else if (accessory.context.devType == "awair") {
			airQualityService
				.setCharacteristic(hap.Characteristic.AirQuality, "--")
				.setCharacteristic(hap.Characteristic.VOCDensity, "--")
				.setCharacteristic(hap.Characteristic.PM10Density, "--")
		} else { // mint, omni, awair-r2, element
			airQualityService
				.setCharacteristic(hap.Characteristic.AirQuality, "--")
				.setCharacteristic(hap.Characteristic.VOCDensity, "--")
				.setCharacteristic(hap.Characteristic.PM2_5Density, "--")
		}
		airQualityService
			.getCharacteristic(hap.Characteristic.VOCDensity)
			.setProps({
				minValue: 0,
				maxValue: 100000
			});

	  // Add Temperature Service
		const temperatureService = accessory.getService(hap.Service.TemperatureSensor);
		temperatureService
			.setCharacteristic(hap.Characteristic.CurrentTemperature, "--");
		temperatureService
			.getCharacteristic(hap.Characteristic.CurrentTemperature)
			.setProps({
				minValue: -100,
				maxValue: 100
			});

	  // Add Humidity Service
		const humidityService = accessory.getService(hap.Service.HumidityService);
		humidityService
			.setCharacteristic(hap.Characteristic.CurrentRelativeHumidity, "--");

	  // Add Carbon Dioxide Service
		if (accessory.context.devType != "awair-mint" && accessory.context.devType != "awair-glow-c") {
			const carbonDioxideService = accessory.getService(hap.Service.CarbonDioxideSensor);
			carbonDioxideService
				.setCharacteristic(hap.Characteristic.CarbonDioxideLevel, "--");
		};

	  // Add Light Sensor Service
		if (accessory.context.devType == "awair-omni" || accessory.context.devType == "awair-mint") {
			const lightLevelService = accessory.getService(hap.Service.LightSensor);
			lightLevelService
				.setCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, "--");
			lightLevelService
				.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
				.setProps({
					minValue: 0,
					maxValue: 64000
				});
		};

		this.log("[" + accessory.context.serial + "] addServices completed")

		this.accessories.push(accessory);
	}

	addAccInfo(accessory: PlatformAccessory): void {
		const accInfo = accessory.getService(hap.Service.AccessoryInformation);
		accInfo
			.updateCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer);
		accInfo
			.updateCharacteristic(hap.Characteristic.Model, accessory.context.devType);
		accInfo
			.updateCharacteristic(hap.Characteristic.SerialNumber, accessory.context.serial);
		accInfo
			.updateCharacteristic(hap.Characteristic.FirmwareRevision, packageJSON.version);
	}

  updateStatus(accessory: PlatformAccessory): void {
		// Update status for accessory of deviceId
		let dataURL = "https://developer-apis.awair.is/v1/" + this.config.userType + "/devices/" + accessory.context.deviceType + "/" + accessory.context.deviceId + "/air-data/" + this.config.endpoint + "?limit=" + this.config.limit + "&desc=true";
		let options = {
			method: "GET",
//			url: dataURL,
//			json: true,
			headers: {
				Authorization: "Bearer " + this.config.token
			}
		};

		if(this.config.logging){
			this.log("[" + accessory.context.serial + "] dataURL: " + dataURL);
		};

		const response = fetch(dataURL, options);
		
		if(!response) {
      this.log("Awair: unable to query device data.");
      return;
    };

		let data: any[] = response.data;

		let sensors  = data
			.map(sensor => sensor.sensors)
			.reduce((a: any, b: any) => a.concat(b))
			.reduce((a: any, b: any) => {a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; return a}, {});

		let score = data.reduce((a: any, b: any) => {return a + b.score}, 0) / data.length;

		const airQualityService = accessory.getService(hap.Service.AirQualitySensor);
		if (this.config.airQualityMethod == 'awair-aqi') {
			airQualityService
				.updateCharacteristic(hap.Characteristic.AirQuality, this.convertAwairAqi(accessory, sensors));
		} else {
			airQualityService
				.updateCharacteristic(hap.Characteristic.AirQuality, this.convertScore(score));
		};

		let temp: number = sensors.temp;
		let atmos: number = 1;

		if(this.config.logging){
			this.log("[" + accessory.context.serial + "] " + this.config.endpoint + ": " + JSON.stringify(sensors) + ", score: " + score)
		};

		for (var sensor in sensors) {
			switch (sensor) {
				case "temp": // Temperature (C)
					const temperatureService = accessory.getService(hap.Service.TemperatureSensor);
						temperatureService
							.updateCharacteristic(hap.Characteristic.CurrentTemperature, parseFloat(sensors[sensor]))
					break;

					case "humid": // Humidity (%)
					const humidityService = accessory.getService(hap.Service.humidityService);
						humidityService
							.updateCharacteristic(hap.Characteristic.CurrentRelativeHumidity, parseFloat(sensors[sensor]))
					break;

					case "co2": // Carbon Dioxide (ppm)
					const carbonDioxideService = accessory.getService(hap.Service.CarbonDioxideSensor);
					let co2 = sensors[sensor];
					let co2Detected;

					let co2Before = carbonDioxideService.getCharacteristic(hap.Characteristic.CarbonDioxideDetected).value;
					if(this.config.logging){
						this.log("[" + accessory.context.serial + "] CO2Before: " + co2Before)
					};

					// Logic to determine if Carbon Dioxide should trip a change in Detected state
					carbonDioxideService
						.updateCharacteristic(hap.Characteristic.CarbonDioxideLevel, parseFloat(sensors[sensor]))
					if ((this.config.carbonDioxideThreshold > 0) && (co2 >= this.config.carbonDioxideThreshold)) {
						// threshold set and CO2 HIGH
						co2Detected = 1;
						if(this.config.logging){this.log("[" + accessory.context.serial + "] CO2 HIGH: " + co2 + " > " + this.config.carbonDioxideThreshold)};
					} else if ((this.config.carbonDioxideThreshold > 0) && (co2 < this.config.carbonDioxideThresholdOff)) {
						// threshold set and CO2 LOW
						co2Detected = 0;
						if(this.config.logging){this.log("[" + accessory.context.serial + "] CO2 NORMAL: " + co2 + " < " + this.config.carbonDioxideThresholdOff)};
					} else if ((this.config.carbonDioxideThreshold > 0) && (co2 < this.config.carbonDioxideThreshold) && (co2 > this.config.carbonDioxideThresholdOff)) {
						// the inbetween...
						if(this.config.logging){this.log("[" + accessory.context.serial + "] CO2 INBETWEEN: " + this.config.carbonDioxideThreshold + " > [[[" + co2 + "]]] > " + this.config.carbonDioxideThresholdOff)};
						co2Detected = co2Before;
					} else {
						// threshold NOT set
						co2Detected = 0;
						if(this.config.logging){this.log("[" + accessory.context.serial + "] CO2: " + co2)};
					};

					// Prevent sending a Carbon Dioxide detected update if one has not occured
					if ((co2Before == 0) && (co2Detected == 0)) {
						// CO2 low already, don't send
						if(this.config.logging){
							this.log("Carbon Dioxide already low.")
						};
					} else if ((co2Before == 0) && (co2Detected == 1)) {
						// CO2 low to high, send it!
						carbonDioxideService
							.updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, co2Detected);
						if(this.config.logging){
							this.log("Carbon Dioxide low to high.")
						};
					} else if ((co2Before == 1) && (co2Detected == 1)) {
						// CO2 high to not-quite-low-enough-yet, don't send
						if(this.config.logging){
							this.log("Carbon Dioxide already elevated.")
						};
					} else if ((co2Before == 1) && (co2Detected == 0)) {
						// CO2 low to high, send it!
						carbonDioxideService
							.updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, co2Detected);
						if(this.config.logging){
							this.log("Carbon Dioxide high to low.")
							if(this.config.logging){
						};
					} else {
						// CO2 unknown...
							this.log("Carbon Dioxide state unknown.")
						};
					}
					break;

				case "voc":
					let voc = parseFloat(sensors[sensor]);
					let tvoc = this.convertChemicals( accessory, voc, atmos, temp );
					if(this.config.logging){
						this.log("[" + accessory.context.serial + "]: voc (" + voc + " ppb) => tvoc (" + tvoc + " ug/m^3)")
					};
					// Chemicals (ug/m^3)
					airQualityService
						.updateCharacteristic(hap.Characteristic.VOCDensity, tvoc);
					break;

				case "dust": // Dust (ug/m^3)
					airQualityService
						.updateCharacteristic(hap.Characteristic.PM10Density, parseFloat(sensors[sensor]));
					break;

				case "pm25": // PM2.5 (ug/m^3)
					airQualityService
						.updateCharacteristic(hap.Characteristic.PM2_5Density, parseFloat(sensors[sensor]));
					break;

				case "pm10": // PM10 (ug/m^3)
					airQualityService
						.updateCharacteristic(hap.Characteristic.PM10Density, parseFloat(sensors[sensor]));
					break;

				case "lux": // Light (lux)
					airQualityService
						.updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, parseFloat(sensors[sensor]));
					break;

				case "spl_a": // Sound (dBA) - sound currently available in HomeKit
					if(this.config.logging){this.log("[" + accessory.context.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(sensors[sensor]))};
					break;

				default:
					if(this.config.logging){this.log("[" + accessory.context.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(sensors[sensor]))};
					break;
			};
		};
	}

	dataLoop(): void {
		setInterval(() => {
			this.accessories.forEach(accessory => {
				this.updateStatus(accessory);
			});
		}, this.timeout);
	}

	// Conversion functions
	convertChemicals(accessory: PlatformAccessory, voc: number, atmos: number, temp: number): number {
		let vocString = "(" + voc + " * " + this.vocMw + " * " + atmos + " * 101.32) / ((273.15 + " + temp + ") * 8.3144)";
		let tvoc = (voc * this.vocMw * atmos * 101.32) / ((273.15 + temp) * 8.3144);
		if(this.config.logging){
			this.log("[" + accessory.context.serial + "] ppb => ug/m^3 equation: " + vocString)
		};
		return tvoc;
	}

	convertScore(score: number): number {
		if (score >= 90) {
			return 1; // EXCELLENT
		} else if (score >= 80 && score < 90) {
			return 2; // GOOD
		} else if (score >= 60 && score < 80) {
			return 3; // FAIR
		} else if (score >= 50 && score < 60) {
			return 4; // INFERIOR
		} else if (score < 50) {
			return 5; // POOR
		} else {
			return 0; // Error
		};
	}

	convertAwairAqi(accessory: PlatformAccessory, sensors: string[]): number {
		let aqiArray = [];
		for (var sensor in sensors) {
			switch (sensor) {
				case "voc":
					let aqiVoc = parseFloat(sensors[sensor]);
					if (aqiVoc >= 0 && aqiVoc < 333) {
						aqiVoc = 1; // EXCELLENT
					} else if (aqiVoc >= 333 && aqiVoc < 1000) {
						aqiVoc = 2; // GOOD
					} else if (aqiVoc >= 1000 && aqiVoc < 3333) {
						aqiVoc = 3; // FAIR
					} else if (aqiVoc >= 3333 && aqiVoc < 8332) {
						aqiVoc = 4; // INFERIOR
					} else if (aqiVoc >= 8332) {
						aqiVoc = 5; // POOR
					} else {
						aqiVoc = 0; // Error
					}
					aqiArray.push(aqiVoc);
					break;
				case "pm25":
					let aqiPm25 = parseFloat(sensors[sensor]);
					if (aqiPm25 >= 0 && aqiPm25 < 15) {
						aqiPm25 = 1; // EXCELLENT
					} else if (aqiPm25 >= 15 && aqiPm25 < 35) {
						aqiPm25 = 2; // GOOD
					} else if (aqiPm25 >= 35 && aqiPm25 < 55) {
						aqiPm25 = 3; // FAIR
					} else if (aqiPm25 >= 55 && aqiPm25 < 75) {
						aqiPm25 = 4; // INFERIOR
					} else if (aqiPm25 >= 75) {
						aqiPm25 = 5; // POOR
					} else {
						aqiPm25 = 0; // Error
					}
					aqiArray.push(aqiPm25);
					break;
				case "dust":
					let aqiDust = parseFloat(sensors[sensor]);
					if (aqiDust >= 0 && aqiDust < 50) {
						aqiDust = 1; // EXCELLENT
					} else if (aqiDust >= 100 && aqiDust < 50) {
						aqiDust = 2; // GOOD
					} else if (aqiDust >= 150 && aqiDust < 100) {
						aqiDust = 3; // FAIR
					} else if (aqiDust >= 250 && aqiDust < 150) {
						aqiDust = 4; // INFERIOR
					} else if (aqiDust >= 250) {
						aqiDust = 5; // POOR
					} else {
						aqiDust = 0; // Error
					}
					aqiArray.push(aqiDust);
					break;
				default:
					if(this.config.logging){this.log("[" + accessory.context.serial + "] ignoring " + JSON.stringify(sensor) + ": " + parseFloat(sensors[sensor]))};
					aqiArray.push(0);
					break;
			}
		}
		if(this.config.logging){this.log("[" + accessory.context.serial + "] array: " + JSON.stringify(aqiArray))};
		return Math.max(...aqiArray);
	}


}