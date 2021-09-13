#include <ArduinoBLE.h>
#include <Base64.h>
#include <FastLED.h>

// LED strip setup
#define LED_PIN     2
#define QI_CHARGER_PIN 13   
#define NUM_LEDS    71
#define BRIGHTNESS  30
#define LED_TYPE    WS2811
#define COLOR_ORDER GRB
DEFINE_GRADIENT_PALETTE( heatmap_gp ) {   // first col specifies where color stops in index
    0,    0,    0,    0,    //black
    16,   255,  0,    0,    //red
    96,   255,  165,  0,    //orange
    128,  255,  255,  0,    //bright yellow
    224,  0,    255,  0,   // bright green
    255,  0,    100,  0     //dark green
}; 
CRGBPalette16 myPal = heatmap_gp;
CRGBArray<NUM_LEDS> leds;

// BLE service and characteristic setup 
const int BUFFER_SIZE = 256;
BLEService batteryService("180F");
BLECharacteristic batteryLevelChar("2A19", BLEWriteWithoutResponse, BUFFER_SIZE, false);                      // BLE characteristic central can write its current battery level to
BLEIntCharacteristic LEDChar("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWriteWithoutResponse);      // BLE characteristic central write and change chgarger's LED patterns

// Globals
bool WAS_CHARGING = false;
int IS_CHARGING = 0;
int CURR_NUM_LEDS = NUM_LEDS;
int CURR_LED_ROUTINE = 0;
int DEFAULT_LED_ROUTINE = 0;
int FADE_INTERVAL = 50;
float CURR_BATTERY_LEVEL = 1;
unsigned long LAST_FADE_TIME = millis();
unsigned long LAST_DATA_RECEIVED = 0;
uint8_t FIRST_BRIGHT_LED = 0;
uint8_t gHue = 0;

void setup() {
    Serial.begin(9600);                                                 // initialize serial communication
    while (!Serial);
    
    pinMode(LED_BUILTIN, OUTPUT);                                       // initialize the built-in LED pin to indicate when a central is connected
    pinMode(QI_CHARGER_PIN, INPUT);                                     // watch digital pin for on/off status of qi charger (0 or 1)

    FastLED.addLeds<NEOPIXEL,2>(leds, NUM_LEDS);                        // init LED strip and clear it
    FastLED.clear(true);
    FastLED.show();

    if (!BLE.begin()) {                                       
        Serial.println("starting BLE failed!");
        while (1);
    }

    if (BLE.connected()) {
        Serial.print("Disconnecting from central... ");
        BLE.disconnect();
    } else {
        Serial.print("no devices connected to arduino ");
    }

    BLE.setLocalName("BatteryMonitor");
    BLE.setAdvertisedService(batteryService);                           // add the service UUID
    batteryService.addCharacteristic(batteryLevelChar);                 // add the battery level characteristic
    batteryService.addCharacteristic(LEDChar); 
    BLE.addService(batteryService);                                     // Add the battery service
    BLE.setEventHandler(BLEConnected, onConnectHandler);
    BLE.setEventHandler(BLEDisconnected, onDisconnectHandler);
    batteryLevelChar.setEventHandler(BLEWritten, onBatteryLevelCharWriteHandler);
    LEDChar.setEventHandler(BLEWritten, onLEDCharWriteHandler);
    
    BLE.advertise(); 
    Serial.println("Bluetooth device active, waiting for connections...");
}  

void loop() {
    BLEDevice central = BLE.central(); 
//    IS_CHARGING = digitalRead(QI_CHARGER_PIN);
//        IS_CHARGING = 1;
//     Serial.println(IS_CHARGING);
     // if connected but charging state changes 
    if(central.connected()){
        while (central.connected()) {
            IS_CHARGING = digitalRead(QI_CHARGER_PIN);
            WAS_CHARGING = true;
            if(LAST_DATA_RECEIVED > 0){                                   // wait for central to send data before beginning
                EVERY_N_MILLISECONDS(35) {
                    displayCurrLEDRoutine();
                }
            }
        }
    } else if(IS_CHARGING) {                                             // charging but not connected through app -> play default LED routine
        WAS_CHARGING = true;
        EVERY_N_MILLISECONDS(35) {
            displayCurrLEDRoutine();
        };
    }
    if (WAS_CHARGING) {                                          // clear leds if phone was taken off charger                 
        resetChargerToInitialState();
    }
}

void onConnectHandler(BLEDevice central) {
    digitalWrite(LED_BUILTIN, HIGH);                                   // turn on the LED to indicate the connection:
    Serial.print("Connected to central: ");
    Serial.println(central.address());
    FastLED.clear(true);
    FastLED.show();      
}

void onDisconnectHandler(BLEDevice central) {
    Serial.print("Disconnected from central: ");
    Serial.println(central.address());
    digitalWrite(LED_BUILTIN, LOW);
    resetChargerToInitialState();
}

void resetChargerToInitialState() {
    FastLED.clear(true);
    FastLED.show();
    CURR_LED_ROUTINE = DEFAULT_LED_ROUTINE;
    CURR_NUM_LEDS = NUM_LEDS; 
    LAST_DATA_RECEIVED = 0;
}

void onBatteryLevelCharWriteHandler(BLEDevice central, BLECharacteristic characteristic) {
    if (batteryLevelChar.value()) {        
        String batteryLevel = readBuffer(batteryLevelChar);
        int prevLevelInt = (int)CURR_BATTERY_LEVEL*100;
        int currLevelInt = batteryLevel.toInt()*100;  
        CURR_BATTERY_LEVEL = batteryLevel.toFloat();
        CURR_NUM_LEDS = floor(CURR_BATTERY_LEVEL * NUM_LEDS);
        LAST_DATA_RECEIVED = millis();
        if(prevLevelInt != currLevelInt){
            FastLED.clear(true);
            FastLED.show();
        }
    }
}

void onLEDCharWriteHandler(BLEDevice central, BLECharacteristic characteristic){
    if (LEDChar.value()) {        
        String LEDRoutine = readBuffer(LEDChar); 
        CURR_LED_ROUTINE = LEDRoutine.toInt();
        LAST_DATA_RECEIVED = millis();
        FastLED.clear(true);
        FastLED.show();
    }
}

String readBuffer(BLECharacteristic ch){
    String bufferData;
    byte tmp[256];
    int dataLength = ch.readValue(tmp, 256);                                                // read data from write buffer into tmp
    for(int i = 0; i < dataLength; i++) {
        bufferData += (char)tmp[i];
    }
    return bufferData;
}

void displayCurrLEDRoutine(){
    switch(CURR_LED_ROUTINE){
        case 0: 
             (LAST_DATA_RECEIVED > 0) ? electricCurrent(true) : electricCurrent(false);    // Show electric current routuine with single color if charging but not connected to ble
            break;        
        case 1:
            electricCurrent(false);
            break;   
        case 2:
            batteryLevelCylon();
            break;
        case 3:
            rainbow();
            break;
        case 4:
            sinelon();
            break; 
        case 5:
            off();
            break;
    }
    gHue++; 
    FastLED.show();  
}

// LED Routines
void electricCurrent (bool isMultiColored){
    uint8_t clusterSize = 4;
    uint8_t nextBrightLED = FIRST_BRIGHT_LED;
    if(millis() >= LAST_FADE_TIME + 150){
        for(uint8_t i = 0; i < CURR_NUM_LEDS; i++){
            uint8_t paletteIndex = isMultiColored ? map(i+1,0,NUM_LEDS-1,0,240) :  map(CURR_NUM_LEDS,0,NUM_LEDS-1,0,240);      // index is based on pixel number
            if(i == nextBrightLED){
                leds[i] = ColorFromPalette( myPal, paletteIndex, BRIGHTNESS+70, LINEARBLEND);
                nextBrightLED += clusterSize + 1;
            } else {
                leds[i] = ColorFromPalette( myPal, paletteIndex, BRIGHTNESS-20 , LINEARBLEND);
            }
        }
        FIRST_BRIGHT_LED = (FIRST_BRIGHT_LED+1)%(clusterSize+1);
        LAST_FADE_TIME = millis();
    }
}

void batteryLevelCylon(){      
   uint8_t pos = beatsin8(13, 0, CURR_NUM_LEDS-1);
   uint8_t paletteIndex = map(pos+1, 0, NUM_LEDS-1, 0, 240);        // index based on pixel number
   leds[pos] += ColorFromPalette( myPal, paletteIndex, BRIGHTNESS,  LINEARBLEND );
   if(millis() >= LAST_FADE_TIME + (30 + CURR_NUM_LEDS)){           // tail will become longer / last longer the more leds there are to light.
      fadeToBlackBy( leds, CURR_NUM_LEDS, 50);
      LAST_FADE_TIME = millis();
   }
}

void rainbow() { 
    fill_rainbow( leds, NUM_LEDS, gHue, 7);
}

void sinelon(){
    fadeToBlackBy( leds, NUM_LEDS, 10);
    int pos = beatsin16(13, 0, NUM_LEDS);
    leds[pos] += CHSV( gHue, 255, 192);
}

void off(){
  FastLED.clear();
}
