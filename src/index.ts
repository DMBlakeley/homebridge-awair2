/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
/* eslint-disable no-mixed-spaces-and-tabs */
import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  // CharacteristicEventTypes,
  // CharacteristicSetCallback,
  // CharacteristicValue,
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
	// ToDo: re-implement 'vocMw' as an optional configuration in the settings
	
	// default values when not defined in config.json
	private carbonDioxideThreshold = 0;
	private carbonDioxideThresholdOff = 0;
	private airQualityMethod = 'awair-aqi'; // ToDo: NowCast AQI
	private userType = 'users/self';
	private polling_interval = 900;
	private limit = 1;
	private endpoint = '15-min-avg';

	//default User Info Hobbyist samples per 24 hours reference UTC 00:00:00
	private userTier = 'Hobbyist';
	private fifteenMin = 100;
	private fiveMin = 300;
	private raw = 500;
	private latest = 300;
	private secondsPerDay = 60 * 60 * 24;

	private readonly accessories: PlatformAccessory[] = [];
	private devices: any[] = []; // array of Awair devices
	private ignoredDevices: string [] = [];
	
	constructor(log: Logging, config: PlatformConfig, api: API) {
	  this.log = log;
	  this.config = config as unknown as AwairPlatformConfig;
	  this.api = api;

	  // We need Developer token or we're not starting.
	  // ToDo: how would this handle local-only? i.e. merging homebridge-awair and homebridge-awair-local into a single plugin
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
	  
	  // config.limit used for averaging of 'raw', '5-min', and '15-min' data, most recent sample used for 'latest'
	  if (this.config.limit && this.config.endpoint === 'latest') {
	    // no 'limit' applied to 'latest' endpoint, produces exactly one value
	    this.limit = 1;
	  } else {
	    // useful for all endpoints in case you want to rely on a different averaging scheme, for example, a 24 hour average (often used for AQI calculation) would be easier with the '15-min'avg' endpoint
	    this.limit = this.config.limit;
	  }
	  
	  if (this.config.endpoint) {
	    this.endpoint = this.config.endpoint;
	  }
		
	  if (this.config.ignoredDevices) {
	    this.ignoredDevices = this.config.ignoredDevices;
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

	async didFinishLaunching(): Promise<void> {

	  // Get Developer User Info
	  await this.getUserInfo();

	  // Get Awair devices from your account defined by Developer Access Token
	  await this.getAwairDevices();
		
	  const serNums: string[] = []; // array to keep track of devices

	  // Add accessory for each Awair device
	  for (let i = 0; i < this.devices.length; i++) {
	    const device = this.devices[i];
	    if (!this.ignoredDevices.includes(device.macAddress)) {
	      await this.addAccessory.bind(this, device)();
	    }
	    serNums.push(device.macAddress);
	  }
		
	  // Remove old, no longer used or ignored devices
	  const badAccessories: Array<PlatformAccessory> = [];
	  this.accessories.forEach(cachedAccessory => {
	    if (!serNums.includes(cachedAccessory.context.serial) || this.ignoredDevices.includes(cachedAccessory.context.serial)) {
	      badAccessories.push(cachedAccessory);
	    }
	  });
	  await this.removeAccessories(badAccessories);

	  // Add Accessory Info to each accessory
	  this.accessories.forEach(accessory => {
	    this.addAccInfo(accessory);
	  });
		
	  // get initial API usage
	  this.accessories.forEach(accessory => {
	    if (this.config.logging) {
	      this.log('[' + accessory.context.serial + '] Getting API usage status...' + accessory.context.deviceUUID);
	    }
	  });
		
	  // get initial AirData
	  this.accessories.forEach(accessory => {
	    if (this.config.logging) {
	      this.log('[' + accessory.context.serial + '] Getting initial status...' + accessory.context.deviceUUID);
	    }
	    if (accessory.context.deviceType === 'awair-omni') {
	      this.getOmniLocalData(accessory); // fetch 'lux' and 'spl_a'
	      this.getOmniBatteryStatus(accessory);
	    }
	    this.updateStatus(accessory);   
	  });
		
	  // start AirData collection according to polling_interval settings
	  setInterval(() => {
	    this.accessories.forEach(accessory => {
	      if (this.config.logging) {
	        this.log('[' + accessory.context.serial + '] Updating status...' + accessory.context.deviceUUID);
	      }
	      if (accessory.context.deviceType === 'awair-omni') {
	        this.getOmniLocalData(accessory); // fetch 'lux' and 'spl_a'
	        this.getOmniBatteryStatus(accessory);
	      }
	      this.updateStatus(accessory);
	    });
	  }, this.polling_interval * 1000);
	}

	/*
   * This function is invoked when homebridge restores EACH cached accessory from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
	configureAccessory(accessory: PlatformAccessory): void {
	  this.log('Loading accessory from cache:', accessory.displayName);

	  // add the restored accessory to the accessories cache so we can track if it has already been registered
	  this.accessories.push(accessory);
	}

	// get User Info profile from your Awair development account
	async getUserInfo(): Promise<void> {
	  const userInfoURL = 'https://developer-apis.awair.is/v1/' + this.config.userType;

	  const options = {
	    method: 'GET',
	    url: userInfoURL,
	    json: true, // Automatically parses the JSON string in the response
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };

	  await request(options)
    	.then((response) => {
	      if(this.config.logging && this.config.verbose) {
	        this.log('userInfo: ' + JSON.stringify(response));
	      }
				
	      this.userTier = response.tier;

	      const permissions: any[] = response.permissions;
								
	      for (let i = 0; i < permissions.length; i++) {
	        switch (permissions[i].scope){
					  case 'FIFTEEN_MIN':
	            this.fifteenMin = parseFloat(permissions[i].quota);
	            break;

	          case 'FIVE_MIN':
	            this.fiveMin = parseFloat(permissions[i].quota);
	            break;

	          case 'RAW':
	            this.raw = parseFloat(permissions[i].quota);
	            break;
						
	          case 'LATEST':
	            this.latest = parseFloat(permissions[i].quota);
	            break;
						
	          default:
	            break;
	        }
	      }
	      
	      switch (this.endpoint) {
	        case '15-min-avg': // practical minimum is 15-min or 900 seconds
	          this.polling_interval = Math.round(this.secondsPerDay / this.fifteenMin);
	          this.polling_interval = (this.polling_interval < 900 ? 900 : this.polling_interval);
	          break;

	        case '5-min-avg': // practical minimum is 5-min or 300
	          this.polling_interval = Math.round(this.secondsPerDay / this.fiveMin);
	          this.polling_interval = (this.polling_interval < 300 ? 300 : this.polling_interval);
	          break;
						
	        case 'raw': // minimum is (this.limit * 10 seconds), 200 min for "Hobbyist"
	          this.polling_interval = Math.round(this.secondsPerDay / this.raw);
	          if (this.userTier === 'Hobbyist') {
	            this.polling_interval = ((this.limit * 10) < 200 ? 200 : (this.limit * 10));
	          } else {
	            this.polling_interval = (this.polling_interval < (this.limit * 10) ? (this.limit * 10) : this.polling_interval);
	          }
	          break;
						
	        case 'latest': // latest is updated every 10 seconds on device, 300 min for "Hobbyist"
	          this.polling_interval = Math.round(this.secondsPerDay / this.latest);
	          if (this.userTier === 'Hobbyist') {
	            this.polling_interval = (this.polling_interval < 300 ? 300 : this.polling_interval);
	          } else {
	            this.polling_interval = (this.polling_interval < 60 ? 60 : this.polling_interval);
	          }
	          break;
	      }
				
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getUserInfo error: ' + err);
	      }
	    });
	  return;
	}

	// get devices registered in your Awair account
	async getAwairDevices(): Promise<void> {
	  const URL = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices';

	  const options = {
	    method: 'GET',
	    url: URL,
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
	        if(this.config.logging && this.config.verbose){
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

	// add single Accessory to Platform
	async addAccessory(data: DeviceConfig): Promise<void> {

	  if (this.config.logging) {
	    this.log('Initializing platform accessory ' + data.name + '...');
	  }
		
	  let accessory = this.accessories.find(cachedAccessory => {
	    return cachedAccessory.context.serial === data.macAddress;
	  });
		
	  if (!accessory) {  // accessory does not exist in cache, initialze as new
  	  const uuid = hap.uuid.generate(data.deviceUUID);
    	accessory = new Accessory(data.name, uuid);

	    // Using 'context' property of PlatformAccessory saves information to accessory cache
	    accessory.context.name = data.name;
	    accessory.context.serial = data.macAddress;
	    accessory.context.timezone = data.timezone;
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

	// remove no longer used Accessories from Platform
	async removeAccessories(accessories: Array<PlatformAccessory>): Promise<void> {
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
	    const lightLevelSensor = accessory.getService(hap.Service.LightSensor);
	    if (lightLevelSensor) {
	      lightLevelSensor
	        .setCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, '--');
	      lightLevelSensor
	        .getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
	        .setProps({
	          minValue: 0,
	          maxValue: 64000,
	        });
	    }
	  }
		
	  // Add Omni battery service
	  if (accessory.context.devType === 'awair-omni') {
	    const batteryService = accessory.getService(hap.Service.BatteryService);
	    if (batteryService) {
	      batteryService
	        .setCharacteristic(hap.Characteristic.BatteryLevel, 50); // 0 -> 100%
	      batteryService
	        .setCharacteristic(hap.Characteristic.ChargingState, 0); // NOT_CHARGING = 0, CHARGING = 1, NOT_CHARGEABLE = 2
	      batteryService
	        .setCharacteristic(hap.Characteristic.StatusLowBattery, 0); // Normal = 0, Low = 1 
	    }
	  }
		
	  if(this.config.logging) {
	    this.log('[' + accessory.context.serial + '] addServices completed');
	  }

	  this.accessories.push(accessory);
	}

	// add Accessory Information to each Accessory
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

	// update AirData for 'accessory'
	async updateStatus(accessory: PlatformAccessory): Promise<void> {
	  // Update status for accessory of deviceId
	  const URL = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices/' + accessory.context.deviceType + '/' 
			+ accessory.context.deviceId + '/air-data/' + this.endpoint + '?limit=' + this.limit + '&desc=true';
	  const options = {
	    method: 'GET',
	    url: URL,
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

	      // determine average score over data samples
	      const score = data.reduce((a: any, b: any) => a + b.score, 0) / data.length;

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

	// Omni battery level and charging status via localAPI (must enable in Awair App)
	async getOmniBatteryStatus(accessory: PlatformAccessory): Promise<void> {
	  const URL = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/settings/config/data';
	  const options = {
	    method: 'GET',
	    url: URL,
	    json: true, // Automatically parses the JSON string in the response
	  };

	  await request(options)
    	.then((response) => {
	      // eslint-disable-next-line quotes
	      const powerStatus = response["power-status"];
	      const batteryLevel: number = powerStatus.battery;
	      const batteryPlugged: boolean = powerStatus.plugged;
	      const lowBattery: boolean = (batteryLevel < 30) ? true : false;
				
	      if(this.config.logging && this.config.verbose) {
	        this.log('[' + accessory.context.serial + '] batteryLevel: ' + batteryLevel + ' batteryPlugged: ' + batteryPlugged 
						+ ' lowBattery: ' + lowBattery);
	      }

	      const batteryService = accessory.getService(hap.Service.BatteryService);
	      if (batteryService) {
	        batteryService
	          .updateCharacteristic(hap.Characteristic.BatteryLevel, batteryLevel); // 0 -> 100%
	        batteryService
	          .updateCharacteristic(hap.Characteristic.ChargingState, batteryPlugged); // NOT_CHARGING=0, CHARGING=1
	        batteryService
	          .updateCharacteristic(hap.Characteristic.StatusLowBattery, lowBattery); // <30%
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getOmniBatteryStatus error: ' + err);
	      }
	    });
	  return;
	}

	// get Omni local API device data
	async getOmniLocalData(accessory: PlatformAccessory): Promise<void> {
	  const URL = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/air-data/latest';
		
	  const options = {
	    method: 'GET',
	    url: URL,
	    json: true, // Automatically parses the JSON string in the response
	  };

	  await request(options)
    	.then((response) => {

	      const omniLux: number = response.lux;
	      const omniSpl_a: number = response.spl_a;
				
	      if(this.config.logging && this.config.verbose) {	
	        this.log('Local data for ' + accessory.context.deviceType + ': lux: ' + omniLux + ' spl_a: ' + omniSpl_a);
	      }
			
	      const lightLevelSensor = accessory.getService(hap.Service.LightSensor);
	      if (lightLevelSensor) {
	        lightLevelSensor
	          .updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, omniLux);
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getOmniLocalData error: ' + err);
	      }
	    });
	  return;
	}

	// get local API device data
	async getLocalData(accessory: PlatformAccessory): Promise<void> {
	  const URL = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/air-data/latest';
		
	  const options = {
	    method: 'GET',
	    url: URL,
	    json: true, // Automatically parses the JSON string in the response
	  };

	  await request(options)
    	.then((response) => {
	      if(this.config.logging && this.config.verbose) {	
	        this.log('Local data for ' + accessory.context.deviceType + ': ' + JSON.stringify(response));
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getLocalData error: ' + err);
	      }
	    });
	  return;
	}

	// get localAPI device data
	async getLocalConfig(accessory: PlatformAccessory): Promise<void> {
	  const URL = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/settings/config/data';
		
	  const options = {
	    method: 'GET',
	    url: URL,
	    json: true, // Automatically parses the JSON string in the response
	  };

	  await request(options)
    	.then((response) => {
	      if(this.config.logging && this.config.verbose) {	
	        this.log('Local config for ' + accessory.context.deviceType + ': ' + JSON.stringify(response));
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getLocalConfig error: ' + err);
	      }
	    });
	  return;
	}

	// get User API usage for a device from your Awair development account
	async getApiUsage(accessory: PlatformAccessory): Promise<void> {
	  const URL = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices/' + accessory.context.deviceType + '/' 
		+ accessory.context.deviceId + '/api-usages';

	  const options = {
	    method: 'GET',
	    url: URL,
	    json: true, // Automatically parses the JSON string in the response
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };

	  await request(options)
    	.then((response) => {
	      if(this.config.logging && this.config.verbose) {
	        this.log('apiUsage for ' + accessory.context.deviceUUID + ': ' + JSON.stringify(response));
	      }
	    })
    	.catch((err) => {
	      if(this.config.logging){
	        this.log('getApiUsage error: ' + err);
	      }
	    });
	  return;
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
	        } else if (aqiDust >= 50 && aqiDust < 100) {
	          aqiDust = 2; // GOOD
	        } else if (aqiDust >= 100 && aqiDust < 150) {
	          aqiDust = 3; // FAIR
	        } else if (aqiDust >= 150 && aqiDust < 250) {
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
