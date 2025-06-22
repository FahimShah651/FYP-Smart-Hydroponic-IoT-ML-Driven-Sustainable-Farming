#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <NewPing.h>
#include <Wire.h>
#include <SoftwareSerial.h>

// Forward declarations
void getAuthToken();
void checkControlCommands();
void runAutoControl();
void uploadDataToFirebase();
void initRelays();
void controlMotor(int relayIndex, bool turnOn);
void updateRelayStates();
void checkWiFiConnection();
void readSensors();
void readwaterSensor();
void uploadDataToGoogleSheets();

// Relay module pins
#define RELAY_COUNT 8
const int relayPins[RELAY_COUNT] = {0, 35, 36, 37, 38, 39, 40, 41};
// Relays are active LOW

// Motor definitions
#define NUTRIENT_CIRCULATION_RELAY 0  // Always ON
#define NUTRIENT_ADDING_RELAY      1
#define NUTRIENT_MIXING_RELAY      2
#define PH_UP_RELAY                3
#define PH_DOWN_RELAY              4
#define WATER_LEVEL_RELAY          5

// Sensor Pins
#define DHTPIN 4
#define TDSPIN 15
#define TRIGGER_PIN 47
#define ECHO_PIN 48
#define MAX_DISTANCE 200  // cm

// Tank calibration distances
#define EMPTY_LEVEL 40    // Distance when tank is empty (cm)
#define FULL_LEVEL 5      // Distance when tank is full (cm)

// UART Configuration for 7-in-1 water sensor
#define RE_PIN 7  
#define DE_PIN 6  
#define water_SENSOR_RX 18
#define water_SENSOR_TX 17
#define water_SENSOR_BAUD 4800

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase configuration
const char* FIREBASE_HOST = "YOUR_FIREBASE_HOST";
const char* FIREBASE_API_KEY = "YOUR_API_KEY";

// Firebase authentication
const char* FIREBASE_EMAIL = "YOUR_EMAIL";
const char* FIREBASE_PASSWORD = "YOUR_PASSWORD";

// Google Sheets Apps Script URL
const char* scriptUrl = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";


// Initialize sensors
DHT dht(DHTPIN, DHT11);
NewPing sonar(TRIGGER_PIN, ECHO_PIN, MAX_DISTANCE);

// RS485 Configuration for water sensor
SoftwareSerial waterSensorSerial(water_SENSOR_RX, water_SENSOR_TX);

// Authentication token
String authToken = "";

// Global variables for sensor data
float temperature = 0;
float humidity = 0;
float tdsValue = 0;
float phValue = 0;
float ecValue = 0;
int waterLevelPercent = 0;
float waterHumidity = 0;
float waterTemperature = 0;
int waterConductivity = 0;
float waterPH = 0;
int nitrogen = 0;
int phosphorus = 0;
int potassium = 0;

// Control variables
String systemMode = "auto"; // "auto" or "manual"

// Target values for auto mode
float targetTDS = 800;
float targetEC = 1500;
float targetPH = 6.5;
int targetWaterLevel = 80;

