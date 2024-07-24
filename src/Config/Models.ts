import { AvailableGadgetIds } from "./Gadgets";

export const RASPBERRY_PI_VENDOR_ID = 0x0a5c;

export interface RaspeberryPiModel {
  productId: number;
  name: string;
  supported: boolean;

  tested: boolean;
  chipset: string;
  fsPrefix?: string;
  bootFileName: string;

  gadgetCompatibility: Record<AvailableGadgetIds, boolean>;
}


// console.log({ MassStorageGadgedBootFilesBin });
export const RaspberryPiModels: RaspeberryPiModel[] = [
  {
    productId: 0x2763,
    name: 'Unknown',
    chipset: "BCM2708",
    supported: false,
    tested: false,
    bootFileName: 'bootcode.bin',
    gadgetCompatibility: {
      mass_storage64: false,
      recover_eeprom5: false
    }
  },
  {
    productId: 0x2764,
    name: 'Raspberry Pi 3',
    chipset: "BCM2710",
    supported: true,
    tested: false,
    bootFileName: 'bootcode.bin',
    gadgetCompatibility: {
      mass_storage64: false,
      recover_eeprom5: false
    }
  },
  {
    productId: 0x2711,
    name: 'Raspberry Pi 4 Model B, Raspberry Pi 400, Raspberry Pi Compute Module 4.',
    chipset: "BCM2711",
    supported: true,
    tested: false,
    fsPrefix: '2711',
    bootFileName: 'bootcode4.bin',
    gadgetCompatibility: {
      mass_storage64: false,
      recover_eeprom5: false
    }
  },
  {
    productId: 0x2712,
    name: 'Raspberry Pi 5',
    chipset: "BCM2712",
    supported: true,
    tested: false,
    fsPrefix: '2712',
    bootFileName: 'bootcode5.bin',
    gadgetCompatibility: {
      mass_storage64: true,
      recover_eeprom5: false
    }
  }
] as const;
