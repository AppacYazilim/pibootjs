import { useCallback, useEffect, useRef, useState } from 'react';
import { Id, toast } from 'react-toastify';
import './App.css';
import { AvailableGadgetIds, availableGadgets } from './Config/Gadgets';
import { RaspberryPiDevice, UsbBootManager } from './usbbootmanager';

function App() {

  const [bootManager, setBootManager] = useState<UsbBootManager>()
  const [connectedDevice, setConnectedDevice] = useState<RaspberryPiDevice | undefined>();
  const [deviceAvailableGadgets, setAvailableGadgets] = useState<AvailableGadgetIds[]>([]);
  
  const [loading, setLoading] = useState(false);

  const toastId = useRef<Id | null>(null);

  useEffect(() => {
    const newBootManager = new UsbBootManager();
    setBootManager(newBootManager);


    return () => {
      setBootManager(undefined);
      newBootManager.deinit();
    }
  }, []);


  const onDeviceConnectedHandler = useCallback((device: RaspberryPiDevice) => {
    toast.success(`Device connected: ${device.model.name}`);
    setConnectedDevice(device);
  }, []);
  
  const onDeviceDisconnectedHandler = useCallback((status?: boolean) => {

    if (toastId.current) {
      toast.dismiss(toastId.current);
    }

    if (status === false) {
      toast.error('Device disconnected with error');
    } else if (status === true) {
      toast.success('Device Booted');
    } else {
      toast.error('Device disconnected');
    }

    setLoading(false);
    setConnectedDevice(undefined);
  }, []);

  useEffect(() => {
    if (bootManager === undefined) {
      return;
    }
     const deviceConnectedEventListenerToken = bootManager.on('deviceconnected', onDeviceConnectedHandler);
      const deviceDisconnectedEventListenerToken = bootManager.on('devicedisconnected', onDeviceDisconnectedHandler);

    return () => {
      if (bootManager !== undefined) {
        bootManager.off('deviceconnected', deviceConnectedEventListenerToken);
        bootManager.off('devicedisconnected', deviceDisconnectedEventListenerToken);
      }
    }
  }, [bootManager, onDeviceConnectedHandler, onDeviceDisconnectedHandler]);


  useEffect(() => {
    if (!bootManager) {
      return;
    }

    if (!connectedDevice) {
      return;
    }

    const availableGadgets = bootManager.availableGadgets();
    console.log({ availableGadgets });
    setAvailableGadgets(availableGadgets);

    return () => {
      setAvailableGadgets([]);
    }
  }, [bootManager, connectedDevice])

  if (bootManager === undefined) {
    return <div>Initializing...</div>
  }
  
  if (bootManager !== undefined && !bootManager.isWebusbSupported()) {
    return <div>WebUSB is not supported</div>
  }

  if (connectedDevice === undefined) {

    return (
      <>
        <h2>
          Boot your Raspberry Pi 5 device in USB Mass Storage Mode
        </h2>
        <p>
          <ol>
            
          <li>Disconnect all cables including power cable from your Raspberry Pi 5 device.</li>
          <li>Press the power button on your Raspberry Pi 5 device.</li>
          <li>While pressing the boot button, connect the USB cable to your Raspberry Pi 5 device.</li>
          <li>After connecting the USB cable, release the boot button.</li>
          <li>If you see a solid red light on your Raspberry Pi 5 device, it means your device is ready.</li>
          <li>Press the "Scan for Devices" button to start the process.</li>
          </ol>
        </p>
        <button onClick={() => {
          if (bootManager !== undefined) {
            bootManager.requestDevices();
          }
        }}>Scan for Devices</button>
      </>
    );
  }


  return (
    <div className="App">
      <header className="App-header">
        <p>
          Connected Device: {connectedDevice.model.name} {connectedDevice.serialNumber}
        </p>
        <p>
          Please select the gadget you want to start.
          <ol>
            <li>After the boot is successful it may take a few seconds for the device to appear on your computer.</li>
            <li>After the device appears on your computer you can use the Raspberry Pi Imager or any other tool to flash the operating system.</li>
          </ol>
        </p>
        {
          deviceAvailableGadgets.map((gadget) => {
            const gadgetObj = availableGadgets.find((g) => g.id === gadget);
            if (gadgetObj === undefined) {
              return null;
            }
            return (
              <button key={gadget} disabled={loading} onClick={() => {
                if (bootManager !== undefined && connectedDevice !== undefined) {
                  // bootManager.bootDevice(connectedDevice, gadget);
                  setLoading(true);
                  toastId.current = toast.loading(`Running ${gadgetObj.name}`, {
                    autoClose: false,
                  });
                  bootManager.startGadget(gadget);
                }
              }}>
              Start {gadgetObj.name}
              </button>
            );
          })
        }
      </header>
    </div>
  );


}

export default App