// Get Firebase authentication token
void getAuthToken() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot authenticate with Firebase - WiFi not connected");
    return;
  }
  
  HTTPClient http;
  
  // Create the authentication request URL
  String authUrl = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + String(FIREBASE_API_KEY);
  
  // Create the JSON payload for authentication
  StaticJsonDocument<200> authDoc;
  authDoc["email"] = FIREBASE_EMAIL;
  authDoc["password"] = FIREBASE_PASSWORD;
  authDoc["returnSecureToken"] = true;
  
  String authPayload;
  serializeJson(authDoc, authPayload);
  
  // Make the authentication request
  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.POST(authPayload);
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    
    // Parse the response to get the ID token
    StaticJsonDocument<1024> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error) {
      authToken = responseDoc["idToken"].as<String>();
      Serial.println("Authentication successful!");
    } else {
      Serial.println("Failed to parse authentication response");
    }
  } else {
    Serial.print("Authentication failed with error code: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// Check for control commands from Firebase
void checkControlCommands() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot check control commands - WiFi not connected");
    return;
  }
  
  // Check if we have a valid authentication token
  if (authToken.length() == 0) {
    Serial.println("No authentication token available. Trying to authenticate...");
    getAuthToken();
    
    if (authToken.length() == 0) {
      Serial.println("Authentication failed. Cannot check control commands.");
      return;
    }
  }
  
  HTTPClient http;
  
  // Construct URL for control data
  String url = "https://" + String(FIREBASE_HOST) + "/control.json?auth=" + authToken;
  
  // Begin HTTP GET request
  http.begin(url);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    
    // Parse the response
    StaticJsonDocument<1024> controlDoc;
    DeserializationError error = deserializeJson(controlDoc, response);
    
    if (!error) {
      // Check system mode (auto/manual)
      if (controlDoc.containsKey("mode")) {
        String newMode = controlDoc["mode"].as<String>();
        if (newMode != systemMode) {
          systemMode = newMode;
          Serial.print("System mode changed to: ");
          Serial.println(systemMode);
        }
      }
      
      // Check target values for auto mode
      if (controlDoc.containsKey("targets")) {
        JsonObject targets = controlDoc["targets"];
        if (targets.containsKey("tds")) targetTDS = targets["tds"].as<float>();
        if (targets.containsKey("ec")) targetEC = targets["ec"].as<float>();
        if (targets.containsKey("ph")) targetPH = targets["ph"].as<float>();
        if (targets.containsKey("waterLevel")) targetWaterLevel = targets["waterLevel"].as<int>();
      }
      
      // Check relay controls for admin dashboard
      // Allow admin to control motors regardless of mode
      if (controlDoc.containsKey("relays")) {
        JsonObject relays = controlDoc["relays"];
        
        // Check each motor control
        if (relays.containsKey("nutrient_add")) {
          String state = relays["nutrient_add"].as<String>();
          controlMotor(NUTRIENT_ADDING_RELAY, state == "on");
          Serial.print("Nutrient Add Motor: ");
          Serial.println(state);
        }
        
        if (relays.containsKey("nutrient_mix")) {
          String state = relays["nutrient_mix"].as<String>();
          controlMotor(NUTRIENT_MIXING_RELAY, state == "on");
          Serial.print("Nutrient Mix Motor: ");
          Serial.println(state);
        }
        
        if (relays.containsKey("ph_up")) {
          String state = relays["ph_up"].as<String>();
          controlMotor(PH_UP_RELAY, state == "on");
          Serial.print("pH Up Motor: ");
          Serial.println(state);
        }
        
        if (relays.containsKey("ph_down")) {
          String state = relays["ph_down"].as<String>();
          controlMotor(PH_DOWN_RELAY, state == "on");
          Serial.print("pH Down Motor: ");
          Serial.println(state);
        }
        
        if (relays.containsKey("water_level")) {
          String state = relays["water_level"].as<String>();
          controlMotor(WATER_LEVEL_RELAY, state == "on");
          Serial.print("Water Level Motor: ");
          Serial.println(state);
        }
        
        // Update the relay states in Firebase
        updateRelayStates();
      }
    } else {
      Serial.println("Failed to parse control data");
    }
  } else {
    Serial.print("Error getting control data. Error code: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// Run automatic control logic
void runAutoControl() {
  if (systemMode != "auto") return;
  
  // Turn off all control motors first (except circulation)
  for (int i = 1; i < RELAY_COUNT; i++) {
    digitalWrite(relayPins[i], HIGH); // HIGH turns relay OFF
  }
  
  // 1. Water Level Control
  if (waterLevelPercent < targetWaterLevel) {
    Serial.println("Auto: Water level below target, turning ON water level motor");
    controlMotor(WATER_LEVEL_RELAY, true);
    delay(2000); // Run for 2 seconds
    controlMotor(WATER_LEVEL_RELAY, false);
  }
  
  // 2. EC/TDS Control
  if (tdsValue < targetTDS || ecValue < targetEC) {
    Serial.println("Auto: TDS/EC below target, adding nutrients");
    // Turn on nutrient adding motor
    controlMotor(NUTRIENT_ADDING_RELAY, true);
    delay(2000); // Run for 2 seconds
    controlMotor(NUTRIENT_ADDING_RELAY, false);
    
    // Mix the nutrients
    Serial.println("Auto: Mixing nutrients");
    controlMotor(NUTRIENT_MIXING_RELAY, true);
    delay(10000); // Run for 10 seconds
    controlMotor(NUTRIENT_MIXING_RELAY, false);
  }
  
  // 3. pH Control
  if (phValue < targetPH - 0.2) { // pH too low
    Serial.println("Auto: pH too low, adding pH up solution");
    controlMotor(PH_UP_RELAY, true);
    delay(2000); // Run for 2 seconds
    controlMotor(PH_UP_RELAY, false);
    
    // Mix the solution
    Serial.println("Auto: Mixing after pH adjustment");
    controlMotor(NUTRIENT_MIXING_RELAY, true);
    delay(10000); // Run for 10 seconds
    controlMotor(NUTRIENT_MIXING_RELAY, false);
  } else if (phValue > targetPH + 0.2) { // pH too high
    Serial.println("Auto: pH too high, adding pH down solution");
    controlMotor(PH_DOWN_RELAY, true);
    delay(2000); // Run for 2 seconds
    controlMotor(PH_DOWN_RELAY, false);
    
    // Mix the solution
    Serial.println("Auto: Mixing after pH adjustment");
    controlMotor(NUTRIENT_MIXING_RELAY, true);
    delay(10000); // Run for 10 seconds
    controlMotor(NUTRIENT_MIXING_RELAY, false);
  }
}

void uploadDataToFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot upload to Firebase - WiFi not connected");
    return;
  }
  
  // Check if we have a valid authentication token
  if (authToken.length() == 0) {
    Serial.println("No authentication token available. Trying to authenticate...");
    getAuthToken();
    
    if (authToken.length() == 0) {
      Serial.println("Authentication failed. Cannot upload data.");
      return;
    }
  }
  
  // Create JSON document
  StaticJsonDocument<512> doc;
  
  // Add timestamp and sensor values
  unsigned long timestamp = millis();
  doc["timestamp"] = timestamp;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["tds"] = tdsValue;
  doc["ph"] = phValue;
  doc["ec"] = ecValue;
  doc["waterLevel"] = waterLevelPercent;
  doc["waterHumidity"] = waterHumidity;
  doc["waterTemperature"] = waterTemperature;
  doc["waterConductivity"] = waterConductivity;
  doc["waterPH"] = waterPH;
  doc["nitrogen"] = nitrogen;
  doc["phosphorus"] = phosphorus;
  doc["potassium"] = potassium;
  
  // Serialize JSON to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Data to upload to Firebase:");
  Serial.println(jsonString);
  
  // First, update latest_readings
  Serial.println("Updating latest_readings...");
  
  // Create HTTP client
  HTTPClient http;
  
  // Construct URL for latest_readings with authentication token
  String url = "https://" + String(FIREBASE_HOST) + "/latest_readings.json?auth=" + authToken;
  
  // Begin HTTP PUT request
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  // Send the request
  int httpResponseCode = http.PUT(jsonString);
  
  // Check response
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    Serial.println("SUCCESS: Latest readings updated");
  } else {
    Serial.print("Error on HTTP request. Error code: ");
    Serial.println(httpResponseCode);
    Serial.println("FAILED: Could not update latest readings");
  }
  
  // End the HTTP connection
  http.end();
  
  // Then add to sensor_data with a timestamp key
  String dataPath = "sensor_data/" + String(timestamp);
  Serial.print("Adding to sensor_data at path: ");
  Serial.println(dataPath);
  
  // Construct URL for sensor_data with authentication token
  url = "https://" + String(FIREBASE_HOST) + "/" + dataPath + ".json?auth=" + authToken;
  
  // Begin HTTP PUT request
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  // Send the request
  httpResponseCode = http.PUT(jsonString);
  
  // Check response
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    Serial.println("SUCCESS: Historical data added");
  } else {
    Serial.print("Error on HTTP request. Error code: ");
    Serial.println(httpResponseCode);
    Serial.println("FAILED: Could not add historical data");
  }
  
  // End the HTTP connection
  http.end();
}

