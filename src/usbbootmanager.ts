import { v4 } from 'uuid';

import parseTar from 'parse-tar';
import { AvailableGadgetIds, availableGadgets } from './Config/Gadgets';
import { RASPBERRY_PI_VENDOR_ID, RaspberryPiModels, RaspeberryPiModel } from './Config/Models';
import { FileSystem } from './filesystem';

export const LIBUSB_MAX_TRANSFER = (16 * 1024);
export interface RaspberryPiDevice {
  model: RaspeberryPiModel;
  serialNumber?: string;
}


type AvailableEvents = 'deviceconnected' | 'devicedisconnected';

export class UsbBootManager {


  private selectedDevice?: USBDevice;

  private selectedModel?: RaspberryPiDevice;


  private eventListeners: Record<AvailableEvents, {
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (...args: any[]) => void;
  }[]> = {
      deviceconnected: [],
      devicedisconnected: []
    };

  constructor() {

    console.log("Constructing UsbBootManager");

    if (!this.isWebusbSupported()) {
      console.error('WebUSB is not supported');
      return;
    }

    this.getAvailableDevices();

    const disconnectHandler = (event: USBConnectionEvent) => {

      if (event.device === this.selectedDevice) {
        console.log('Device disconnected', event.device);
        event.device.close();
        if (this.activeGattget === undefined) {
          this.triggerEvent('devicedisconnected');
        }
        this.selectedDevice = undefined;
        this.selectedModel = undefined;
        return;
      }

      console.error('Unknown device disconnected', event.device);
    };

    const connectHandler = () => {
      this.getAvailableDevices();
    };

    navigator.usb.addEventListener('connect', connectHandler);

    navigator.usb.addEventListener('disconnect', disconnectHandler);


    this.deinitHandlers = () => {
      navigator.usb.removeEventListener('disconnect', disconnectHandler);
      navigator.usb.removeEventListener('connect', connectHandler);
    };

  }

  private deinitHandlers?: () => void;
  private deinited = false;

  private activeGattget?: {
    id: AvailableGadgetIds;
    fileSystem: FileSystem;
  };

  private guardDeinit() {
    if (this.deinited) {
      console.trace('UsbBootManager has been deinitialized');
      throw new Error('UsbBootManager has been deinitialized');
    }
  }
  public deinit() {
    this.deinited = true;
    if (this.deinitHandlers !== undefined) {
      console.trace('Deinitializing UsbBootManager');
      this.deinitHandlers();
    }


  }

  private async triggerEvent(event: 'devicedisconnected', status?: boolean): Promise<void>;
  private async triggerEvent(event: 'deviceconnected', data: RaspberryPiDevice): Promise<void>;
  private async triggerEvent(event: AvailableEvents, ...data: unknown[]): Promise<void> {
    console.log('Triggering event', event, data);
    this.eventListeners[event].forEach(listener => listener.callback(...data));
  }

  public on(event: 'devicedisconnected', callback: (status?: boolean) => void): string;
  public on(event: 'deviceconnected', callback: (data: RaspberryPiDevice) => void): string;
  public on(event: AvailableEvents, callback: ((data: RaspberryPiDevice) => void) | (() => void)): string {
    this.guardDeinit();
    const id = v4();
    this.eventListeners[event].push({
      id: id,
      callback
    });

    return id;
  }

  private async readDeviceDescriptor() {
    const resp = await this.selectedDevice!.controlTransferIn({
      requestType: 'standard',
      recipient: 'device',
      request: 0x06,
      value: 0x0100,
      index: 0x0000
    }, 255)
    

    if (resp.status !== 'ok') {
      console.error('Error reading device descriptor', resp);
      return;
    }

    if (!resp.data) {
      console.error('No data returned');
      return;
    }

    const view = new DataView(resp.data.buffer);

    const iSerialNumber = view.getUint8(16);

    console.log({ iSerialNumber });
    
    return iSerialNumber;
  }

  public off(event: AvailableEvents, id: string) {
    this.guardDeinit();
    this.eventListeners[event] = this.eventListeners[event].filter(listener => listener.id !== id);
  }


  public isWebusbSupported() {
    this.guardDeinit();
    return 'usb' in navigator;
  }

