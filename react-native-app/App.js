import React, { useState, useEffect, useRef } from 'react';
import { BleManager } from 'react-native-ble-plx';
import styled from 'styled-components';
import base64 from 'react-native-base64';
import DeviceBattery from 'react-native-device-battery';
import { Icon } from 'react-native-elements'
import BackgroundTimer from 'react-native-background-timer';
import {
  Button,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  NativeModules,
  DeviceEventEmitter,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

const BATTERY_SERVICE_UUID = "180F";
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2A19";
const LED_CHARACTERISTIC_UUID = "19B10001-E8F2-537E-4F6C-D104768A1214";
const LED_ROUTINES = ['Electric Current (Multi-Color)', 'Electric Current (Single Color)', ' Battery Level Cylon', 'Rainbow', 'Rainbow Cylon', 'Off'];
let ble = new BleManager();

const App = () => {
  const charger = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBleAvailable, setIsBleAvailable] = useState(false);    // TO DO: SET THIS UP SO IT WILL WORK ON IOS
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

  // listen for changes in device battery level
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

  //Once we are connected to charger, subscribe to device disconnect events
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
      setError('Scan timed out. Failed to connect to charger');
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

  const changeLED = async (index) => {
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
    <Container>
      <ScrollView
        contentContainerStyle={styles.scrollView}   
      >
        <View style={styles.batteryLevel}>
          <Icon
            name='bolt' 
            type='material'
            color='#FFFFFF'
            size={100}
          />
          <StatusText>{`${batteryLevel*100}%`}</StatusText>
        </View>
        { error 
          ? <ErrorStatus>{error}</ErrorStatus>
          : null
        }
        <TouchableOpacity
          style={styles.connectButton}
          onPress={ onConnectButtonPress} 
        >
          <Text style={styles.text}>{buttonStatus}</Text>
        </TouchableOpacity>      
        <LEDRoutineGrid>
          { LED_ROUTINES.map( (routine, index) => {
              return (
                <TouchableOpacity 
                  style={isConnected ? styles.card : disabledCard}
                  key={routine} 
                  onPress={ () => changeLED(index)} 
                  disabled = {!isConnected}
                >
                  <Text style={styles.text}>{routine}</Text>
                </TouchableOpacity>
              )
            })
          }
        </LEDRoutineGrid>
      </ScrollView>
    </Container>
  );
  
}

const styles = StyleSheet.create({
  scrollView: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'space-evenly',
  },
  batteryLevel:{
    display: 'flex',
    flexDirection: 'row',
    width:'70%',
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'center',
    // shadowColor: "#000",
    // shadowOffset: {
    //   width: 0,
    //   height: 5,
    // },
    // shadowOpacity: 0.36,
    // shadowRadius: 6.68,
    // elevation: 5,
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
    width: '70%',
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
    fontSize: 18,
    textAlign: 'center'
  },
});

const disabledCard = StyleSheet.compose(styles.card, styles.disabled);

const Container = styled.SafeAreaView`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  text-align: center;
  align-items: center;
  align-content: center;
  background: #f7b030
  font-size: 20px;
`;
   
const StatusText = styled.Text`
  font-size: 50px;
  font-weight: 700;
  color: white;
  margin: 0;
`;

const ErrorStatus = styled.Text`
  font-size: 18px;
  text-align: center;
  color: black;
`;

const LEDRoutineGrid = styled.View`
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  height: auto;
  flex-direction: row;
  justify-content: space-evenly;
`;

export default App;
