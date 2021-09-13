import React, { useState, useEffect, useRef } from 'react';
import { BleManager } from 'react-native-ble-plx';
import styled from 'styled-components';
import base64 from 'react-native-base64';
import DeviceBattery from 'react-native-device-battery';
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
  NativeEventEmitter,
  PermissionsAndroid,
} from 'react-native';
import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

const ble = new BleManager();
const BATTERY_SERVICE_UUID = "180F";
const BATTERY_LEVEL_CHARACTERISTIC_UUID = "2A19";
const LED_CHARACTERISTIC_UUID = "19B10001-E8F2-537E-4F6C-D104768A1214";
const LED_ROUTINES = ['Battery Level', 'Rainbow', 'Sinelon', 'Off'];

const App = () => {
  const charger = useRef(null);
  const isConnected = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBleAvailable, setIsBleAvailable] = useState(false);    // TO DO: SET THIS UP SO IT WILL WORK ON IOS
  const [batteryLevel, setBatteryLevel] = useState(0.0);


  // TO DO IS CONNECTED STATE IS NOT BEING UPDATED FIX!!!

  useEffect( async () => {
    const batteryLevel = await getBatteryLevel();
    setBatteryLevel(batteryLevel);
    DeviceBattery.addListener(onBatteryStateChanged);
  }, []);



  useEffect( () => {
    console.log('useEfeect triggered');
    // sendBatteryLevelToCharger(batteryLevel);
    // console.log(`${batteryLevel*100}%`);
  }, [isConnected.current]);

  const onBatteryStateChanged = (state) => {
    // console.log(state) // {level: 0.95, charging: true}
    setBatteryLevel(state.level);
    sendBatteryLevelToCharger(state.level.toFixed(2));
  }

  const sendBatteryLevelToCharger = async (level) => {
    const currLevel = level || batteryLevel;
    if(isConnected.current) {
      const encodedString = base64.encode(`${currLevel}`);
      await charger.current.writeCharacteristicWithoutResponseForService(BATTERY_SERVICE_UUID, BATTERY_LEVEL_CHARACTERISTIC_UUID , encodedString);
      console.log('data sent to charger');
    } else {
      console.log('Not connected to charger');
    }
  }

  // returns battery level between 0 and 1 with up to 2 decimal places
  const getBatteryLevel = async () => {
    const level = await DeviceBattery.getBatteryLevel();
    // return level.toFixed(2);
    return level;
  }

  const onDeviceFound = async (error, device) => {
    if (error) {
      console.log('error while scanning' + error);
      return;
    }

    if (device.name === 'BatteryMonitor' || device.localName === 'BatteryMonitor') {
      try {
        ble.stopDeviceScan();
        await device.connect(); 
        console.log('connected!');  
        await device.discoverAllServicesAndCharacteristics();
        charger.current = device;
        isConnected.current = true;
        await sendBatteryLevelToCharger();
        const subscription = ble.onDeviceDisconnected(device.id, (error, device) => {
          charger.current = null;
          isConnected.current = false;
          subscription.remove();
          console.log('disconnected')
        });
        
      } catch (err) {
          isConnected.current = false;
          console.log('error occured while connecting to device :' + err);
      } 
    }
  }

  const scanAndConnect = async () => {
    console.log('scanning...');
    setIsScanning(true);
    ble.startDeviceScan(null, null, onDeviceFound);
    setTimeout(stopScan, 10000);   // stop scan if no charger is found after 10 seconds  
  }

  const stopScan = () => {
    if(!isConnected.current) {
      ble.stopDeviceScan();
      console.log('failed to find charger');    // ADD AN ERROR MESSAGE STATUS HERE       
    }
    setIsScanning(false);          
  }

  const disconnect = async () => {
    try {
      if(charger.current && await ble.isDeviceConnected(charger.current.id)){
        await ble.cancelDeviceConnection(charger.current.id);
      }
    } catch (err) {
      console.log('disconnect fail, turn ble off and on manually');
    }
  }

  const changeLED = async (index) => {
    const encodedString = base64.encode(`${index}`);
    await charger.current.writeCharacteristicWithoutResponseForService(BATTERY_SERVICE_UUID, LED_CHARACTERISTIC_UUID, encodedString);
    console.log('Data sent to charger! Index =  ' + index);
  }

  return (
    <Container>
      <ScrollView>
        { isConnected.current ? 
          <StatusText>Connected to charger!</StatusText>
        : isScanning ?
          <>
            <ActivityIndicator size="large" color="#00ff00" />
            <StatusText>Scanning...</StatusText>
          </>
        : <StatusText>Disconnected from charger.</StatusText>
        }
        <ButtonContainer>
          <Button
              title="Connect to Charger"
              color="#6568f4"
              onPress={scanAndConnect}
          />
        </ButtonContainer>
        <StatusText>{`Battery Level: ${batteryLevel*100}%`}</StatusText>
        <ButtonContainer>
          <Button
              title="Disconnect"
              color="#6568f4"
              onPress={disconnect}
          />
        </ButtonContainer>
        <ButtonContainer>
          <Button
              title="Send Data"
              color="#6568f4"
              onPress={sendBatteryLevelToCharger}
          />
        </ButtonContainer>
        <ButtonContainer>
          <Button
              title="Change LED"
              color="purple"
              onPress={changeLED}
          />
        </ButtonContainer>
        <LEDRoutineGrid>
        { LED_ROUTINES.map( (routine, index) => {
            return (
              <Card key={routine} onPress={ () => changeLED(index)} >
                <Text>{routine}</Text>
              </Card>
            )
          })
        }
        </LEDRoutineGrid>
      </ScrollView>
    </Container>
  );
  
}