  private async getAvailableDevices() {
    const devices = await navigator.usb.getDevices();


    for (const deviceIndex in devices) {
      const device = devices[deviceIndex];

      const model = RaspberryPiModels.find(model => model.productId === device.productId);

      if (model === undefined) {
        console.error('Unknown device model', device);
        continue;
      }

      this.selectedModel = {
        model,
        serialNumber: device.serialNumber
      };

      this.selectedDevice = device;
      await this.initializeDeviceCom();

      console.log('Found device', this.selectedDevice);

      if (this.activeGattget === undefined) {
        this.triggerEvent('deviceconnected', this.selectedModel);
      }
      break;
    }
  }

  public async requestDevices() {
    this.guardDeinit();
    const allProductIds = RaspberryPiModels.map(model => model.productId);
    try {
      const device = await navigator.usb.requestDevice({
        filters:
          allProductIds.map(productId => ({
            vendorId: RASPBERRY_PI_VENDOR_ID,
            productId
          }))
      });


      this.selectedDevice = device;

      const model = RaspberryPiModels.find(model => model.productId === device.productId);

      if (model === undefined) {
        console.error('Unknown device model');
        return;
      }

      this.selectedModel = {
        model,
        serialNumber: device.serialNumber
      };

      this.triggerEvent('deviceconnected', this.selectedModel);
      await this.initializeDeviceCom();
    } catch (error) {
      console.error(error);
    }

  }


  async initializeDeviceCom() {
    if (this.selectedDevice === undefined) {
      console.error('No device selected');
      return;
    }


    // if (this.selectedDevice.opened) {
    //   await this.selectedDevice.close();
    // }

    if (!this.selectedDevice.opened) {
      try {
        // this.selectedDevice.forget();
        await this.selectedDevice.open();
      } catch (error) {
        console.error('Error opening device', error);
      }
    }

    let interfaceNumber: number;
    let endpointIn: number;
    let endpointOut: number;

    if (this.selectedDevice.configuration === undefined) {
      console.error('Device has no configuration');
      return;
    }

    const interfaces = this.selectedDevice.configuration.interfaces;

    if (interfaces.length === 0) {
      console.error('Device has no interfaces');
      return;
    }



    // https://github.com/raspberrypi/usbboot/blob/bbd603383eda4d61c54bd466bca59478ba37e167/main.c#L388-L389
    // Handle 2837 where it can start with two interfaces, the first is mass storage
    // the second is the vendor interface for programming
    if (interfaces.length === 1) {
      interfaceNumber = interfaces[0].interfaceNumber;
      endpointIn = interfaces[0].alternate.endpoints[0].endpointNumber;
      endpointOut = interfaces[0].alternate.endpoints[1].endpointNumber;
    } else {
      interfaceNumber = interfaces[1].interfaceNumber;
      endpointIn = interfaces[1].alternate.endpoints[0].endpointNumber;
      endpointOut = interfaces[1].alternate.endpoints[1].endpointNumber;
    }

    console.log({ interfaceNumber, endpointIn, endpointOut });
    // Claim interface
    await this.selectedDevice.claimInterface(interfaceNumber);
    // await this.prepareBootFiles();

    if (this.activeGattget === undefined) {
      return;
    }

    this.runGadget();

  }


  async epRead(len: number, usbDevice: USBDevice) {
    // Prepare a buffer to receive the data
    const buffer = new Uint8Array(len);

    // Control transfer equivalent
    const controlTransferResult = await usbDevice.controlTransferIn({
      requestType: 'vendor',
      recipient: 'device',
      request: 0,
      value: len & 0xffff,
      index: len >> 16
    }, len);

    if (!controlTransferResult.data) {
      console.error("Failed control transfer", controlTransferResult);
      return -1;
    }

    if (controlTransferResult.status === 'ok' && controlTransferResult.data.byteLength > 0) {
      buffer.set(new Uint8Array(controlTransferResult.data.buffer));
      return buffer;
    } else {
      console.error("Failed control transfer", controlTransferResult);
      return -1;
    }
  }