// Initialize relays
void initRelays() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH); // Relays are active LOW, so HIGH turns them OFF
  }
  
  // Turn ON the nutrient circulation motor (always ON)
  digitalWrite(relayPins[NUTRIENT_CIRCULATION_RELAY], LOW);
  
  Serial.println("Relays initialized");
}

// Control a specific motor
void controlMotor(int relayIndex, bool turnOn) {
  if (relayIndex >= 0 && relayIndex < RELAY_COUNT) {
    // Skip the nutrient circulation motor (always ON)
    if (relayIndex == NUTRIENT_CIRCULATION_RELAY) {
      Serial.println("Cannot control nutrient circulation motor - always ON");
      return;
    }
    
    digitalWrite(relayPins[relayIndex], turnOn ? LOW : HIGH); // LOW turns relay ON, HIGH turns relay OFF
    Serial.print("Motor on relay ");
    Serial.print(relayIndex);
    Serial.println(turnOn ? " turned ON" : " turned OFF");
  }
}

// Update relay states in Firebase
void updateRelayStates() {
  if (WiFi.status() != WL_CONNECTED || authToken.length() == 0) {
    Serial.println("Cannot update relay states - WiFi not connected or no auth token");
    return;
  }
  
  HTTPClient http;
  
  // Create JSON document for relay states
  StaticJsonDocument<512> doc;
  JsonObject relays = doc.createNestedObject("relays");
  
  // Get current state of each relay (inverted because relays are active LOW)
  relays["nutrient_add"] = digitalRead(relayPins[NUTRIENT_ADDING_RELAY]) == LOW ? "on" : "off";
  relays["nutrient_mix"] = digitalRead(relayPins[NUTRIENT_MIXING_RELAY]) == LOW ? "on" : "off";
  relays["ph_up"] = digitalRead(relayPins[PH_UP_RELAY]) == LOW ? "on" : "off";
  relays["ph_down"] = digitalRead(relayPins[PH_DOWN_RELAY]) == LOW ? "on" : "off";
  relays["water_level"] = digitalRead(relayPins[WATER_LEVEL_RELAY]) == LOW ? "on" : "off";
  
  // Serialize JSON to string
  String jsonStr;
  serializeJson(relays, jsonStr);
  
  // Construct URL for control/relays endpoint
  String url = "https://" + String(FIREBASE_HOST) + "/control.json?auth=" + authToken;
  
  // Begin HTTP PATCH request (update only the relays object)
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.PATCH(jsonStr);
  
  if (httpResponseCode == 200) {
    Serial.println("Relay states updated in Firebase");
  } else {
    Serial.print("Error updating relay states. Error code: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// Read all sensors and update global variables
void readSensors() {
  // Read DHT sensor for air temperature and humidity
  humidity = dht.readHumidity();
  temperature = dht.readTemperature();
  
  // Read TDS sensor
  int tdsRaw = analogRead(TDSPIN);
  float tdsVoltage = tdsRaw * 3.3 / 4095.0;
  tdsValue = (133.42 * pow(tdsVoltage, 3) - 255.86 * pow(tdsVoltage, 2) + 857.39 * tdsVoltage) * 0.5;
  
  // Read ultrasonic sensor for water level
  unsigned long duration = sonar.ping();
  float distance = sonar.convert_cm(duration);
  waterLevelPercent = map(distance, EMPTY_LEVEL, FULL_LEVEL, 0, 100);
  // Constrain water level to 0-100%
  waterLevelPercent = constrain(waterLevelPercent, 0, 100);
  
  // Read 7-in-1 water sensor
  readwaterSensor();
  
  // Update water parameters from water sensor
  waterHumidity = waterHumidity;
  waterTemperature = waterTemperature;
  waterConductivity = waterConductivity;
  waterPH = waterPH;
  
  // Update EC value
    ecValue = waterConductivity / 1000.0;  // Convert μS/cm to mS/cm
    
    // Update pH value
    phValue = waterPH;
}

// Read data from the 7-in-1 water sensor
void readwaterSensor() {
  byte queryData[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x07, 0x04, 0x08};
  byte receivedData[19];
  
  // Set RS485 to transmit mode
  digitalWrite(DE_PIN, HIGH);
  digitalWrite(RE_PIN, HIGH);
  delay(10); //  10ms delay
  
  // Send query data
  waterSensorSerial.write(queryData, sizeof(queryData));
  waterSensorSerial.flush();
  
  // Set RS485 to receive mode
  digitalWrite(DE_PIN, LOW);
  digitalWrite(RE_PIN, LOW);
  
  delay(500); // 500ms delay
  if (waterSensorSerial.available() >= sizeof(receivedData)) {
    waterSensorSerial.readBytes(receivedData, sizeof(receivedData));
    
    // Parse data
    unsigned int rawHumidity = (receivedData[3] << 8) | receivedData[4];
    unsigned int rawTemperature = (receivedData[5] << 8) | receivedData[6];
    unsigned int rawConductivity = (receivedData[7] << 8) | receivedData[8];
    unsigned int rawPH = (receivedData[9] << 8) | receivedData[10];
    unsigned int rawNitrogen = (receivedData[11] << 8) | receivedData[12];
    unsigned int rawPhosphorus = (receivedData[13] << 8) | receivedData[14];
    unsigned int rawPotassium = (receivedData[15] << 8) | receivedData[16];
    
    // Convert raw values
    waterHumidity = (float)rawHumidity / 10.0;
    waterTemperature = (float)rawTemperature / 10.0;
    waterConductivity = rawConductivity;
    waterPH = (float)rawPH / 10.0;
    nitrogen = rawNitrogen;
    phosphorus = rawPhosphorus;
    potassium = rawPotassium;
  } else {
    Serial.println("No data received or incomplete data from water sensor");
  }
}

// Upload data to Google Sheets
void uploadDataToGoogleSheets() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot upload to Google Sheets - WiFi not connected");
    return;
  }
  HTTPClient http;
  
  String url = String(scriptUrl) + "?timestamp=" + String(millis()) +
               "&temperature=" + String(temperature) +
               "&humidity=" + String(humidity) +
               "&waterHumidity=" + String(waterHumidity) +
               "&waterTemperature=" + String(waterTemperature) +
               "&waterConductivity=" + String(waterConductivity) +
               "&waterPH=" + String(waterPH) +
               "&nitrogen=" + String(nitrogen) +
               "&phosphorus=" + String(phosphorus) +
               "&potassium=" + String(potassium) +
               "&waterLevel=" + String(waterLevelPercent) +
               "&tds=" + String(tdsValue) +
               "&ph=" + String(phValue) +
               "&ec=" + String(ecValue);
  
  
  http.begin(url);
  // Set timeout to a longer value (5 seconds)
  http.setTimeout(5000);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    Serial.println("Response: " + response);
    
    // Check if the response indicates success
    if (response.indexOf("successfully") >= 0) {
      Serial.println("Data successfully logged to Google Sheets!");
    } else {
      Serial.println("Warning: Unexpected response from Google Sheets");
    }
  } else {
    Serial.println("Error sending data to Google Sheets. Error code: " + String(httpResponseCode));
  }
  
  http.end();
}