const Container = styled.SafeAreaView`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
`;

const StatusText = styled.Text`
  font-size: 18px;
  text-align: center;
`;

const ButtonContainer = styled.TouchableOpacity`
  width: 100%;
  height: 100px;
  padding: 12px;
  border-radius: 10px;
  text-align:center;
`;

const LEDRoutineGrid = styled.View`
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  height: auto;
  flex-direction: row;
  justify-content: space-evenly;
`;

const Card = styled.TouchableOpacity`
  width: 40%;
  height: 100px;
  color: white;
  background: #FFE433;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin: 10px 0px 10px 0px;
`;

// const LEDRoutineButton = styled.Button`
//   width: 100%;
//   height: 100%;
// `;




// const styles = StyleSheet.create({
//   sectionContainer: {
//     marginTop: 32,
//     paddingHorizontal: 24,
//   },
//   sectionTitle: {
//     fontSize: 24,
//     fontWeight: '600',
//   },
//   sectionDescription: {
//     marginTop: 8,
//     fontSize: 18,
//     fontWeight: '400',
//   },
//   highlight: {
//     fontWeight: '700',
//   },
// });

export default App;


// import type {Node} from 'react';

// const Section = ({children, title}): Node => {
//   const isDarkMode = useColorScheme() === 'dark';
//   return (
//     <View style={styles.sectionContainer}>
//       <Text
//         style={[
//           styles.sectionTitle,
//           {
//             color: isDarkMode ? Colors.white : Colors.black,
//           },
//         ]}>
//         {title}
//       </Text>
//       <Text
//         style={[
//           styles.sectionDescription,
//           {
//             color: isDarkMode ? Colors.light : Colors.dark,
//           },
//         ]}>
//         {children}
//       </Text>
//     </View>
//   );
// };


// const App: () => Node = () => {
//   const isDarkMode = useColorScheme() === 'dark';

//   const backgroundStyle = {
//     backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
//   };

//   return (
//     <SafeAreaView style={backgroundStyle}>
//       <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
//       <ScrollView
//         contentInsetAdjustmentBehavior="automatic"
//         style={backgroundStyle}>
//         <Header />
//         <View
//           style={{
//             backgroundColor: isDarkMode ? Colors.black : Colors.white,
//           }}>
//           <Section title="Step One">
//             Edit <Text style={styles.highlight}>App.js</Text> to change this
//             screen and then come back to see your edits.
//           </Section>
//           <Section title="See Your Changes">
//             <ReloadInstructions />
//           </Section>
//           <Section title="Debug">
//             <DebugInstructions />
//           </Section>
//           <Section title="Learn More">
//             Read the docs to discover what to do next:
//           </Section>
//           <LearnMoreLinks />
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   sectionContainer: {
//     marginTop: 32,
//     paddingHorizontal: 24,
//   },
//   sectionTitle: {
//     fontSize: 24,
//     fontWeight: '600',
//   },
//   sectionDescription: {
//     marginTop: 8,
//     fontSize: 18,
//     fontWeight: '400',
//   },
//   highlight: {
//     fontWeight: '700',
//   },
// });
