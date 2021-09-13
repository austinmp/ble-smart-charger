import React, { useState, useEffect, useRef } from 'react';
import { BleManager } from 'react-native-ble-plx';
import base64 from 'react-native-base64';
import DeviceBattery from 'react-native-device-battery';
import { Icon } from 'react-native-elements'
import BackgroundTimer from 'react-native-background-timer';
import {
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const BATTERY_SERVICE_UUID = "180F";
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2A19";
const LED_CHARACTERISTIC_UUID = "19B10001-E8F2-537E-4F6C-D104768A1214";
const LED_ROUTINES = ['Electric Current \n (Multi-Color)', 'Electric Current \n (Single Color)', ' Battery Level Cylon', 'Rainbow', 'Rainbow Cylon', 'Off'];
let ble = new BleManager();

const App = () => {
  const charger = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(0.0);
  const [buttonStatus, setButtonStatus] = useState('Connect');                // Connect , Disconnect, or Connecting..., Disconecting...
  const [error, setError] = useState(null);
  const [isCharging, setIsCharging] = useState(false);

  useEffect( async () => {
    const level = await getBatteryLevel();
    setBatteryLevel(level);
  }, []);

 // send battery status to charger every 2 minute
useEffect( () => {
  BackgroundTimer.runBackgroundTimer(async () => { 
    let connected;
    setIsConnected( currState => {                // get most up to date connection status
      connected = currState;
      return currState;
    });
    if(connected) {
      console.log('running task');
      await sendBatteryLevelToCharger();
    } else {
      console.log('not connected');
    }
  }, 120000); 
  return ()=> BackgroundTimer.stopBackgroundTimer;
}, [] )

  // listen for device battery level changes
  useEffect( () => {
    DeviceBattery.addListener( (state) => {       // state : {level: 0.95, charging: true}
      setBatteryLevel(state.level.toFixed(2));
      setIsCharging(state.charging);
    }) 
  }, []);

  useEffect( () => {
    if(isConnected){
      setButtonStatus('Disconnect');
    } else if (isScanning) {
      setButtonStatus('Connecting...');
    } else {
      setButtonStatus('Connect');
    }
  }, [isConnected, isScanning]);

  // once we are connected to charger, subscribe to device disconnect events
  useEffect( () => {
    if(isConnected && charger.current){
      const subscription = ble.onDeviceDisconnected(charger.current.id, tearDownBLEManager);
      const cleanup = () => {
        subscription.remove();
      }
      return cleanup;    
    }
  }, [isConnected]);

  // returns battery level between 0 and 1 with up to 2 decimal places
  const getBatteryLevel = async () => {
    const level = await DeviceBattery.getBatteryLevel();
    return level.toFixed(2);
  }

  const sendBatteryLevelToCharger = async () => {
    const currLevel = await getBatteryLevel();
    const encodedString = base64.encode(`${currLevel}`);
    await charger.current.writeCharacteristicWithoutResponseForService(BATTERY_SERVICE_UUID, BATTERY_LEVEL_CHARACTERISTIC_UUID , encodedString);
    console.log('Battery level sent to charger : ' + currLevel);
  }

  const scanAndConnect = async () => {
    console.log('scanning...');
    setIsScanning(true);
    ble.startDeviceScan([BATTERY_SERVICE_UUID], null, onDeviceFound);
    setTimeout(stopScan, 10000);   // stop scan if no charger is found after 10 seconds  
  }

  const onDeviceFound = async (error, device) => {
    if (error) {
      setError('Failed to connect. Please try again.');
      console.log('error while scanning' + error);
      return;
    }
    if (device.name === 'BatteryMonitor' || device.localName === 'BatteryMonitor') {
      console.log('found charger');
      try {
        ble.stopDeviceScan();
        await device.connect(); 
        await device.discoverAllServicesAndCharacteristics();
        charger.current = device;
        setIsConnected(true);
        await sendBatteryLevelToCharger();
      } catch (err) {
        setIsConnected(false);
        setError('Failed to connect. Please try again.');
        console.log('error occured while connecting to device :' + err);
      } finally {
        setIsScanning(false);
      }
    }
  }

  const stopScan = () => {
    let connected;
    setIsConnected( currState => {
      connected = currState;
      return currState;
    });
    if(!connected) {
      ble.stopDeviceScan();
      setError('Scan timed out. Please try again.');
      console.log('Connection timeout. Failed to connect to charger.');    
    }
    setIsScanning(false);          
  }

  const disconnect = async () => {
    setButtonStatus('Disconnecting...');
    try {
      if(charger.current && await ble.isDeviceConnected(charger.current.id)){
        await ble.cancelDeviceConnection(charger.current.id);
      }
    } catch (err) {
      console.log('Unable to gracefully disconnect, disconnecting manually.');
    } finally {
      tearDownBLEManager();
    }
  }

  const tearDownBLEManager = (error, device) => {
    setIsConnected(false);
    charger.current = null;
    ble.destroy();
    ble = new BleManager();
  }

  const changeLEDRoutine = async (index) => {
    const encodedString = base64.encode(`${index}`);
    await charger.current.writeCharacteristicWithoutResponseForService(BATTERY_SERVICE_UUID, LED_CHARACTERISTIC_UUID, encodedString);
    console.log('Data sent to charger! Index =  ' + index);
  }

  const onConnectButtonPress = async () => {
    setError(null);
    switch(buttonStatus) {
      case 'Disconnect' :
        await disconnect();
        break;
      case 'Connect' :
        await scanAndConnect();
        break;
    }
  }

  return (
    <SafeAreaView style={styles.safeAreaView}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        <View style={styles.batteryLevel}>
          <Icon styles={styles.icon}
            name='bolt' 
            type='material'
            color='#FFFFFF'
            size={100}
          />
          <Text style={styles.batterlyLevelText}>{`${batteryLevel*100}%`}</Text>
        </View>
        { error 
          ? <Text style={styles.text}>{error}</Text>
          : null
        }
        <TouchableOpacity
          style={styles.connectButton}
          onPress={ onConnectButtonPress} 
        >
          <Text style={styles.text}>{buttonStatus}</Text>
        </TouchableOpacity>
        <View style={styles.LEDRoutineHeaderContainer}>
          <Icon style={styles.icon}
              name='led-on' 
              type='material-community'
              color='#FFFFFF'
              size={25}
            />
          <Text style={styles.headerText}>LED Routines</Text>      
        </View>
        <View style={styles.LEDRoutineGrid}>
          { LED_ROUTINES.map( (routine, index) => {
              return (
                <TouchableOpacity 
                  style={isConnected ? styles.card : disabledCard}
                  key={routine} 
                  onPress={ () => changeLEDRoutine(index)} 
                  disabled = {!isConnected}
                >
                  <Text style={styles.text}>{routine}</Text>
                </TouchableOpacity>
              )
            })
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  
}

const styles = StyleSheet.create({
  safeAreaView: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    textAlign: 'center',
    alignItems: 'center',
    alignContent: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#f7b030',
    fontSize: 20,
  },

  scrollView: {
    height: 800,
    paddingTop: 20,
    paddingBottom: 40,
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'space-around',
  },

  batteryLevel:{
    display: 'flex',
    flexDirection: 'row',
    width:'80%',
    backgroundColor: '#f7b030',
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 1,
    shadowRadius: 6.68,

    elevation: 8,
  },
  
  connectButton: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'white',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    borderRadius: 30,
    width: '80%',
    height: 50,
    padding: 12,  
    backgroundColor: 'white',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.36,
    shadowRadius: 6.68,
    elevation: 11,
  },

  LEDRoutineGrid: {
    width: '100%',
    display: 'flex',
    flexWrap: 'wrap',
    height: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  
  card: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'white',
    width: '40%',
    height: 100,
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.36,
    shadowRadius: 6.68,
    elevation: 11,
  },

  disabled: {
    backgroundColor: 'rgba(45, 45, 42, 0.24)',
    elevation: 0,
  },

  text: {
    fontSize: 16,
    textAlign: 'center',
  },

  headerText: {
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '700',
    color: 'white',
  },

  batterlyLevelText: {
    fontSize: 50,
    fontWeight: '700',
    color: 'white',
    margin: 0,
  },

  LEDRoutineHeaderContainer : {
    display: 'flex',
    flexDirection: 'row',
    width:'80%',
    backgroundColor: '#f7b030',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  icon : {
    marginRight: 20
  }
  
});

const disabledCard = StyleSheet.compose(styles.card, styles.disabled);

export default App;