// Initialize the ESP32
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\nStarting Smart Hydroponic System with Firebase Integration");
  
  // Initialize sensors
  dht.begin();
  waterSensorSerial.begin(water_SENSOR_BAUD);
  
  // Initialize RS485 control pins
  pinMode(RE_PIN, OUTPUT);
  pinMode(DE_PIN, OUTPUT);
  digitalWrite(RE_PIN, LOW);
  digitalWrite(DE_PIN, LOW);
  
  // Initialize TDS sensor
  pinMode(TDSPIN, INPUT);
  
  // Initialize ultrasonic sensor
  pinMode(TRIGGER_PIN, OUTPUT);
  
  // Initialize relays
  initRelays();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  // Wait for connection with timeout
  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 20000) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected to WiFi! IP address: ");
    Serial.println(WiFi.localIP());
    
    // Get authentication token
    getAuthToken();
    
    if (authToken.length() > 0) {
      Serial.println("Firebase authentication successful!");
      
      // Initialize relay states in Firebase
      Serial.println("Initializing relay states in Firebase...");
      updateRelayStates();
    } else {
      Serial.println("Firebase authentication failed!");
    }
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi. Will keep trying in the background.");
  }
}

// Function to check WiFi connection and reconnect if needed
void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Attempting to reconnect...");
    WiFi.begin(ssid, password);
    
    // Wait up to 10 seconds for connection
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 10000) {
      delay(500);
      Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi reconnected successfully");
      Serial.print("IP Address: ");
      Serial.println(WiFi.localIP());
      
      // Get a new authentication token after reconnection
      getAuthToken();
    } else {
      Serial.println("\nFailed to reconnect to WiFi");
    }
  }
}

