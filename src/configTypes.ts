export type AwairPlatformConfig = {
  platform: string;
  token: string;
  userType: string;
  apiMethod: string;
  localPollingInterval: number;
  airQualityMethod: string;
  endpoint: string;
  polling_interval: number;
  limit: number;
  carbonDioxideThreshold: number;
  carbonDioxideThresholdOff: number;
  enableTvocPm25: boolean;
  tvocThreshold: number;
  tvocThresholdOff: number;
  pm25Threshold: number;
  pm25ThresholdOff: number;
  vocMw: number;
  occupancyDetection: boolean;
  occupancyOffset: number;
  occupancyRestart: false;
  occDetectedLevel: number;
  occNotDetectedLevel: number;
  enableModes: boolean;
  logging: boolean;
  verbose: boolean;
  development: boolean;
  modeTemp: boolean;
  ignoredDevices: [string];
};

export type DeviceConfig = {
  name: string;
  macAddress: string;
  latitude: number;
  preference: string;
  timezone: string;
  roomType: string;
  deviceType: string;
  longitude: number;
  spaceType: string;
  deviceUUID: string;
  deviceId: number;
  locationName: string;
  accType: string;
};

export type UserConfig = {
  userTier: string;
  fifteenMin: number;
	fiveMin: number;
	raw: number;
	latest: number;
	getPowerStatus: number;
	getTimeZone: number;
};

export type DisplayConfig = {
  mode: string;  // score, temp, humid, co2, voc, pm25, clock
  clock_mode: string; // 12hr, 24hr (default = 12hr)
  temp_unit: string; // c, f (default = c)
};

export type LEDConfig = {
  mode: string; // auto, manual, sleep
  brightness: number; // 0 -> 100 in %
};
