export type AwairPlatformConfig = {
  platform: string;
  token: string;
  userType: string;
  airQualityMethod: string;
  endpoint: string;
  polling_interval: number;
  limit: number;
  logging: boolean;
  carbonDioxideThreshold: number;
  carbonDioxideThresholdOff: number;
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
};