void loop() {
  // Check WiFi connection every loop
  checkWiFiConnection();
  
  // Check for control commands from Firebase every 1 second (reduced from 5 seconds)
  static unsigned long lastControlCheckTime = 0;
  if (millis() - lastControlCheckTime >= 1000) {
    checkControlCommands();
    lastControlCheckTime = millis();
  }
  
  // Update relay states in Firebase every 15 seconds
  static unsigned long lastRelayUpdateTime = 0;
  if (millis() - lastRelayUpdateTime >= 15000) {
    updateRelayStates();
    lastRelayUpdateTime = millis();
  }
  
  // Run auto control logic every 60 seconds
  static unsigned long lastAutoControlTime = 0;
  if (millis() - lastAutoControlTime >= 60000) {
    runAutoControl();
    lastAutoControlTime = millis();
  }
  
  // Read sensors and upload data every 5 seconds
  static unsigned long lastUploadTime = 0;
  if (millis() - lastUploadTime >= 5000) {
    // Read actual sensor data
    readSensors();
    
    if (WiFi.status() == WL_CONNECTED) {
      // Upload data to Firebase
      uploadDataToFirebase();
      
      // Upload data to Google Sheets
      uploadDataToGoogleSheets();
    }
    lastUploadTime = millis();
  }
  
  delay(1); // Reduced from 10ms to 1ms - still prevents watchdog timer issues
}
