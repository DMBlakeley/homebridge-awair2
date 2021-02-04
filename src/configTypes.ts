export type AwairPlatformConfig = {
  platform: string;
  token: string;
  userType: string;
  airQualityMethod: string;
  endpoint: string;
  polling_interval: number;
  limit: number;
  carbonDioxideThreshold: number;
  carbonDioxideThresholdOff: number;
  vocMw: number;
  occupancyDetection: boolean;
  occupancyOffset: number;
  occupancyRestart: false;
  occupancyDetectedLevel: number;
  occupancyNotDetectedLevel: number;
  enableModes: boolean;
  logging: boolean;
  verbose: boolean;
  development: boolean;
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

export type UserInfoConfig = {
  userTier: string;
  fifteenMin: number;
	fiveMin: number;
	raw: number;
	latest: number;
	getPowerStatus: number;
	getTimeZone: number;
};

export type DisplayModeConfig = {
  mode: string;  // score, temp, humid, co2, voc, pm25, clock
  clock_mode: string; // 12hr, 24hr
  temp_unit: string; // c, f
};

export type LEDModeConfig = {
  mode: string; // auto, manual, sleep
  brightness: number; // 0 -> 100 in %
};
