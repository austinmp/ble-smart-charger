import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Button,
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

// import { BleManager } from 'react-native-ble-plx';

import BleManager from 'react-native-ble-manager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);


const App = () => {
  const [connected, setConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [peripheral, setPeripheral] = useState();
  const [data, setData] = useState();

  const startScan = () => {
    if (!isScanning && !connected) {
      setIsScanning(true);
      console.log('Scanning...');
      BleManager.scan(["180F"], 10, true).then((results) => {
  
      }).catch(err => {
        console.error(err);
      });
    }    
  }

  const handleStopScan = () => {
    console.log('Scan is stopped');
    setIsScanning(false);
  }

  const handleDisconnectedPeripheral = (data) => {
    if (peripheral) {      
      console.log('Disconnected from ' + data.peripheral);
    }
  }

  const handleDiscoverPeripheral = (peripheral) => {
    console.log('Got ble peripheral', peripheral);
    if (peripheral.name === 'BatteryMonitor') {
      setPeripheral(peripheral);
      setConnected(true);
      BleManager.connect(peripheral.id)
        .then(() => {
          console.log("Connected");

          readData();
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }

  const readData = async () => {
    if(peripheral){
      const services = BleManager.retrieveServices(peripheral.id);

      BleManager.read(peripheral.id, "180F", "2A19")
        .then((readData) => {
          // Success code
          console.log("Read: " + readData);
          setData(readData);
      
          // const buffer = Buffer.Buffer.from(readData); //https://github.com/feross/buffer#convert-arraybuffer-to-buffer
          // const sensorData = buffer.readUInt8(1, true);
        })
        .catch((error) => {
          // Failure code
          console.log(error);
        });
    } else {
      console.log('no perif');
    }
  }

  const handleUpdateValueForCharacteristic = (data) => {
    console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
  }

  const disconnect = () => {
    if(peripheral && !isScanning) {
      BleManager.disconnect(peripheral.id)
      .then(() => {
        setConnected(false);      
      })
      .catch((error) => {
        // Failure code
        console.log(error);
      });
    }
  }

  // const retrieveConnected = () => {
  //   BleManager.getConnectedPeripherals([]).then((results) => {
  //     if (results.length == 0) {
  //       console.log('No connected peripherals')
  //     }
  //     console.log(results);
  //     for (var i = 0; i < results.length; i++) {
  //       var peripheral = results[i];
  //       peripheral.connected = true;
  //       peripherals.set(peripheral.id, peripheral);
  //       setList(Array.from(peripherals.values()));
  //     }
  //   });
  // }





  const testPeripheral = (peripheral) => {
    if (peripheral){
      if (peripheral.connected){
        BleManager.disconnect(peripheral.id);
      }else{
        BleManager.connect(peripheral.id).then(() => {
          let p = peripherals.get(peripheral.id);
          if (p) {
            p.connected = true;
            peripherals.set(peripheral.id, p);
            setList(Array.from(peripherals.values()));
          }
          console.log('Connected to ' + peripheral.id);


          setTimeout(() => {

            /* Test read current RSSI value */
            BleManager.retrieveServices(peripheral.id).then((peripheralData) => {
              console.log('Retrieved peripheral services', peripheralData);

              BleManager.readRSSI(peripheral.id).then((rssi) => {
                console.log('Retrieved actual RSSI value', rssi);
                let p = peripherals.get(peripheral.id);
                if (p) {
                  p.rssi = rssi;
                  peripherals.set(peripheral.id, p);
                  setList(Array.from(peripherals.values()));
                }                
              });                                          
            });          
          }, 900);
        }).catch((error) => {
          console.log('Connection error', error);
        });
      }
    }

  }

  useEffect(() => {
    BleManager.start({showAlert: false});

    bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral);
    bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan );
    bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', handleDisconnectedPeripheral );
    bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', handleUpdateValueForCharacteristic );
    
    return (() => {
      console.log('unmount');
      bleManagerEmitter.removeListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral);
      bleManagerEmitter.removeListener('BleManagerStopScan', handleStopScan );
      bleManagerEmitter.removeListener('BleManagerDisconnectPeripheral', handleDisconnectedPeripheral );
      bleManagerEmitter.removeListener('BleManagerDidUpdateValueForCharacteristic', handleUpdateValueForCharacteristic );
    })
  }, []);

  // useEffect( async () => {
  //   try {
  //     const isBleModuleLoaded = await BleManager.start({ showAlert: false });
  //     console.log("BLE Module initialized");
  //   } catch (error) {
  //     console.log("Failed to initialized BLE module : " + error);
  //   }
  // });


  // const connectToCharger = async () => {
  //   if (!isScanning) {
  //     BleManager.scan([], 5, true).then((results) => {
  //       console.log('Scanning...');
  //       setIsScanning(true);
  //       console.log(results);
  //     }).catch(err => {
  //       console.error(err);
  //     });
  //   }    
    
  // };

  // const disconnect = async () => {
  //   if(charger) {
      

  //     try {
  //       const isDisconnected = await ble.cancelDeviceConnection(charger.id);
  //       setConnected(false);
  //       setCharger(null);
  //       console.log('Disconnected.');
  //     } catch (err){
  //       console.log(err);
  //       console.log('ERROR DISCONNECTIONG');
  //     }
  //   } 
  // };

  return (
    <Container>
        { connected 
        ? <StatusText>Connected to charger!</StatusText>
          : isScanning
            ? <StatusText>Scanning...</StatusText>
            : <StatusText>Not connected to charger.</StatusText>
        }
      <ButtonContainer>
        <Button
            title="Connect to Charger"
            color="#6568f4"
            onPress={startScan}
        />
      </ButtonContainer>
      <StatusText>{'Arduino Data : ' + data}</StatusText>
      
      <ButtonContainer>
        <Button
            title="Read Data"
            color="#6568f4"
            onPress={readData}
        />
      </ButtonContainer>
       
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
  margin-vertical: 40px;
  width: 100%;
  height: 100px;
  padding: 12px;
  border-radius: 10px;
  text-align:center;
`;




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
