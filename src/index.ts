/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
/* eslint-disable no-mixed-spaces-and-tabs */
import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from 'homebridge';

import { AwairPlatformConfig, DeviceConfig } from './configTypes';
import request = require('request-promise');
import * as packageJSON from '../package.json';

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-awair2';
const PLATFORM_NAME = 'Awair2';

// Register Awair Platform
export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, AwairPlatform);
};

class AwairPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
	private readonly api: API;
	private readonly config: AwairPlatformConfig;
	private readonly manufacturer = 'Awair';
	private readonly vocMw = 72.66578273019740; // Molecular Weight (g/mol) of a reference VOC gas or mixture
	
	// default values when not defined in config.json
	private carbonDioxideThreshold = 0;
	private carbonDioxideThresholdOff = 0;
	private airQualityMethod = 'awair-score';
	private userType = 'users/self';
	private polling_interval = 900;
	private limit = 12;
	private endpoint = '15-min-avg';
	
	private readonly accessories: PlatformAccessory[] = [];
	private devices: any[] = []; // array of Awair devices
	
	constructor(log: Logging, config: PlatformConfig, api: API) {
	  this.log = log;
	  this.config = config as unknown as AwairPlatformConfig;
	  this.api = api;

	  // We need Developer token or we're not starting.
	  if(!this.config.token) {
	    this.log('Awair Developer token not specified. Reference installation instructions.');
	    return;
	  }
		
	  // check for Optional entries in config.json
	  if (this.config.carbonDioxideThreshold){
	    this.carbonDioxideThreshold = Number(this.config.carbonDioxideThreshold);
	  }
	  
	  if (this.config.carbonDioxideThresholdOff) {
	    this.carbonDioxideThresholdOff = Number(this.config.carbonDioxideThresholdOff);
	  } else {
	    this.carbonDioxideThresholdOff = Number(this.config.carbonDioxideThreshold);
	  }
	  
	  if (this.config.airQualityMethod) {
	    this.airQualityMethod = this.config.airQualityMethod;
	  }
	  
	  if (this.config.userType) {
	    this.userType = this.config.userType;
	  }
	  
	  if (this.config.polling_interval) {
	    this.polling_interval = this.config.polling_interval;
	  }
	  
	  if (this.config.limit) {
	    this.limit = this.config.limit;
	  }
	  
	  if (this.config.endpoint) {
	    this.endpoint = this.config.endpoint;
	  }
	  
	  // Create array of Awair accessories
	  this.accessories = [];

	  /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
	  api.on(APIEvent.DID_FINISH_LAUNCHING, this.discoverDevices.bind(this));				
	}

	// Start discovery of new accessories.
	async discoverDevices(): Promise<void> {

	  // Get Awair devices from your account defined by token
	  await this.getAwairDevices();
		
	  const serNums: string[] = []; // array to keep track of devices

	  // Add accessory for each Awair device
	  for (let i = 0; i < this.devices.length; i++) {
	    const device = this.devices[i];
	    this.addAccessory.bind(this, device)();
	    serNums.push(device.macAddress);
	  }

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
	  this.log('Loading accessory from cache:', accessory.displayName);

	  // add the restored accessory to the accessories cache so we can track if it has already been registered
	  this.accessories.push(accessory);
		
	  // get initial status
	  this.updateStatus(accessory);
	  if (accessory.context.deviceType === 'awair-omni') {
	    this.getBatteryStatus(accessory);
	  }
		
	  // start collecting data, loooping according to config settings
	  this.dataLoop(); 
	}

	async getAwairDevices(): Promise<void> {
	  const deviceURL = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices';

	  const options = {
	    method: 'GET',
	    url: deviceURL,
	    json: true, // Automatically parses the JSON string in the response
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };

	  await request(options)
    	.then((response) => {
	      this.devices = response.devices;
	      if(this.config.logging){
	      	this.log('getAwairDevices: number discovered: ' + this.devices.length);
	      }
	      for (let i = 0; i < this.devices.length; i++) {
	        if(this.config.logging){
	          this.log('getAwairDevices: discovered device: [' + i + '] ' + JSON.stringify(this.devices[i]));
	        }
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getAwairDevices error: ' + err);
	      }
	    });
	  return;
	}

	addAccessory(data: DeviceConfig): void {
	  this.log('Initializing platform accessory ' + data.name + '...');

	  let accessory = this.accessories.find(cachedAccessory => {
	    return cachedAccessory.context.serial === data.macAddress;
	  });

	  if (!accessory) {  // accessory does not exist in cache, initialze as new
  	  const uuid = hap.uuid.generate(data.deviceUUID);
    	accessory = new Accessory(data.name, uuid);

	    // Using 'context' property of PlatformAccessory saves information to accessory cache
	    accessory.context.name = data.name;
	    accessory.context.serial = data.macAddress;
	    accessory.context.deviceType = data.deviceType;
	    accessory.context.deviceUUID = data.deviceUUID;
	    accessory.context.deviceId = data.deviceId;

	    accessory.addService(hap.Service.AirQualitySensor, data.name);
	    accessory.addService(hap.Service.TemperatureSensor, data.name + ' Temp');
	    accessory.addService(hap.Service.HumiditySensor, data.name + ' Humidity');

	    if (data.deviceType !== 'awair-mint' && data.deviceType !== 'awair-glow-c') {
	      accessory.addService(hap.Service.CarbonDioxideSensor, data.name + ' CO2');
	    }

	    if (data.deviceType === 'awair-omni' || data.deviceType === 'awair-mint') {
	      accessory.addService(hap.Service.LightSensor, data.name + ' Light');
	    }

	    // *** Add Omni battery service
	    if (data.deviceType === 'awair-omni') {
	      accessory.addService(hap.Service.BatteryService, data.name + ' Battery');
	    }
			
	    this.addServices(accessory);

	    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

	    this.accessories.push(accessory);

	  } else { // acessory exists, use data from cache
	    accessory.context.name = data.name;
	    accessory.context.serial = data.macAddress;
	    accessory.context.deviceType = data.deviceType;
	    accessory.context.deviceUUID = data.deviceUUID;
	    accessory.context.deviceId = data.deviceId;
	  }
	}

	removeAccessories(accessories: Array<PlatformAccessory>): void {
	  accessories.forEach(accessory => {
	    this.log(accessory.context.name + ' is removed from HomeBridge.');
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
	  if (airQualityService) {
	    if (accessory.context.devType === 'awair-glow' || accessory.context.devType === 'awair-glow-c') {
	      airQualityService
	        .setCharacteristic(hap.Characteristic.AirQuality, '--')
	        .setCharacteristic(hap.Characteristic.VOCDensity, '--');
	    } else if (accessory.context.devType === 'awair') {
	      airQualityService
	        .setCharacteristic(hap.Characteristic.AirQuality, '--')
	        .setCharacteristic(hap.Characteristic.VOCDensity, '--')
	        .setCharacteristic(hap.Characteristic.PM10Density, '--');
	    } else { // mint, omni, awair-r2, element
	      airQualityService
	        .setCharacteristic(hap.Characteristic.AirQuality, '--')
	        .setCharacteristic(hap.Characteristic.VOCDensity, '--')
	        .setCharacteristic(hap.Characteristic.PM2_5Density, '--');
	    }
	    airQualityService
	      .getCharacteristic(hap.Characteristic.VOCDensity)
	      .setProps({
	        minValue: 0,
	        maxValue: 100000,
	      });
	  }

	  // Add Temperature Service
	  const temperatureService = accessory.getService(hap.Service.TemperatureSensor);
	  if (temperatureService) {
	    temperatureService
	      .setCharacteristic(hap.Characteristic.CurrentTemperature, '--');
	    temperatureService
	      .getCharacteristic(hap.Characteristic.CurrentTemperature)
	      .setProps({
	        minValue: -100,
	        maxValue: 100,
	      });
	  }
	  // Add Humidity Service
	  const humidityService = accessory.getService(hap.Service.HumiditySensor);
	  if (humidityService) {
	    humidityService
	      .setCharacteristic(hap.Characteristic.CurrentRelativeHumidity, '--');
	  }

	  // Add Carbon Dioxide Service
	  if (accessory.context.devType !== 'awair-mint' && accessory.context.devType !== 'awair-glow-c') {
	    const carbonDioxideService = accessory.getService(hap.Service.CarbonDioxideSensor);
	    if (carbonDioxideService) {
	      carbonDioxideService
	        .setCharacteristic(hap.Characteristic.CarbonDioxideLevel, '--');
	    }
	  }

	  // Add Light Sensor Service
	  if (accessory.context.devType === 'awair-omni' || accessory.context.devType === 'awair-mint') {
	    const lightLevelService = accessory.getService(hap.Service.LightSensor);
	    if (lightLevelService) {
	      lightLevelService
	        .setCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, '--');
	      lightLevelService
	        .getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
	        .setProps({
	          minValue: 0,
	          maxValue: 64000,
	        });
	    }
	  }
		
	  // *** Add Omni battery service
	  if (accessory.context.devType === 'awair-omni') {
	    const batteryService = accessory.getService(hap.Service.BatteryService);
	    if (batteryService) {
	      batteryService
	        .setCharacteristic(hap.Characteristic.BatteryLevel, '--'); // 0 -> 100%
	      batteryService
	        .setCharacteristic(hap.Characteristic.ChargingState, '--'); // NOT_CHARGING, CHARGING, NOT_CHARBEABLE
	    }
	  }

	  this.log('[' + accessory.context.serial + '] addServices completed');

	  this.accessories.push(accessory);
	}

	addAccInfo(accessory: PlatformAccessory): void {
	  const accInfo = accessory.getService(hap.Service.AccessoryInformation);
	  if (accInfo) {
	    accInfo
	      .updateCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer);
	    accInfo
	      .updateCharacteristic(hap.Characteristic.Model, accessory.context.deviceType);
	    accInfo
	      .updateCharacteristic(hap.Characteristic.SerialNumber, accessory.context.serial);
	    accInfo
	      .updateCharacteristic(hap.Characteristic.FirmwareRevision, packageJSON.version);
	  }
	}

	async updateStatus(accessory: PlatformAccessory): Promise<void> {
	  // Update status for accessory of deviceId
	  const dataURL = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices/' + accessory.context.deviceType + '/' 
			+ accessory.context.deviceId + '/air-data/' + this.endpoint + '?limit=' + this.limit + '&desc=true';
	  const options = {
	    method: 'GET',
	    url: dataURL,
	    json: true,
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };

	  await request.get(options)
    	.then((response) => {
	      const data: any[] = response.data;
				
	      const sensors: any = data
	        .map(sensor => sensor.sensors)
	        .reduce((a: any, b: any) => a.concat(b))
	        .reduce((a: any, b: any) => {
	          a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; return a;
	        }, {});

	      const score = data.reduce((a: any, b: any) => {
	        return a + b.score;
	      }, 0) / data.length;

	      const airQualityService = accessory.getService(hap.Service.AirQualitySensor);
	      if (airQualityService) {
	        if (this.airQualityMethod === 'awair-aqi') {
	          airQualityService
	            .updateCharacteristic(hap.Characteristic.AirQuality, this.convertAwairAqi(accessory, sensors));
	        } else {
	          airQualityService
	            .updateCharacteristic(hap.Characteristic.AirQuality, this.convertScore(score));
	        }
	      }

	      const temp: number = sensors.temp;
	      const atmos = 1;
		
	      if(this.config.logging){
	        this.log('[' + accessory.context.serial + '] ' + this.endpoint + ': ' + JSON.stringify(sensors) + ', score: ' + score);
	      }

	      for (const sensor in sensors) {
	        switch (sensor) {
	          case 'temp': // Temperature (C)
	            const temperatureService = accessory.getService(hap.Service.TemperatureSensor);
	            if (temperatureService) {
	              temperatureService
	                .updateCharacteristic(hap.Characteristic.CurrentTemperature, parseFloat(sensors[sensor]));
	            }
	            break;
		
	          case 'humid': // Humidity (%)
	            const humidityService = accessory.getService(hap.Service.HumiditySensor);
	            if (humidityService) {
	              humidityService
	                .updateCharacteristic(hap.Characteristic.CurrentRelativeHumidity, parseFloat(sensors[sensor]));
	            }
	            break;
		
	          case 'co2': // Carbon Dioxide (ppm)
	            const carbonDioxideService = accessory.getService(hap.Service.CarbonDioxideSensor);
	            const co2 = sensors[sensor];
	            let co2Detected;
		
	            if (carbonDioxideService) {
	              const co2Before = carbonDioxideService.getCharacteristic(hap.Characteristic.CarbonDioxideDetected).value;
	              if(this.config.logging){
	                this.log('[' + accessory.context.serial + '] CO2Before: ' + co2Before);
	              }
		
	              // Logic to determine if Carbon Dioxide should trip a change in Detected state
	              carbonDioxideService
	                .updateCharacteristic(hap.Characteristic.CarbonDioxideLevel, parseFloat(sensors[sensor]));
	              if ((this.carbonDioxideThreshold > 0) && (co2 >= this.carbonDioxideThreshold)) {
	                // threshold set and CO2 HIGH
	                co2Detected = 1;
	                if(this.config.logging){
	                  this.log('[' + accessory.context.serial + '] CO2 HIGH: ' + co2 + ' > ' + this.carbonDioxideThreshold);
	                }
	              } else if ((this.carbonDioxideThreshold > 0) && (co2 < this.carbonDioxideThresholdOff)) {
	                // threshold set and CO2 LOW
	                co2Detected = 0;
	                if(this.config.logging){
	                  this.log('[' + accessory.context.serial + '] CO2 NORMAL: ' + co2 + ' < ' + this.carbonDioxideThresholdOff);
	                }
	              } else if ((this.carbonDioxideThreshold > 0) && (co2 < this.carbonDioxideThreshold) 
														&& (co2 > this.carbonDioxideThresholdOff)) {
	                // the inbetween...
	                if(this.config.logging){
	                  this.log('[' + accessory.context.serial + '] CO2 INBETWEEN: ' + this.carbonDioxideThreshold 
															+ ' > [[[' + co2 + ']]] > ' + this.carbonDioxideThresholdOff);
	                }
	                co2Detected = co2Before;
	              } else {
	                // threshold NOT set
	                co2Detected = 0;
	                if(this.config.logging){
	                  this.log('[' + accessory.context.serial + '] CO2: ' + co2);
	                }
	              }
		
	              // Prevent sending a Carbon Dioxide detected update if one has not occured
	              if ((co2Before === 0) && (co2Detected === 0)) {
	                // CO2 low already, don't send
	                if(this.config.logging){
	                  this.log('Carbon Dioxide already low.');
	                }
	              } else if ((co2Before === 0) && (co2Detected === 1)) {
	                // CO2 low to high, send it!
	                carbonDioxideService
	                  .updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, co2Detected);
	                if(this.config.logging){
	                  this.log('Carbon Dioxide low to high.');
	                }
	              } else if ((co2Before === 1) && (co2Detected === 1)) {
	                // CO2 high to not-quite-low-enough-yet, don't send
	                if(this.config.logging){
	                  this.log('Carbon Dioxide already elevated.');
	                }
	              } else if ((co2Before === 1) && (co2Detected === 0)) {
	                // CO2 low to high, send it!
	                carbonDioxideService
	                  .updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, co2Detected);
	                if(this.config.logging){
	                  this.log('Carbon Dioxide high to low.');
	                } else {
	                  // CO2 unknown...
	                  this.log('Carbon Dioxide state unknown.');
	                }
	              }
	            }
	            break;
		
	          case 'voc':
	            const voc = parseFloat(sensors[sensor]);
	            const tvoc = this.convertChemicals( accessory, voc, atmos, temp );
	            if(this.config.logging){
	              this.log('[' + accessory.context.serial + ']: voc (' + voc + ' ppb) => tvoc (' + tvoc + ' ug/m^3)');
	            }
	            // Chemicals (ug/m^3)
	            if (airQualityService) {
	              airQualityService
	                .updateCharacteristic(hap.Characteristic.VOCDensity, tvoc);
	            }
	            break;
		
	          case 'dust': // Dust (ug/m^3)
	            if (airQualityService) {
	              airQualityService
	                .updateCharacteristic(hap.Characteristic.PM10Density, parseFloat(sensors[sensor]));
	            }
	            break;
		
	          case 'pm25': // PM2.5 (ug/m^3)
	            if (airQualityService) {
	              airQualityService
	                .updateCharacteristic(hap.Characteristic.PM2_5Density, parseFloat(sensors[sensor]));
	            }
	            break;
		
	          case 'pm10': // PM10 (ug/m^3)
	            if (airQualityService) {
	              airQualityService
	                .updateCharacteristic(hap.Characteristic.PM10Density, parseFloat(sensors[sensor]));
	            }
	            break;
		
	          case 'lux': // Light (lux)
	            if (airQualityService) {
	              airQualityService
	                .updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, parseFloat(sensors[sensor]));
	            }
	            break;
		
	          case 'spl_a': // Sound (dBA) - sound currently available in HomeKit
	            if(this.config.logging){
	              this.log('[' + accessory.context.serial + '] ignoring ' + JSON.stringify(sensor) + ': ' + parseFloat(sensors[sensor]));
	            }
	            break;
		
	          default:
	            if(this.config.logging){
	              this.log('[' + accessory.context.serial + '] ignoring ' + JSON.stringify(sensor) + ': ' + parseFloat(sensors[sensor]));
	            }
	            break;
	        }
	      }
    		})
	    .catch((err) => {
	      if(this.config.logging){
	        this.log('updateStatus error: ' + err);
	      }
	    });
	  return;
	}

	// *** Add Mint battery service
	async getBatteryStatus(accessory: PlatformAccessory): Promise<void> {
	  const batteryURL = 'https://developer-apis.awair.is/v1/devices/' + accessory.context.deviceType + '/' 
			+ accessory.context.deviceId + '/power-status';

	  const options = {
	    method: 'GET',
	    url: batteryURL,
	    json: true, // Automatically parses the JSON string in the response
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };

	  await request(options)
    	.then((response) => {
	      const batteryLevel: number = response.percentage;
	      const batteryPlugged: boolean = response.plugged;				

	      const batteryService = accessory.getService(hap.Service.BatteryService);
	      if (batteryService) {
	        batteryService
	          .updateCharacteristic(hap.Characteristic.BatteryLevel, batteryLevel); // 0 -> 100%
	        batteryService
	          .updateCharacteristic(hap.Characteristic.ChargingState, batteryPlugged); // NOT_CHARGING=0, CHARGING=1, NOT_CHARBEABLE=2
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getBatteryStatus error: ' + err);
	      }
	    });
	  return;
	}

	dataLoop(): void { // will loop until reboot or error
	  setInterval(() => {
	    let battCheck = 0; // only check battery every 4th loop so not to exceed Tier Quota for GET_POWER_STATUS
	    this.accessories.forEach(accessory => {
	      this.updateStatus(accessory);
	      if (accessory.context.deviceType === 'awair-omni' && battCheck <= 3) {
	        this.getBatteryStatus(accessory);
	      }
	      battCheck = battCheck++ % 4;
	    });
	  }, this.polling_interval * 1000);
	}

	// Conversion functions
	convertChemicals(accessory: PlatformAccessory, voc: number, atmos: number, temp: number): number {
	  const vocString = '(' + voc + ' * ' + this.vocMw + ' * ' + atmos + ' * 101.32) / ((273.15 + ' + temp + ') * 8.3144)';
	  const tvoc = (voc * this.vocMw * atmos * 101.32) / ((273.15 + temp) * 8.3144);
	  if(this.config.logging){
	    this.log('[' + accessory.context.serial + '] ppb => ug/m^3 equation: ' + vocString);
	  }
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
	  }
	}

	convertAwairAqi(accessory: PlatformAccessory, sensors: string[]): number {
	  const aqiArray = [];
	  for (const sensor in sensors) {
	    switch (sensor) {
	      case 'voc':
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
	      case 'pm25':
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
	      case 'dust':
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
	        if(this.config.logging){
	          this.log('[' + accessory.context.serial + '] ignoring ' + JSON.stringify(sensor) + ': ' + parseFloat(sensors[sensor]));
	        }
	        aqiArray.push(0);
	        break;
	    }
	  }
	  if(this.config.logging){
	    this.log('[' + accessory.context.serial + '] array: ' + JSON.stringify(aqiArray));
	  }
	  return Math.max(...aqiArray);
	}
  
}
