/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-case-declarations */
/* eslint-disable no-mixed-spaces-and-tabs */
import {
  API,
  APIEvent,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from 'homebridge';

import { AwairPlatformConfig, DeviceConfig } from './configTypes';
import axios from 'axios';
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
	
	// default values when not defined in config.json
	private vocMw = 72.66578273019740; // Molecular Weight (g/mol) of a reference VOC gas or mixture
	private airQualityMethod = 'awair-aqi';
	private userType = 'users/self';
	private polling_interval = 900;
	private limit = 1;
	private endpoint = '15-min-avg';
	private carbonDioxideThreshold = 1000;
	private carbonDioxideThresholdOff = 800;
	private occupancyOffset = 2.0;
	private occDetectedNotLevel = 55; // min level is 50dBA  +/- 3dBA due to dust sensor fan noise in Omni
	private occDetectedLevel = 60;

	//default User Info Hobbyist samples per 24 hours reference UTC 00:00:00
	private userTier = 'Hobbyist';
	private fifteenMin = 100;
	private fiveMin = 300;
	private raw = 500;
	private latest = 300;
	private secondsPerDay = 60 * 60 * 24;

	// PlaftformAccessory defaults
	private readonly accessories: PlatformAccessory[] = [];
	private devices: any[] = []; // array of Awair devices
	private ignoredDevices: string [] = []; // array of ignored Awair devices
	private omniPresent = false; // flag that Awair account contains Omni device(s), enables occupancy detection loop

	// displayModes and ledModes for Omni, Awair-r2 and Awair Element
	private displayModes: string[] = ['score', 'temp', 'humid', 'co2', 'voc', 'pm25', 'clock'];
	private ledModes: string[] = ['auto', 'sleep', 'manual'];

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
	  if (this.config.userType) {
	    this.userType = this.config.userType;
	  }
	  
	  if (this.config.airQualityMethod) {
	    this.airQualityMethod = this.config.airQualityMethod;
	  }
		
	  if (this.airQualityMethod === 'nowcast-aqi') {
	    this.endpoint = '15-min-avg'; // nowcast-aqi is calculated over 12 hours, 15-min-avg data will be used for calculation
	    this.limit = 48; // nowcast-aqi is calculated over 12 hours
	  } else if (this.config.endpoint) {
	    this.endpoint = this.config.endpoint;
	  }			
		
	  // config.limit used for averaging of 'raw', '5-min', and '15-min' data, most recent sample used for 'latest'
	  // Useful for all endpoints in case you want to rely on a different averaging scheme, for example, a 24 hour average (often used 
	  // for IAQ calculation) would be easier with the '15-min'avg' endpoint.
	  if (this.config.limit && this.airQualityMethod !== 'nowcast-aqi') {	
	    switch (this.endpoint) {  // check that this.config.limit does not exceed limits
	      case '15-min-avg':
	        this.limit = (this.config.limit > 672) ? 672 : this.config.limit; // 672 samples max or ~7 days
	        break;
	      case '5-min-avg':
	        this.limit = (this.config.limit > 288) ? 288 : this.config.limit; // 288 samples max or ~24 hours
	        break;
	      case 'raw':
	        this.limit = (this.config.limit > 360) ? 360 : this.config.limit; // 360 samples max or ~1 hour
	      	break;
	      case 'latest':
	        this.limit = 1; // no 'limit' applied to 'latest' endpoint, produces exactly one value
	        break;
	    }
	  }
		
	  if (this.config.carbonDioxideThreshold){
	    this.carbonDioxideThreshold = Number(this.config.carbonDioxideThreshold);
	  }
	  
	  if (this.config.carbonDioxideThresholdOff) {
	    this.carbonDioxideThresholdOff = Number(this.config.carbonDioxideThresholdOff);
	  }
		
	  if (this.carbonDioxideThreshold < this.carbonDioxideThresholdOff){
	    this.log ('"Carbon Dioxide Threshold Off" must be less than "Carbon Dioxide Threshold", using defaults.');
	    this.carbonDioxideThresholdOff = 800;
	    this.carbonDioxideThreshold = 1000;
	  }
	  
	  if (this.config.vocMw) {
	    this.vocMw = this.config.vocMw;
	  }
	  
	  if (this.config.occupancyOffset) {
	    this.occupancyOffset = this.config.occupancyOffset;
	  }
	  
	  if (this.config.ignoredDevices) {
	    this.ignoredDevices = this.config.ignoredDevices;
	  }

	  this.accessories = []; // store restored cached accessories here

	  /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
	  api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
	    this.log('homebridge-awair platform didFinishLaunching');

	    this.didFinishLaunching();
	  });
	}

	/*
	 * This function is invoked when homebridge restores EACH CACHED accessory (IAQ, Display, LED) from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
	configureAccessory(accessory: PlatformAccessory): void {

	  if (accessory.context.accType === 'IAQ') {
	    this.addAwairServices(accessory);
	  } else if (accessory.context.accType === 'Display') {
	    this.addDisplayModeServices(accessory);
	  } else if (accessory.context.accType === 'LED') {
	    this.addLEDModeServices(accessory);
	  }
		
	  this.accessories.push(accessory);
	}

	async didFinishLaunching(): Promise<void> {

	  // Get Developer User Info from your Awair account
	  await this.getUserInfo();

	  // Get registered Awair devices from your Awair account
	  await this.getAwairDevices();
		
	  // Create array to keep track of devices
	  const serNums: string[] = [];

	  // Add accessories for each Awair device (IAQ, Display Mode, LED Mode)
	  this.devices.forEach(device => {

	    // 'end user' device must NOT be on ignored list AND must contain the Awair OUI "70886B", the NIC can be any hexadecimal string
	    if (!this.ignoredDevices.includes(device.macAddress) && device.macAddress.includes('70886B')) {
	      this.addAwairAccessory(device);
	      // Add displayMode & ledMode Accessories for Omni, Awair-r2 and Element
	      if ((device.deviceType === 'awair-omni') || (device.deviceType === 'awair-r2') || (device.deviceType === 'awair-element')) {
	        this.addDisplayModeAccessory(device);
	        this.addLEDModeAccessory(device);
	      }	
	      serNums.push(device.macAddress);

	    // 'test' device must NOT be on ignored list AND will contain '000000' AND Development enabled to use
	    } else if (!this.ignoredDevices.includes(device.macAddress) && device.macAddress.includes('000000') && this.config.development) {
	      this.addAwairAccessory(device);
	      // Add displayMode & ledMode Accessories for Omni, Awair-r2 and Element
	      if ((device.deviceType === 'awair-omni') || (device.deviceType === 'awair-r2') || (device.deviceType === 'awair-element')) {
	        this.addDisplayModeAccessory(device);
	        this.addLEDModeAccessory(device);
	      }	
	      serNums.push(device.macAddress);

	    } else {
	      if (this.config.logging) {
	        // conditions above _should_ be satisfied, unless the MAC is missing (contact Awair), incorrect, or a testing device
	        this.log(`Error with Serial ${device.macAddress} on ignore list, does not match Awair OUI "70886B" or is ` 
						+ 'test device (requires development mode enabled to use).');
	      }
	    }
	  });
		
	  // Remove old, no longer used or ignored devices
	  const badAccessories: Array<PlatformAccessory> = [];
	  this.accessories.forEach(cachedAccessory => {
	    if (!serNums.includes(cachedAccessory.context.serial) || this.ignoredDevices.includes(cachedAccessory.context.serial)) {
	      badAccessories.push(cachedAccessory);
	    }
	  });
	  this.removeAwairAccessories(badAccessories);
				
	  // Get initial Air and Local data for all devices. Initialize displayMode & ledMode for Omni, Awair-r2 and Element
	  this.accessories.forEach(async accessory => {	
	    if (accessory.context.accType === 'IAQ') { // applies to all devices
	      if (this.config.logging) {
	        this.log(`[${accessory.context.serial}] Getting initial IAQ status for ${accessory.context.deviceUUID}`);
	      }
	      await this.updateAirData(accessory); 
			
	      if (accessory.context.deviceType === 'awair-omni') {
	        this.getOmniBatteryStatus(accessory);
	      }
				
	      if ((accessory.context.deviceType === 'awair-omni') && this.config.occupancyDetection) {
	        this.getOmniOccupancyStatus(accessory);
	      }
				
	      if (accessory.context.deviceType === 'awair-omni' || accessory.context.deviceType === 'awair-mint') {
	        this.getOmniMintLightLevel(accessory); // fetch 'lux' 
	      }	
	    }
			
	    if (accessory.context.accType === 'Display') { // applies to Omni, Awair-r2 and Element
	      if (this.config.logging) {
	        this.log(`[${accessory.context.serial}] Getting initial Display Mode status for ${accessory.context.deviceUUID}`);
	      }
	      this.getDisplayMode(accessory);
	      if (accessory.context.displayMode !== 'score') {
	        this.changeDisplayMode(accessory, 'score'); // initialize Display Mode for accessory to 'score'
	      } else { 
	        const defaultSwitch = accessory.getService('1: score'); // need to set initial HomeKit status
	        if (defaultSwitch) {
	          defaultSwitch
	            .updateCharacteristic(hap.Characteristic.On, true);
	        }
	      }
	    }

	    if (accessory.context.accType === 'LED') { // applies to Omni, Awair-r2 and Element
	      if (this.config.logging) {
	        this.log(`[${accessory.context.serial}] Getting initial LED Mode status for ${accessory.context.deviceUUID}`);
	      }
	      await this.getLEDMode(accessory);
	      if (accessory.context.ledMode !== 'auto') {
	        this.changeLEDMode(accessory, 'auto', 0); // initialize LED Mode for accessory to 'auto'
	      } else { 
	        const defaultSwitch = accessory.getService('1: auto'); // need to set initial HomeKit status
	        if (defaultSwitch) {
	          defaultSwitch
	            .updateCharacteristic(hap.Characteristic.On, true);
	        }
	        const defaultBrightness = accessory.getService('3: manual');
	        if (defaultBrightness) {
	          defaultBrightness
	            .updateCharacteristic(hap.Characteristic.Brightness, 0);
	        }
	      }
	    }
	  });
		
	  // start Device Air and Local data collection according to polling_interval settings
	  setInterval(() => {
	    this.accessories.forEach(accessory => {
	      if (this.config.logging) {
	        this.log(`[${accessory.context.serial}] Updating status...${accessory.context.deviceUUID}`);
	      }
	      this.updateAirData(accessory);
	      if (accessory.context.deviceType === 'awair-omni') {
	        this.getOmniBatteryStatus(accessory);
	      }
	      if (accessory.context.deviceType === 'awair-omni' || accessory.context.deviceType === 'awair-mint') {
	        this.getOmniMintLightLevel(accessory); // fetch averaged 'lux' value (Omni/Mint updates value every 10 seconds)
	      }			
	    });
	  }, this.polling_interval * 1000);
		
	  // if Omni device exists in account & detection enabled, start 30 second loop to test for Omni occupancy status
	  if(this.omniPresent && this.config.occupancyDetection) {
	    setInterval(() => {
	      this.accessories.forEach(accessory => {
	        if (accessory.context.deviceType === 'awair-omni') {
	          this.getOmniOccupancyStatus(accessory);
	        }
	      });
	    }, 30000); // check every 30 seconds, 10 seconds is updata interval for LocalAPI data, spl_a is 'smoothed' value
	  }
	}

	// get User Info profile from your Awair development account
	async getUserInfo(): Promise<void> {
	  const url = 'https://developer-apis.awair.is/v1/' + this.userType;
	  const options = {
	    headers: {
	      'Authorization': 'Bearer ' + this.config.token,
	    },
	  };

	  await axios.get(url, options)
    	.then(response => {
	      if(this.config.logging && this.config.verbose) {
	        this.log(`userInfo: ${JSON.stringify(response.data)}`);
	      }
				
	      this.userTier = response.data.tier;

	      const permissions: any[] = response.data.permissions;
								
	      permissions.forEach(permission => {
	        switch (permission.scope){
					  case 'FIFTEEN_MIN':
	            this.fifteenMin = parseFloat(permission.quota);
	            break;

	          case 'FIVE_MIN':
	            this.fiveMin = parseFloat(permission.quota);
	            break;

	          case 'RAW':
	            this.raw = parseFloat(permission.quota);
	            break;
						
	          case 'LATEST':
	            this.latest = parseFloat(permission.quota);
	            break;
						
	          default:
	            break;
	        }
	      });
				
	      switch (this.endpoint) {
	        case '15-min-avg': // practical minimum is 15-min or 900 seconds
	          this.polling_interval = Math.round(this.secondsPerDay / this.fifteenMin);
	          this.polling_interval = (this.polling_interval < 900) ? 900 : this.polling_interval;
	          break;

	        case '5-min-avg': // practical minimum is 5-min or 300
	          this.polling_interval = Math.round(this.secondsPerDay / this.fiveMin);
	          this.polling_interval = (this.polling_interval < 300) ? 300 : this.polling_interval;
	          break;
						
	        case 'raw': // minimum is (this.limit * 10 seconds), 200 min for "Hobbyist"
	          this.polling_interval = Math.round(this.secondsPerDay / this.raw);
	          if (this.userTier === 'Hobbyist') {
	            this.polling_interval = ((this.limit * 10) < 200) ? 200 : (this.limit * 10); // 200 seconds min for 'Hobbyist'
	          } else {
	            this.polling_interval = ((this.limit * 10) < 60) ? 60 : (this.limit * 10); // 60 seconds min for other tiers
	          }
	          break;
						
	        case 'latest': // latest is updated every 10 seconds on device, 300 min for "Hobbyist"
	          this.polling_interval = Math.round(this.secondsPerDay / this.latest);
	          if (this.userTier === 'Hobbyist') {
	            this.polling_interval = (this.polling_interval < 300) ? 300 : this.polling_interval;
	          } else {
	            this.polling_interval = (this.polling_interval < 60) ? 60 : this.polling_interval;
	          }
	          break;
	      }
				
	    })
    	.catch(error => {
	      if(this.config.logging){
	        this.log(`getUserInfo error: ${error}`);
	      }
	    });
	  return;
	}

	// get devices registered from your Awair account
	async getAwairDevices(): Promise<void> {
	  const url = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices';
	  const options = {
	    headers: {
	      'Authorization': 'Bearer ' + this.config.token,
	    },
	  };

	  await axios.get(url, options)
    	.then(response => {
	      this.devices = response.data.devices;
	      if(this.config.logging){
	      	this.log(`getAwairDevices: number discovered: ${this.devices.length}`);
	      }
	      for (let i = 0; i < this.devices.length; i++) {
	        if(!this.devices[i].macAddress.includes('70886B')) { // check if 'end user' or 'test' device
	          const devMac = '000000000000' + this.devices[i].deviceId; // if 'test' device, create MAC based on deviceId
	      		this.devices[i].macAddress = devMac.substring(devMac.length - 12); // get last 12 characters
	        }
	        if(this.config.logging && this.config.verbose){
	          this.log(`getAwairDevices: discovered device: [${i}] ${JSON.stringify(this.devices[i])}`);
	        }
	      }
	    })
    	.catch(error => {
	      if(this.config.logging){
	        this.log(`getAwairDevices error: ${error}`);
	      }
	    });
	  return;	
	}

	// add Awair IAQ Accessory to Platform
	addAwairAccessory(data: DeviceConfig) {
	  if (this.config.logging) {
	    this.log(`Initializing platform accessory ${data.name}...`);
	  }
		
	  // check if Awair device 'IAQ' accessory exists
	  let accessory = this.accessories.find(cachedAccessory => {
	    return (cachedAccessory.context.serial === data.macAddress) && (cachedAccessory.context.accType === 'IAQ');
	  });
		
	  // if IAQ accessory does not exist in cache, initialze as new
	  if (!accessory) {  
	    const uuid = hap.uuid.generate(data.deviceUUID);
    	accessory = new Accessory(data.name, uuid);

	    // Using 'context' property of PlatformAccessory saves information to accessory cache
	    accessory.context.name = data.name;
	    accessory.context.serial = data.macAddress;
	    accessory.context.deviceType = data.deviceType;
	    accessory.context.deviceUUID = data.deviceUUID;
	    accessory.context.deviceId = data.deviceId;
	    accessory.context.accType = 'IAQ'; // Indoor Air Quality
			
	    accessory.addService(hap.Service.AirQualitySensor, data.name);
	    accessory.addService(hap.Service.TemperatureSensor, data.name + ' Temp');
	    accessory.addService(hap.Service.HumiditySensor, data.name + ' Humidity');

	    if (data.deviceType !== 'awair-mint' && data.deviceType !== 'awair-glow-c') {
	      accessory.addService(hap.Service.CarbonDioxideSensor, data.name + ' CO2');
	    }

	    // Add Omni and Mint Light Sensor service
	    if (data.deviceType === 'awair-omni' || data.deviceType === 'awair-mint') {
	      accessory.addService(hap.Service.LightSensor, data.name + ' Light');
	    }

	    // Add Omni Battery and Occupancy service
	    if (data.deviceType === 'awair-omni') {
	      accessory.addService(hap.Service.BatteryService, data.name + ' Battery');
	      accessory.addService(hap.Service.OccupancySensor, data.name + ' Occupancy');
	      this.omniPresent = true; // set flag for Occupancy detected loop
	      accessory.context.occDetectedLevel = this.occDetectedLevel;
	      accessory.context.occDetectedNotLevel = this.occDetectedNotLevel;
	      accessory.context.minSoundLevel = this.occDetectedNotLevel;
	    }
			
	    this.addAwairServices(accessory);
			
	    this.addAccInfo(accessory);

	    // register the accessory
	    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

	    // this.accessories.push(accessory);

	  } else { // acessory exists, use data from cache
	    if (this.config.logging) {
	      this.log(`${accessory.context.deviceUUID} IAQ accessory exists, using data from cache`);
	    }
	    if (accessory.context.deviceType === 'awair-omni') {
	      this.omniPresent = true; // set flag for Occupancy detected loop
	    }
	    // use Omni cache data unless 'occupancyRestart' enabled
	    if ((accessory.context.deviceType === 'awair-omni') && this.config.occupancyRestart) {
	      accessory.context.occDetectedLevel = this.occDetectedLevel;
	      accessory.context.occDetectedNotLevel = this.occDetectedNotLevel;
	      accessory.context.minSoundLevel = this.occDetectedNotLevel;
	    }
	  }
	  return;
	}

	// remove no longer used Accessories from Platform
	removeAwairAccessories(accessories: Array<PlatformAccessory>) {
	  accessories.forEach(accessory => {
	    this.log(`${accessory.context.name} is removed from HomeBridge.`);
	    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
	    this.accessories.splice(this.accessories.indexOf(accessory), 1);
	  });
	  return;
	}

	// add Characteristics to each IAQ Service
	addAwairServices(accessory: PlatformAccessory) {
	  if (this.config.logging) {
	    this.log(`[${accessory.context.serial}] Configuring IAQ Services for ${accessory.displayName}`);
	  }
	  accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
	    this.log(`${accessory.context.name} identify requested!`);
	  });

	  // Air Quality Service
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
	    } else if (accessory.context.devType === 'awair-mint' || accessory.context.devType === 'awair-omni' || 
					accessory.context.devType === 'awair-r2' || accessory.context.devType === 'awair-element') {
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

	  // Temperature Service
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
		
	  // Humidity Service
	  const humidityService = accessory.getService(hap.Service.HumiditySensor);
	  if (humidityService) {
	    humidityService
	      .setCharacteristic(hap.Characteristic.CurrentRelativeHumidity, '--');
	  }

	  // Carbon Dioxide Service
	  if (accessory.context.devType !== 'awair-mint' && accessory.context.devType !== 'awair-glow-c') {
	    const carbonDioxideService = accessory.getService(hap.Service.CarbonDioxideSensor);
	    if (carbonDioxideService) {
	      carbonDioxideService
	        .setCharacteristic(hap.Characteristic.CarbonDioxideLevel, '--');
	    }
	  }

	  // Omni & Mint Ambient Light Service
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
		
	  // Omni Battery Service
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
		
	  // Omni Occupancy Sensor Service
	  if (accessory.context.devType === 'awair-omni') {
	    const occupancyService = accessory.getService(hap.Service.OccupancySensor);
	    if (occupancyService) {
	      occupancyService
	        .setCharacteristic(hap.Characteristic.OccupancyDetected, 0); // Not occupied
	    }
	  }
		
	  if(this.config.logging) {
	    this.log(`[${accessory.context.serial}] addAwairServices completed`);
	  }
		
	  this.accessories.push(accessory);
	}

	// add Accessory Information to Accessory (IAQ, Display, LED)
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

	// update Awair IAQ data using CloudAPI
	async updateAirData(accessory: PlatformAccessory): Promise<void> {
	  // Update status for accessory of deviceId
	  const url = 'https://developer-apis.awair.is/v1/' + this.userType + '/devices/' + accessory.context.deviceType + '/' 
			+ accessory.context.deviceId + '/air-data/' + this.endpoint + '?limit=' + this.limit + '&desc=true';
	  const options = {
	    headers: {
	      'Authorization': 'Bearer ' + this.config.token,
	    },
	  };

	  await axios.get(url, options)
    	.then(response => {
	      const data: any[] = response.data.data;				
	      if(this.config.logging && this.config.verbose){
	        this.log(`[${accessory.context.serial}] updateAirData: ${JSON.stringify(response.data.data)}`);
	      }
				
	      // compute time weighted average for each sensor's data
	      const sensors: any = data
	        .map(sensor => sensor.sensors) // create sensors data array of length 'this.limit'
	        .reduce((a, b) => a.concat(b)) // flatten array of sensors (which is an array) to single-level array
	        .reduce((a: any, b: any) => {
	          a[b.comp] = a[b.comp] ? 0.5*(a[b.comp] + b.value) : b.value; 
	          return a; // return time weighted average
	        }, []); // pass empty array as initial value

	      // determine average Awair score over data samples
	      const score = data.reduce((a, b) => a + b.score, 0) / data.length;
				
	      const airQualityService = accessory.getService(hap.Service.AirQualitySensor);
	      if (airQualityService) {
	        if (this.airQualityMethod === 'awair-aqi') {
	          airQualityService
	            .updateCharacteristic(hap.Characteristic.AirQuality, this.convertAwairAqi(accessory, sensors));
	        } else if ((this.airQualityMethod === 'nowcast-aqi') && 
							!((accessory.context.deviceType === 'awair-glow') || (accessory.context.deviceType === 'awair-glow-c'))) {
	          airQualityService // only use nowcast-aqi for Omni, Mint, Awair, Awair-R2
	            .updateCharacteristic(hap.Characteristic.AirQuality, this.convertNowcastAqi(accessory, data)); // pass response data
	        } else if ((this.airQualityMethod === 'nowcast-aqi') 
							&& (accessory.context.deviceType === 'awair-glow' || accessory.context.deviceType === 'awair-glow-c')) {
	          airQualityService // for Glow or Glow-C use awair-aqi if nowcast-aqi selected
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
	                this.log(`[${accessory.context.serial}] CO2Before: ${co2Before}`);
	              }
		
	              // Logic to determine if Carbon Dioxide should trip a change in Detected state
	              carbonDioxideService
	                .updateCharacteristic(hap.Characteristic.CarbonDioxideLevel, parseFloat(sensors[sensor]));
	              if ((this.carbonDioxideThreshold > 0) && (co2 >= this.carbonDioxideThreshold)) {
	                // threshold set and CO2 HIGH
	                co2Detected = 1;
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] CO2 HIGH: ${co2} > ${this.carbonDioxideThreshold}`);
	                }
	              } else if ((this.carbonDioxideThreshold > 0) && (co2 < this.carbonDioxideThresholdOff)) {
	                // threshold set and CO2 LOW
	                co2Detected = 0;
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] CO2 NORMAL: ${co2} < ${this.carbonDioxideThresholdOff}`);
	                }
	              } else if ((this.carbonDioxideThreshold > 0) && (co2 < this.carbonDioxideThreshold) 
														&& (co2 > this.carbonDioxideThresholdOff)) {
	                // the inbetween...
	                if(this.config.logging){
	                  // eslint-disable-next-line max-len
	                  this.log(`[${accessory.context.serial}] CO2 INBETWEEN: ${this.carbonDioxideThreshold} > [[[${co2}]]] > ${this.carbonDioxideThresholdOff}`);
	                }
	                co2Detected = co2Before;
	              } else {
	                // threshold NOT set
	                co2Detected = 0;
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] CO2: ${co2}`);
	                }
	              }
		
	              // Prevent sending a Carbon Dioxide detected update if one has not occured
	              if ((co2Before === 0) && (co2Detected === 0)) {
	                // CO2 low already, don't send
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] Carbon Dioxide already low.`);
	                }
	              } else if ((co2Before === 0) && (co2Detected === 1)) {
	                // CO2 low to high, send it!
	                carbonDioxideService
	                  .updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, co2Detected);
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] Carbon Dioxide low to high.`);
	                }
	              } else if ((co2Before === 1) && (co2Detected === 1)) {
	                // CO2 high to not-quite-low-enough-yet, don't send
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] Carbon Dioxide already elevated.`);
	                }
	              } else if ((co2Before === 1) && (co2Detected === 0)) {
	                // CO2 low to high, send it!
	                carbonDioxideService
	                  .updateCharacteristic(hap.Characteristic.CarbonDioxideDetected, co2Detected);
	                if(this.config.logging){
	                  this.log(`[${accessory.context.serial}] Carbon Dioxide high to low.`);
	                } else {
	                  // CO2 unknown...
	                  this.log(`[${accessory.context.serial}] Carbon Dioxide state unknown.`);
	                }
	              }
	            }
	            break;
		
	          case 'voc':
	            const voc = parseFloat(sensors[sensor]);
	            const tvoc = this.convertChemicals( accessory, voc, atmos, temp );
	            if(this.config.logging && this .config.verbose){
	              this.log(`[${accessory.context.serial}]: voc (${voc} ppb) => tvoc (${tvoc} ug/m^3)`);
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
	              // eslint-disable-next-line max-len
	              this.log(`[${accessory.context.serial}] updateAirData ignoring ${JSON.stringify(sensor)}: ${parseFloat(sensors[sensor])}`);
	            }
	            break;
	        }
	      }
    		})
	    .catch(error => {
	      if(this.config.logging){
	        this.log(`updateAirData error: ${error}`);
	      }
	    });
	  return;
	}

	// get Omni battery level and charging status using LocalAPI (must enable in Awair App, firmware v1.3.0 and below)
	// *** TO DO - for Omni firmware v1.3.1, directory structure is '/settings/data'
	async getOmniBatteryStatus(accessory: PlatformAccessory): Promise<void> {
	  const url = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/settings/config/data';

	  await axios.get(url)
    	.then(response => {
	      // eslint-disable-next-line quotes
	      const powerStatus = response.data["power-status"];
	      const batteryLevel: number = powerStatus.battery;
	      const batteryPlugged: boolean = powerStatus.plugged;
	      const lowBattery: boolean = (batteryLevel < 30) ? true : false;
				
	      if(this.config.logging && this.config.verbose) {
	        // eslint-disable-next-line max-len
	        this.log(`[${accessory.context.serial}] batteryLevel: ${batteryLevel} batteryPlugged: ${batteryPlugged} lowBattery: ${lowBattery}`);
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
    	.catch(error => {
	      if(this.config.logging){
	        this.log(`getOmniBatteryStatus error: ${error}`);
	      }
	    });
	  return;
	}

	// get Omni Montion Sensor Status using spl_a level via LocalAPI
	async getOmniOccupancyStatus(accessory: PlatformAccessory): Promise<void> {
	  const url = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/air-data/latest';

	  await axios.get(url)
    	.then(response => {
	      const omniSpl_a: number = response.data.spl_a;
	      if(this.config.logging && this.config.verbose) {	
	        this.log(`[${accessory.context.serial}] spl_a: ${omniSpl_a}`);
	      }
				
	      if(omniSpl_a > 48.0 && omniSpl_a < accessory.context.minSoundLevel) { // Omni ambient sound level range 48 - 90dBA 
	        accessory.context.minSoundLevel = omniSpl_a;
	        accessory.context.occDetectedLevel = accessory.context.minSoundLevel + this.occupancyOffset + 0.5; // dBA
	        accessory.context.occDetectedNotLevel = accessory.context.minSoundLevel + this.occupancyOffset; // dBA
	        if(this.config.logging) {
	          // eslint-disable-next-line max-len
	          this.log(`[${accessory.context.serial}] min spl_a: ${omniSpl_a}dBA -> notDetectedLevel: ${accessory.context.occDetectedNotLevel}dBA, DetectedLevel: ${accessory.context.occDetectedLevel}dBA`);
	        }
	      }
			
	      const occupancyService = accessory.getService(hap.Service.OccupancySensor);
				
	      if (occupancyService) {
	        // get current Occupancy state
	        let occupancyStatus: any = occupancyService.getCharacteristic(hap.Characteristic.OccupancyDetected).value;

	        if (omniSpl_a >= accessory.context.occDetectedLevel) { 
	          // occupancy detected
	          occupancyStatus = 1;
	          if(this.config.logging){
	            this.log(`[${accessory.context.serial}] Occupied: ${omniSpl_a}dBA > ${accessory.context.occDetectedLevel}dBA`);
	          }
	        } else if (omniSpl_a <= accessory.context.occDetectedNotLevel) { 
	          // unoccupied
	          occupancyStatus = 0;
	          if(this.config.logging){
	            // eslint-disable-next-line max-len
	            this.log(`[${accessory.context.serial}] Not Occupied: ${omniSpl_a}dBA < ${accessory.context.occDetectedNotLevel}dBA`);
	          }
	        } else if ((omniSpl_a > accessory.context.occDetectedNotLevel) && (omniSpl_a < accessory.context.occDetectedLevel)) {
	          // inbetween ... no change, use current state
	          if(this.config.logging){
	            // eslint-disable-next-line max-len
	            this.log(`[${accessory.context.serial}] Occupancy Inbetween: ${accessory.context.occDetectedNotLevel}dBA < ${omniSpl_a} < ${accessory.context.occDetectedLevel}dBA`);
	          }
	        }
	        occupancyService
	          .updateCharacteristic(hap.Characteristic.OccupancyDetected, occupancyStatus);
	      }
	    })
    	.catch(error => {
	      if(this.config.logging){
	        this.log(`getOmniOccupancyStatus error: ${error}`);
	      }
	    });
	  return;
	}

	// get Omni & Mint lux using LocalAPI
	async getOmniMintLightLevel(accessory: PlatformAccessory): Promise<void> {
	  const url = 'http://' + accessory.context.deviceType + '-' + accessory.context.serial.substr(6) + '/air-data/latest';
		
	  await axios.get(url)
    	.then(response => {
	      const omniLux: number = response.data.lux; // lux is 'latest' value averaged by Omni/Mint over 10 seconds
	      if(this.config.logging && this.config.verbose) {	
	        this.log(`LocalAPI lux data for ${accessory.context.deviceType}: ${omniLux}`);
	      }
			
	      const lightLevelSensor = accessory.getService(hap.Service.LightSensor);
	      if (lightLevelSensor) {
	        lightLevelSensor
	          .updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, omniLux);
	      }
	    })
    	.catch(error => {
	      if(this.config.logging){
	        this.log(`getOmniLocalData error: ${error}`);
	      }
	    });
	  return;
	}

	// Add displayMode Accessory for Omni, Awair-r2 and Element
	addDisplayModeAccessory(data: DeviceConfig) {
	  if (this.config.logging) {
	    this.log(`Initializing Display Mode accessory for ${data.deviceUUID}...`);
	  }
		
	  // check if Awair device 'displayMode' accessory exists
	  let accessory = this.accessories.find(cachedAccessory => {
	    return (cachedAccessory.context.serial === data.macAddress) && (cachedAccessory.context.accType === 'Display');
	  });
				
	  // if displayMode accessory does not exist in cache, initialze as new
	  if (!accessory) {  
  	  const uuid = hap.uuid.generate(`${data.deviceUUID}_Display`); // secondary UUID for Display Mode control
	    accessory = new Accessory(`${data.name} Display Mode`, uuid);

	    // Using 'context' property of PlatformAccessory saves information to accessory cache
	    accessory.context.name = data.name;
	    accessory.context.serial = data.macAddress;
	    accessory.context.deviceType = data.deviceType;
	    accessory.context.deviceUUID = data.deviceUUID;
	    accessory.context.deviceId = data.deviceId;
	    accessory.context.accType = 'Display'; // Display Mode
									
	    // If you are adding more than one service of the same type to an accessory, you need to give the service a "name" and "subtype".
	    accessory.addService(hap.Service.Switch, '1: score', '0');
	    accessory.addService(hap.Service.Switch, '2: temp', '1');
	    accessory.addService(hap.Service.Switch, '3: humid', '2');
	    accessory.addService(hap.Service.Switch, '4: co2', '3');
	    accessory.addService(hap.Service.Switch, '5: voc', '4');
	    accessory.addService(hap.Service.Switch, '6: pm25', '5');
	    accessory.addService(hap.Service.Switch, '7: clock', '6');
			
	    this.addDisplayModeServices(accessory);

	  	this.addAccInfo(accessory);
		
	    // register the accessory
	    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

	  	this.accessories.push(accessory);

	  } else { // acessory exists, use data from cache
	    if (this.config.logging) {
	      this.log(`${accessory.context.deviceUUID} Display Mode accessory exists, using data from cache`);
	    }	
	  }
	  return;
	}

	// add Characteristics to each Device Mode Service
	addDisplayModeServices(accessory: PlatformAccessory) {
	  if (this.config.logging) {
	    this.log(`[${accessory.context.serial}] Configuring Device Mode Services for ${accessory.context.deviceUUID}`);
	  }
	  accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
	    this.log(`${accessory.context.name} identify requested!`);
	  });
		
	  for (let i = 0; i < this.displayModes.length; i++) {
	    accessory.getService(`${i + 1}: ${this.displayModes[i]}`)!.getCharacteristic(hap.Characteristic.On)
	      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
	        this.changeDisplayMode(accessory, `${this.displayModes[i]}`);
	        callback();
	      });
	  }
	  if(this.config.logging) {
	    this.log(`[${accessory.context.serial}] addDisplayModeServices completed`);
	  }		
	}

	async changeDisplayMode(accessory: PlatformAccessory, newDisplayMode: string): Promise<void> {
	  const oldDisplayMode = accessory.context.displayMode;
		
	  if (newDisplayMode === accessory.context.displayMode) { // displayMode HAS NOT changed
	    const currentIndex = this.displayModes.findIndex(mode => mode === oldDisplayMode);
	    const currentSwitch = accessory.getService(`${currentIndex + 1}: ${oldDisplayMode}`);		
	    setTimeout(() => { // need short delay before your can reset the switch
	    	if (currentSwitch) {
	        currentSwitch
	          .updateCharacteristic(hap.Characteristic.On, true);
	      }
	    }, 50);
	    return;
	  }
		
	  if (newDisplayMode !== oldDisplayMode) { // displayMode HAS changed
	    if (this.config.logging) {
	      // eslint-disable-next-line max-len
	      this.log(`[${accessory.context.serial}] Changing Display Mode for ${accessory.context.deviceUUID} from ${oldDisplayMode} to ${newDisplayMode}`);
	    }
			
	    // turn OFF old switch
	    const oldIndex = this.displayModes.findIndex(mode => mode === oldDisplayMode);
	    const oldSwitch = accessory.getService(`${oldIndex + 1}: ${oldDisplayMode}`);
	    if (oldSwitch) {
	      oldSwitch
	        .updateCharacteristic(hap.Characteristic.On, false);
	    }

	    // set new Display Mode -> UPDATES accessory.context.displayMode
	    await this.putDisplayMode(accessory, newDisplayMode);
			
	    // turn ON new switch
	    const newIndex = this.displayModes.findIndex(mode => mode === newDisplayMode);
	    const newSwitch = accessory.getService(`${newIndex + 1}: ${newDisplayMode}`);
	    if (newSwitch) {
	      newSwitch
	        .updateCharacteristic(hap.Characteristic.On, true);
	    }
	    return;
	  }
	}

	async getDisplayMode(accessory: PlatformAccessory): Promise<void> {
	  const url = `https://developer-apis.awair.is/v1/devices/${accessory.context.deviceType}/${accessory.context.deviceId}/display`;
	  const options = {
	    headers: {
	      Authorization: `Bearer ${this.config.token}`,
	    },
	  };

	  await axios.get(url, options)
	    .then(response => {
	      if (this.config.logging) {
	        this.log(`[${accessory.context.serial}] getDisplayMode ${accessory.context.deviceUUID} response: ${response.data.mode}`);
	      }
	      accessory.context.displayMode = response.data.mode;      
	    })
	    .catch(error => {
	      if(this.config.logging){
	        this.log(`[${accessory.context.serial}] getDisplayMode ${accessory.context.deviceUUID} error: ${error}`);
	      }
	    });
	  return;
	}

	async putDisplayMode(accessory: PlatformAccessory, mode: string): Promise<void> {
	  const url = `https://developer-apis.awair.is/v1/devices/${accessory.context.deviceType}/${accessory.context.deviceId}/display`;
	  const body = {'mode': mode};
	  const options = {
	    headers: {
	      Authorization: `Bearer ${this.config.token}`,
	    },
	  };
		
	  await axios.put(url, body, options)
	    .then(response => {
	      if(this.config.logging){
	        this.log(`[${accessory.context.serial}] putDisplayMode response: ${response.data.message} for ${accessory.context.deviceUUID}`);
	      }
	    })
	    .catch(error => {
	      if(this.config.logging){
	        this.log(`[${accessory.context.serial}] putDisplayMode error: ${error} for ${accessory.context.deviceUUID}`);
	      }
	    });
	  accessory.context.displayMode = mode;
	  return;
	}

	// Add ledMode Accessory for Omni, Awair-r2 and Element
	addLEDModeAccessory(data: DeviceConfig) {
	  if (this.config.logging) {
	    this.log(`Initializing LED Mode accessory for ${data.deviceUUID}...`);
	  }
		
	  // check if Awair device 'ledMode' accessory exists
	  let accessory = this.accessories.find(cachedAccessory => {
	    return (cachedAccessory.context.serial === data.macAddress) && (cachedAccessory.context.accType === 'LED');
	  });
		
	  // if ledMode accessory does not exist in cache, initialze as new
	  if (!accessory) {
  	  const uuid = hap.uuid.generate(`${data.deviceUUID}_LED`); // secondary UUID for LED Mode control
	    accessory = new Accessory(`${data.name} LED Mode`, uuid);
			
	    // Using 'context' property of PlatformAccessory saves information to accessory cache
	    accessory.context.name = data.name;
	    accessory.context.serial = data.macAddress;
	    accessory.context.deviceType = data.deviceType;
	    accessory.context.deviceUUID = data.deviceUUID;
	    accessory.context.deviceId = data.deviceId;
	    accessory.context.accType = 'LED'; // LED Mode
			
	    // If you are adding more than one service of the same type to an accessory, you need to give the service a "name" and "subtype".
	    accessory.addService(hap.Service.Switch, '1: auto', '0');
	    accessory.addService(hap.Service.Switch, '2: sleep', '1');

	    accessory.addService(hap.Service.Lightbulb, '3: manual');
			
	  	this.addLEDModeServices(accessory);
	  
	  	this.addAccInfo(accessory);
		
	    // register the accessory
	    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
			
	    this.accessories.push(accessory);

	  } else { // acessory exists, use data from cache
	    if (this.config.logging) {
	      this.log(`${accessory.context.deviceUUID} LED Mode accessory exists, using data from cache`);
	    }
	  }
	  return;
	}

	// add Characteristics to each LED Mode Service
	addLEDModeServices(accessory: PlatformAccessory) {
	  if (this.config.logging) {
	    this.log(`[${accessory.context.serial}] Configuring LED Mode Services for ${accessory.context.deviceUUID}`);
	  }
	  accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
	    this.log(`${accessory.context.name} identify requested!`);
	  });
		
	  for (let i = 0; i < this.ledModes.length - 1; i++) { // auto & sleep
			accessory.getService(`${i + 1}: ${this.ledModes[i]}`)!.getCharacteristic(hap.Characteristic.On)
			  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
			    this.changeLEDMode(accessory, this.ledModes[i], 0); // 0 is dummy brightness for Auto and Sleep
			    callback();
			  });
	  }
		
		accessory.getService('3: manual')!.getCharacteristic(hap.Characteristic.Brightness)
		  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
		    if (this.config.logging) {
		      this.log(`[${accessory.context.serial}] LED brightness for ${accessory.context.deviceUUID} was set to: ${value}`);
		    }
		    const brightness = parseInt(JSON.stringify(value));
		    this.changeLEDMode(accessory, 'manual', brightness);
		    callback();
		  });
			
	  if(this.config.logging) {
	    this.log(`[${accessory.context.serial}] addLEDModeServices completed`);
	  }
	}
	
	async changeLEDMode(accessory: PlatformAccessory, newLEDMode: string, newBrightness: number) {
	  const oldLEDMode = accessory.context.ledMode;
	  const oldBrightness = accessory.context.brightness;
		
	  // no auto or sleep mode change / only switch change to OFF, reset switch to ON, return
	  if (((newLEDMode === 'auto') && (oldLEDMode === 'auto')) || ((newLEDMode === 'sleep') && (oldLEDMode === 'sleep'))) {
	    if (this.config.logging) {
	      this.log(`[${accessory.context.serial}] No change, resetting ${oldLEDMode} switch`);
	    }
	    const currentIndex = this.ledModes.findIndex(mode => mode === oldLEDMode);
	    const currentSwitch = accessory.getService(`${currentIndex + 1}: ${oldLEDMode}`);		
	    setTimeout(() => { // need short delay before your can reset the switch
	      if (currentSwitch) {
	        currentSwitch
	          .updateCharacteristic(hap.Characteristic.On, true);
	      }
	    }, 50);
	    return;
	  }
		
	  // no manual mode or brightness change, return
	  if ((newLEDMode === 'manual') && (oldLEDMode === 'manual') && (newBrightness === oldBrightness)) {
	    if (this.config.logging) {
	      this.log(`[${accessory.context.serial}] No change, returning`);
	    }
	    return;
	  }
		
	  // mode or brightness change, update mode switches, update Awair device, return
	  if ((newLEDMode !== oldLEDMode) || (newBrightness !== oldBrightness)) { 
	    if (this.config.logging) {
	      // eslint-disable-next-line max-len
	      this.log(`[${accessory.context.serial}] Changing LED Mode for ${accessory.context.deviceUUID} to ${newLEDMode} brightness ${newBrightness}`);
	    }
			
	    // turn OFF old switch
	    const oldIndex = this.ledModes.findIndex(mode => mode === oldLEDMode);
	    const oldSwitch = accessory.getService(`${oldIndex + 1}: ${oldLEDMode}`);
	    if (oldSwitch) { // Auto or Sleep
	      oldSwitch
	        .updateCharacteristic(hap.Characteristic.On, false);
	      oldSwitch
	        .updateCharacteristic(hap.Characteristic.Brightness, 0);
	    }

	    this.log(`[${accessory.context.serial}] changeLEDMode newLEDMode: ${newLEDMode} newBrightness: ${newBrightness}`);
			
	    // set new LED Mode -> updates accessory.context.ledMode & accessory.context.brightness
	    await this.putLEDMode(accessory, newLEDMode, newBrightness);
			
	    // turn ON new switch
	    const newIndex = this.displayModes.findIndex(mode => mode === newLEDMode);
	    const newSwitch = accessory.getService(`${newIndex + 1}: ${newLEDMode}`);
	    if (newSwitch && (newIndex < 2)) { // Auto or Sleep
	      newSwitch
	        .updateCharacteristic(hap.Characteristic.On, true);
	    }
	    if (newSwitch && (newIndex === 2)) { // Manual
	      newSwitch
	        .updateCharacteristic(hap.Characteristic.On, true);
	      newSwitch
	        .updateCharacteristic(hap.Characteristic.Brightness, newBrightness);
	    }
	    return;
	  }
	}

	async getLEDMode(accessory: PlatformAccessory): Promise<void> {
	  const url = `https://developer-apis.awair.is/v1/devices/${accessory.context.deviceType}/${accessory.context.deviceId}/led`;
	  const options = {
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };

	  await axios.get(url, options)
	    .then(response => {
	      if (this.config.logging) {
	        // eslint-disable-next-line max-len
	        this.log(`[${accessory.context.serial}] getLEDMode  ${accessory.context.deviceUUID} response: ${response.data.mode}, brightness: ${response.data.brightness}`);
	      }
	      accessory.context.ledMode = response.data.mode.toLowerCase(); // mode response from Cloud API in upper case
	      accessory.context.ledBrightness = response.data.brightness;
	    })
	    .catch(error => {
	      if(this.config.logging){
	        this.log(`[${accessory.context.serial}] getLEDMode  ${accessory.context.deviceUUID} error: ${error}`);
	      }
	    });
	  return;
	}

	async putLEDMode(accessory: PlatformAccessory, mode: string, brightness: number): Promise<void> {
	  const url = `https://developer-apis.awair.is/v1/devices/${accessory.context.deviceType}/${accessory.context.deviceId}/led`;
	  let body: any = {'mode': mode};
	  if (mode === 'manual'){
	    body = {'mode':mode, 'brightness':brightness};
	  }
	  const options = {
	    headers: {
	      Authorization: 'Bearer ' + this.config.token,
	    },
	  };
		
	  await axios.put(url, body, options)
	    .then(response => {
	      if(this.config.logging){
	        this.log(`[${accessory.context.serial}] putLEDMode response: ${response.data.message} for ${accessory.context.deviceUUID}`);
	      }
	    })
	    .catch(error => {
	      if(this.config.logging){
	        this.log(`[${accessory.context.serial}] putLEDMode error: ${error} for ${accessory.context.deviceUUID}`);
	      }
	    });

	  accessory.context.ledMode = mode;
	  accessory.context.ledBrightness = brightness;
	  return;
	}

	// Conversion functions
	convertChemicals(accessory: PlatformAccessory, voc: number, atmos: number, temp: number): number {
	  const vocString = '(' + voc + ' * ' + this.vocMw + ' * ' + atmos + ' * 101.32) / ((273.15 + ' + temp + ') * 8.3144)';
	  const tvoc = (voc * this.vocMw * atmos * 101.32) / ((273.15 + temp) * 8.3144);
	  if(this.config.logging && this.config.verbose){
	    this.log(`[${accessory.context.serial}] ppb => ug/m^3 equation: ${vocString}`);
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

	convertAwairAqi(accessory: PlatformAccessory, sensors: any[]): number {
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
	        if(this.config.logging && this.config.verbose){
	          this.log(`[${accessory.context.serial}] convertAwairAqi ignoring ${JSON.stringify(sensor)}: ${parseFloat(sensors[sensor])}`);
	        }
	        aqiArray.push(0);
	        break;
	    }
	  }
	  if(this.config.logging && this.config.verbose){
	    this.log(`[${accessory.context.serial}] aqi array: ${JSON.stringify(aqiArray)}`);
	  }
	  return Math.max(...aqiArray); // aqi is maximum value of voc, pm25 and dust
	}
	
	convertNowcastAqi(accessory: PlatformAccessory, data: any[]): number {
	  const pmRawData: number[] = data
	    .map(sensor => sensor.sensors) // create sensor array of sensors with length 'this.limit'
	    .reduce((a, b) => a.concat(b)) // flatten array of sensors (which is an array) to single-level array
	    .filter((pmEntry: { comp: string; }) => (pmEntry.comp === 'pm25') || (pmEntry.comp === 'dust')) // get just pm25 & dust entries
	    .map((pmValue: { value: number; }) => pmValue.value); // return just pm value
			
	  if(this.config.logging && this.config.verbose){
	    this.log(`[${accessory.context.serial}] pmRawData`, pmRawData);
	  }

	  // calculate weightFactor of full 48 points
	  const pmMax = Math.max(...pmRawData);
	  const pmMin = Math.min(...pmRawData);
	  const scaledRateChange = (pmMax - pmMin)/pmMax;
	  const weightFactor = ((1 - scaledRateChange) > 0.5) ? (1 - scaledRateChange) : 0.5;
		
	  // reduce data from 48 points to 12 of 4 averaged points
	  const pmData: number[] = [];
	  for (let i = 0; i < 12; i++) {
	    pmData[i] = 0;
	    for (let j = 0; j < 4; j++) {
	      pmData[i] += pmRawData[(i * 4) + j];
	    }
	    pmData[i] = pmData[i] / 4;
	  }

	  if(this.config.logging && this.config.verbose){
	    this.log(`[${accessory.context.serial}] pmData`, pmData);
	  }
		
	  // calculate NowCast value
	  let nowCastNumerator = 0;
	  for (let i = 0; i < pmData.length; i++) {
	    nowCastNumerator += pmData[i] * Math.pow(weightFactor, i);
	  }
	  let nowCastDenominator = 0;
	  for (let i = 0; i < pmData.length; i++) {
	    nowCastDenominator += Math.pow(weightFactor, i);
	  }
	  const nowCast: number = nowCastNumerator / nowCastDenominator; // in ug/m3		
	  if(this.config.logging){
	    this.log(`[${accessory.context.serial}] pmMax: ${pmMax}, pmMin: ${pmMin}, weightFactor: ${weightFactor}, nowCast: ${nowCast}`);
	  }

	  // determine nowCast level
	  if (nowCast < 50) {
	    return 1; // GOOD
	  } else if (nowCast >= 50 && nowCast < 100) {
	    return 2; // MODERATE
	  } else if (nowCast >= 100 && nowCast < 150) {
	    return 3; // UNHEALTHY for SENSITIVE GROUPS
	  } else if (nowCast >= 150 && nowCast < 300) {
	    return 4; // UNHEALTHY
	  } else if (nowCast >= 300) {
	    return 5; // HAZARDOUS
	  } else {
	    return 0; // Error
	  }
	}
}