  private async epWrite(buffer: Uint8Array, usbDevice: USBDevice) {
    let totalSent = 0;
    let len = buffer.byteLength;
    const outEndpoint = 1; // You need to specify the correct endpoint here

    // Control transfer equivalent
    const controlTransferResult = await usbDevice.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0,
      value: len & 0xffff,
      index: len >> 16
    });

    if (controlTransferResult.status !== 'ok') {
      console.error("Failed control transfer", controlTransferResult);
      return -1;
    }

    // Bulk transfer equivalent
    while (len > 0) {
      const sending = Math.min(len, LIBUSB_MAX_TRANSFER);
      const chunk = buffer.slice(totalSent, totalSent + sending);

      const bulkTransferResult = await usbDevice.transferOut(outEndpoint, chunk);

      if (bulkTransferResult.status !== 'ok') {
        console.error("Failed bulk transfer", bulkTransferResult);
        return -1;
      }

      totalSent += sending;
      len -= sending;
    }

    console.log(`libusb_bulk_transfer sent ${totalSent} bytes`);

    return totalSent;
  }

  availableGadgets(): AvailableGadgetIds[] {
    if(this.selectedModel === undefined){
      throw new Error('No model selected');
    }

    const model = this.selectedModel.model;

    return availableGadgets.filter(gadget => model.gadgetCompatibility[gadget.id]).map(gadget => gadget.id);
  }


  async startGadget(gadgetId: AvailableGadgetIds) {

    if (this.activeGattget !== undefined) {
      throw new Error('Gadget already started');
    }

    if(this.selectedDevice === undefined){
      throw new Error('No device selected');
    }

    if(this.selectedModel === undefined){
      throw new Error('No model selected');
    }

    const gadget = availableGadgets.find(gadget => gadget.id === gadgetId);

    if(gadget === undefined){
      throw new Error('Unknown gadget');
    }

    const deviceModel = this.selectedModel;

    if(!deviceModel.model.gadgetCompatibility[gadgetId]){
      throw new Error('Gadget not compatible with model');
    }

    const bootFilesResponse = await fetch(gadget.bootfiles);
    const bootFilesBlob = await bootFilesResponse.blob();
    // console.log({ bootFilesBuffer })
    // const boot_message = 
    const files = await parseTar(bootFilesBlob);

    console.log({files});
    
    const fileSystem = new FileSystem(deviceModel.model.fsPrefix);

    console.log({ gadgetFiles: gadget.files });

    const allFiles = await Promise.all(Object.entries(gadget.files).map(async ([fileName, fileURL]) => {
      const response = await fetch(fileURL);
      const buffer = await response.arrayBuffer();
      return {
        name: fileName,
        contents: buffer
      };
    }));

    console.log({ allFiles });

    fileSystem.addMount({
      async getFile(path) {
        return allFiles.find(file => file.name === path)?.contents ?? null;
      },
      async getSize(path) {
        return (allFiles.find(file => file.name === path)?.contents.byteLength) ?? null;
      },
    });



    fileSystem.addMount({
      async getFile(path) {
        const file = files.find(file => file.name === path);
        if (!file) {
          return null;
        }
        return await file.contents?.arrayBuffer() ?? null;
      },
      async getSize(path) {
        return (files.find(file => file.name === path)?.size) ?? null;
      },
    });


    

    this.activeGattget = {
      id: gadgetId,
      fileSystem: fileSystem
    };

    this.runGadget();
  }


  private async runGadget() {

    if (this.selectedDevice === undefined) {  
      throw new Error('No device selected');
    }

    if(this.selectedModel === undefined){
      throw new Error('No model selected');
    }

    if(this.activeGattget === undefined){
      throw new Error('No active gadget');
    }



    const iserial = await this.readDeviceDescriptor();

    if (iserial === undefined) {
      throw new Error('Error reading iSerialNumber');
    }
    console.log({ iserial });
    
    if (iserial === 0 || iserial === 3) {
      await this.firstStageBoot();
    } else {
      await this.fileServer();
    }


  }


  private async firstStageBoot() {


    if (this.selectedDevice === undefined) {  
      throw new Error('No device selected');
    }

    if(this.activeGattget === undefined){
      throw new Error('No active gadget');
    }

    const bootFiles = await this.prepareBootFiles(this.activeGattget.id, this.activeGattget.fileSystem);

    if(!bootFiles){
      throw new Error('Error preparing boot files');
    }

    const { bootHeader, bootFile } = bootFiles;

    await this.epWrite(new Uint8Array(bootHeader), this.selectedDevice);
    await this.epWrite(new Uint8Array(bootFile), this.selectedDevice);

    // Read 4 byte int return code
    const response = await this.epRead(4, this.selectedDevice);

    if(response === -1){
      throw new Error('Error reading response');
    }

    // Convert the response to a number
    const responseView = new DataView(response.buffer);
    const responseCode = responseView.getInt32(0, true);

    console.log({ responseCode });

    if (responseCode !== 0) {
      console.error('Error starting gadget', responseCode);
    }

    console.log("First stage boot completed");
  }


  async fileServer() {
    console.log("File server loop");
    let canContinue = true;

    try {


      if (this.selectedDevice === undefined) {
        canContinue = false;
        throw new Error('No device selected');
      }

      if (this.activeGattget === undefined) {
        canContinue = false;
        throw new Error('No active gadget');
      }

      console.log("Waiting for command message");
      const commandMessage = await this.epRead(260, this.selectedDevice);

      if (commandMessage === -1) {
        console.error('Error reading command message');
        return;
      }

      const commandMessageView = new DataView(commandMessage.buffer);
      const command = commandMessageView.getInt32(0, true);
      const message_names = ["GetFileSize", "ReadFile", "Done"];

      const textDecoder = new TextDecoder("ascii");

      const pathBuffer = new Uint8Array(commandMessage.buffer.slice(4));

      // This is a null terminated string
      let path: string | undefined = undefined;


      for (let end = 0; end < pathBuffer.byteLength; end++) {
        if (pathBuffer[end] === 0) {
          path = textDecoder.decode(pathBuffer.slice(0, end));
          break;
        }
      }


      if (path === undefined) {
        console.error('Error parsing path');
        return;
      }


      console.log({ command: message_names[command], path });

      switch (command) {
        case 0: {
          
          const size = await this.activeGattget.fileSystem.getSize(path);

          if(size === null){
            console.error('Error getting file size');
            return;
          }

          /*
int sz = libusb_control_transfer(usb_device, LIBUSB_REQUEST_TYPE_VENDOR, 0,
																				 file_size & 0xffff, file_size >> 16, NULL, 0, 1000);
          */
          
          const buffer = new ArrayBuffer(4);
          const view = new DataView(buffer);
          view.setInt32(0, size, true);

          await this.selectedDevice.controlTransferOut({
            requestType: 'vendor',
            recipient: 'device',
            request: 0,
            value: size & 0xffff,
            index: size >> 16
          });
          // await this.epWrite(new Uint8Array(buffer), this.selectedDevice);

          break;

        }
          
        case 1: {
          const file = await this.activeGattget.fileSystem.getFile(path);

          if(file === null){
            console.error('Error reading file');
            return;
          }

          await this.epWrite(new Uint8Array(file), this.selectedDevice);

          break;
        }
          
        case 2: {
          canContinue = false;
          this.selectedDevice.close();
          this.selectedDevice.forget();
          this.activeGattget = undefined;
          this.selectedDevice = undefined;
          this.selectedModel = undefined;
          this.triggerEvent('devicedisconnected', true);
          break;
        }
          
      }


    } finally {
      if (canContinue) {
        setTimeout(() => {
          this.fileServer();
        }, 1);
      }
    }

  }

  private async prepareBootFiles(gadgetId: AvailableGadgetIds, fileSystem: FileSystem) {

    const gadget = availableGadgets.find(gadget => gadget.id === gadgetId);

    if (gadget === undefined) {
      console.error('Unknown gadget', gadgetId);
      return;
    }

    if (this.selectedDevice === undefined) {
      console.error('No device selected');
      return;
    }

    if (this.selectedModel === undefined) {
      console.error('No model selected');
      return;
    }

    const deviceModel = this.selectedModel;

    
    const bootFile = await fileSystem.getFile(deviceModel.model.bootFileName);

    if (bootFile === null) {
      console.error('Boot file not found');
      return;
    }



    /* Empy Boot header
        ac 17 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 
    */
    
    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);
    view.setInt32(0, bootFile.byteLength, true);

    console.log(buffer);
    
    // const bootHeader = new Uint8Array([
    //   0xac, 0x17, 0x01,

    
    return {
      bootHeader: buffer,
      bootFile: bootFile
    }
  }
}


