
import RecoveryBootcode5Bin from '../../usbboot/firmware/2712/recovery.bin?url';
import MassStorageGadgedBootFilesBin from '../../usbboot/firmware/bootfiles.bin?url';
import BootImg from '../../usbboot/mass-storage-gadget64/boot.img?url';
import ConfigTxt from '../../usbboot/mass-storage-gadget64/config.txt?url';
import RecoveryBootConf from '../../usbboot/recovery5/boot.conf?url';
import PieepromBin from '../../usbboot/recovery5/pieeprom.bin?url';
import PieepromSig from '../../usbboot/recovery5/pieeprom.sig?url';
import RecoveryBin from '../../usbboot/recovery5/recovery.bin?url';
import PieepromOriginalBin from '../../usbboot/rpi-eeprom/firmware-2712/default/pieeprom-2024-06-05.bin?url';

export const availableGadgets = [
  {
    id: "mass_storage64",
    name: "Mass Storage Gadget (64 bit devices)",
    bootfiles: MassStorageGadgedBootFilesBin,
    files: {
      'config.txt': ConfigTxt,
      'boot.img': BootImg
    }
  },
  { // does not work yet
    id: "recover_eeprom5",
    name: "Recovery EEPROM (Raspberry Pi 5)",
    bootfiles: MassStorageGadgedBootFilesBin,
    files: {
      'boot.conf': RecoveryBootConf,
      'bootcode5.bin': RecoveryBootcode5Bin,
      'pieeprom.bin': PieepromBin,
      'pieeprom.original.bin': PieepromOriginalBin,
      'pieeprom.sig': PieepromSig,
      'recovery.bin': RecoveryBin
    }
  }
] as const;

console.log({availableGadgets})
/*
/Users/mehmet/checkouts/usbboot/recovery5/boot.conf 
/Users/mehmet/checkouts/usbboot/recovery5/bootcode5.bin 
/Users/mehmet/checkouts/usbboot/recovery5/pieeprom.bin 
/Users/mehmet/checkouts/usbboot/recovery5/pieeprom.original.bin 
/Users/mehmet/checkouts/usbboot/recovery5/pieeprom.sig 
/Users/mehmet/checkouts/usbboot/recovery5/README.md 
/Users/mehmet/checkouts/usbboot/recovery5/recovery.bin
*/

export type AvailableGadgetIds = typeof availableGadgets[number]['id'];
