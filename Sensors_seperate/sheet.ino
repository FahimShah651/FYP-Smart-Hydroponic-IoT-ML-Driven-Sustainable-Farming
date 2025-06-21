#include <WiFi.h>
#include <HTTPClient.h>

// WiFi credentials - Replace with your network details
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Google Sheets Apps Script URL - Replace with your Google Apps Script web app URL
const char* scriptUrl = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL";

// Global variables for sensor data
float temperature = 0;
float humidity = 0;
float tdsValue = 0;
float phValue = 0;
float ecValue = 0;
int waterLevelPercent = 0;
float soilHumidity = 0;
float soilTemperature = 0;
int soilConductivity = 0;
float soilPH = 0;
int nitrogen = 0;
int phosphorus = 0;
int potassium = 0;

void saveToGoogleSheets(float tds, float ph, float ec) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot upload to Google Sheets - WiFi not connected");
    return;
  }
  
  HTTPClient http;
  
  String url = String(scriptUrl) + "?timestamp=" + String(millis()) +
               "&temperature=" + String(temperature) +
               "&humidity=" + String(humidity) +
               "&soilHumidity=" + String(soilHumidity) +
               "&soilTemperature=" + String(soilTemperature) +
               "&soilConductivity=" + String(soilConductivity) +
               "&soilPH=" + String(soilPH) +
               "&nitrogen=" + String(nitrogen) +
               "&phosphorus=" + String(phosphorus) +
               "&potassium=" + String(potassium) +
               "&waterLevel=" + String(waterLevelPercent) +
               "&tds=" + String(tds) +
               "&ph=" + String(ph) +
               "&ec=" + String(ec);
  
  Serial.println("Uploading data to Google Sheets...");
  Serial.println("URL: " + url);
  
  http.begin(url);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("HTTP Response code: " + String(httpResponseCode));
    Serial.println("Response: " + response);
  } else {
    Serial.println("Error sending data to Google Sheets. Error code: " + String(httpResponseCode));
  }
  
  http.end();
}

void uploadDataToGoogleSheets() {
  saveToGoogleSheets(tdsValue, phValue, ecValue);
}

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  delay(1000); // Give time for serial monitor to open
  
  Serial.println("Smart Hydroponic System Starting");
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected successfully");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed");
  }
}

void loop() {
  // Upload data every 30 seconds
  static unsigned long lastUploadTime = 0;
  if (millis() - lastUploadTime >= 100) {
    // Simulate sensor readings (replace with actual sensor readings)
    temperature = random(200, 350) / 10.0;
    humidity = random(300, 900) / 10.0;
    tdsValue = random(300, 1500);
    phValue = random(40, 90) / 10.0;
    ecValue = random(500, 3000);
    waterLevelPercent = random(0, 101);
    soilHumidity = random(200, 800) / 10.0;
    soilTemperature = random(150, 350) / 10.0;
    soilConductivity = random(200, 2000);
    soilPH = random(40, 90) / 10.0;
    nitrogen = random(10, 100);
    phosphorus = random(10, 100);
    potassium = random(10, 100);
    
    if (WiFi.status() == WL_CONNECTED) {
      uploadDataToGoogleSheets();
    }
    lastUploadTime = millis();
  }
  
  delay(10); // Prevent watchdog timer issues
}