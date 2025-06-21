// Google Apps Script to receive data from ESP32 and log it to Google Sheets
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // Replace with your actual Google Sheet ID
const MAIN_DATA_SHEET = 'Sheet1';
const ARCHIVE_SHEET_NAME = 'Sheet3'; // Data older than rowLimit in Sheet1 will be moved here
const ROW_LIMIT = 2000; // Max rows in Sheet1 before archiving

/**
 * This function runs automatically when the spreadsheet is opened
 * It sets up the dashboard menu and activates the alert system
 */
function onOpen() {
  // Add the dashboard menu to the UI
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Smart Hydroponic Dashboard')
    .addItem('Open Dashboard Sidebar', 'showDashboardSidebar')
    .addItem('Open Dashboard in Dialog', 'showDashboardDialog')
    .addToUi();
  
  // Set up alert system if not already set up
  setupAlertSystemIfNeeded();
}

/**
 * Sets up the alert system trigger if it doesn't already exist
 */
function setupAlertSystemIfNeeded() {
  // Check if the alert trigger already exists
  const triggers = ScriptApp.getProjectTriggers();
  let alertTriggerExists = false;
  
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkLastUpdateAndNotify') {
      alertTriggerExists = true;
      break;
    }
  }
  
  // If no trigger exists, create one
  if (!alertTriggerExists) {
    ScriptApp.newTrigger('checkLastUpdateAndNotify')
      .timeBased()
      .everyMinutes(15)
      .create();
    console.log("Alert system trigger set up to run every 15 minutes");
  }
}

// Column headers - ensure these match the order in your ESP32 data and saveData function
const HEADERS = [
  "LoggedAt", "ESP_Timestamp", "Temperature", "Humidity", "Nitrogen", 
  "Phosphorus", "Potassium", "WaterLevel", "TDS", "pH", "EC"
];

function doGet(e) {
  if (e && e.parameter) {
    if (e.parameter.action === 'getChartData') {
      return getSheetDataForCharts();
    } else if (e.parameter.timestamp) { // Assuming 'timestamp' is a key parameter for saving data
      return saveData(e.parameter);
    }
  }
  
  // If no specific action or parameters for saving, return a simple API message
  return ContentService.createTextOutput('Smart Hydroponic System Google Sheets API')
    .setMimeType(ContentService.MimeType.TEXT);
}

function saveData(params) {
  try {
    Logger.log("Received parameters: " + JSON.stringify(params));
    
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(MAIN_DATA_SHEET);

    // Create Sheet1 if it doesn't exist and add headers
    if (!sheet) {
      sheet = spreadsheet.insertSheet(MAIN_DATA_SHEET, 0); // Insert as the first sheet
      sheet.appendRow(HEADERS);
      Logger.log(MAIN_DATA_SHEET + ' created with headers.');
    }

    // Ensure headers are present if sheet exists but is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    // Normalize parameter names (handle potential case differences)
   // const timestamp = params.timestamp || params.Timestamp || params.TIMESTAMP || null;
    const temperature = params.temperature || params.Temperature || params.TEMPERATURE || null;
    const humidity = params.humidity || params.Humidity || params.HUMIDITY || null;
    const nitrogen = params.nitrogen || params.Nitrogen || params.NITROGEN || null;
    const phosphorus = params.phosphorus || params.Phosphorus || params.PHOSPHORUS || null;
    const potassium = params.potassium || params.Potassium || params.POTASSIUM || null;
    const waterLevel = params.waterLevel || params.WaterLevel || params.WATERLEVEL || params.waterlevel || null;
    const tds = params.tds || params.Tds || params.TDS || null;
    const ph = params.ph || params.pH || params.PH || null;
    const ec = params.ec || params.Ec || params.EC || null;
    
    // Get current server time - this will be our source of truth
    const currentDate = new Date();
    
    // Convert the date to milliseconds using the exact formula from the sheet
    // =ARRAYFORMULA(IF(A2:A="", "", INT((A2:A - DATE(1970,1,1)) * 86400000)))
    const EPOCH = new Date(1970, 0, 1);
    const milliseconds = Math.floor((currentDate - EPOCH) / 1);
    
    // Log the conversion for debugging
    Logger.log(`Date: ${currentDate.toISOString()}, Milliseconds: ${milliseconds}`);
    
    // Create the new row with data
    const newRow = [
      currentDate, // LoggedAt (server timestamp as Date object)
      milliseconds, // ESP_Timestamp (as milliseconds since epoch)
      temperature,
      humidity,
      nitrogen,
      phosphorus,
      potassium,
      waterLevel,
      tds,
      ph,
      ec
    ];
    
    // Log the data being added for debugging
    Logger.log("Adding row: " + JSON.stringify(newRow));
    
    // Add the data to the sheet
    sheet.appendRow(newRow);
    Logger.log('Data successfully appended to ' + MAIN_DATA_SHEET);

    // Check if Sheet1 exceeds the row limit
    if (sheet.getLastRow() > ROW_LIMIT + 1) { // +1 for the header row
      let archiveSheet = spreadsheet.getSheetByName(ARCHIVE_SHEET_NAME);
      if (!archiveSheet) {
        archiveSheet = spreadsheet.insertSheet(ARCHIVE_SHEET_NAME);
        archiveSheet.appendRow(HEADERS); // Add headers to archive sheet
        Logger.log(ARCHIVE_SHEET_NAME + ' created with headers.');
      }
      // Ensure headers are present if archive sheet exists but is empty
      if (archiveSheet.getLastRow() === 0) {
          archiveSheet.appendRow(HEADERS);
      }

      const rowsToMoveCount = sheet.getLastRow() - (ROW_LIMIT + 1);
      if (rowsToMoveCount > 0) {
        // Get data from row 2 (after header) up to rowsToMoveCount
        const dataToMove = sheet.getRange(2, 1, rowsToMoveCount, sheet.getLastColumn()).getValues();
        
        // Append data to the archive sheet
        archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, dataToMove.length, dataToMove[0].length).setValues(dataToMove);
        Logger.log(rowsToMoveCount + ' rows moved to ' + ARCHIVE_SHEET_NAME);
        
        // Delete the moved rows from Sheet1 (from row 2, up to rowsToMoveCount)
        sheet.deleteRows(2, rowsToMoveCount);
        Logger.log(rowsToMoveCount + ' rows deleted from ' + MAIN_DATA_SHEET);
      }
    }

    return ContentService.createTextOutput('Data logged successfully to Google Sheets.')
      .setMimeType(ContentService.MimeType.TEXT);
      
  } catch (error) {
    // Log the error for debugging
    Logger.log('Error saving data: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    
    // Return error message
    return ContentService.createTextOutput('Error saving data: ' + error.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function getSheetDataForCharts() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const allChartData = [];

    // Function to process data from a single sheet
    const processSheet = (sheetName) => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() <= 1) { // <=1 means no data or only header
        Logger.log('No data in ' + sheetName + ' or sheet does not exist.');
        return;
      }
      
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()); // Skip header
      const values = dataRange.getValues();
      
      values.forEach(row => {
        // Assuming ESP_Timestamp is the primary timestamp for charting
        // and it's in a format that can be parsed by new Date() or is already a number (milliseconds)
        let timestamp = row[HEADERS.indexOf("ESP_Timestamp")]; 
        if (timestamp instanceof Date) {
          timestamp = timestamp.getTime();
        } else if (typeof timestamp === 'string' && !isNaN(Number(timestamp))) {
          timestamp = Number(timestamp); // If it's a string representation of a number
        } else if (typeof timestamp === 'string') {
          // Try parsing if it's a date string; might need adjustment based on actual format
          const parsedDate = new Date(timestamp);
          if (!isNaN(parsedDate)) {
            timestamp = parsedDate.getTime();
          } else {
            // Fallback or log error if timestamp is not parsable
            Logger.log('Could not parse timestamp: ' + timestamp + ' in sheet ' + sheetName);
            return; // Skip this row if timestamp is unusable
          }
        } else if (typeof timestamp !== 'number') {
            Logger.log('Invalid timestamp format: ' + timestamp + ' in sheet ' + sheetName);
            return; // Skip this row
        }


        allChartData.push({
          timestamp: timestamp,
          temperature: parseFloat(row[HEADERS.indexOf("Temperature")]),
          humidity: parseFloat(row[HEADERS.indexOf("Humidity")]),
          nitrogen: parseFloat(row[HEADERS.indexOf("Nitrogen")]),
          phosphorus: parseFloat(row[HEADERS.indexOf("Phosphorus")]),
          potassium: parseFloat(row[HEADERS.indexOf("Potassium")]),
          waterLevel: parseFloat(row[HEADERS.indexOf("WaterLevel")]),
          tds: parseFloat(row[HEADERS.indexOf("TDS")]),
          ph: parseFloat(row[HEADERS.indexOf("pH")]),
          ec: parseFloat(row[HEADERS.indexOf("EC")])
        });
      });
      Logger.log('Processed ' + values.length + ' rows from ' + sheetName);
    };

    // Process data from Sheet1 (MAIN_DATA_SHEET)
    processSheet(MAIN_DATA_SHEET);
    
    // Process data from Sheet3 (ARCHIVE_SHEET_NAME)
    processSheet(ARCHIVE_SHEET_NAME);

    // Sort data by timestamp ascending, just in case it's not perfectly ordered
    allChartData.sort((a, b) => a.timestamp - b.timestamp);
    
    Logger.log('Total chart data points: ' + allChartData.length);
    return ContentService.createTextOutput(JSON.stringify(allChartData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in getSheetDataForCharts: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// This function can be used to get the web app URL for testing or ESP32 configuration
function getUrl() {
  return ScriptApp.getService().getUrl();
}

// Utility function to ensure sheets and headers exist (run manually if needed)
function setupSheets() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  
  let sheet1 = spreadsheet.getSheetByName(MAIN_DATA_SHEET);
  if (!sheet1) {
    sheet1 = spreadsheet.insertSheet(MAIN_DATA_SHEET, 0);
    sheet1.appendRow(HEADERS);
    Logger.log(MAIN_DATA_SHEET + ' created.');
  } else if (sheet1.getLastRow() === 0) {
    sheet1.appendRow(HEADERS);
    Logger.log('Headers added to empty ' + MAIN_DATA_SHEET);
  }

  let sheet3 = spreadsheet.getSheetByName(ARCHIVE_SHEET_NAME);
  if (!sheet3) {
    sheet3 = spreadsheet.insertSheet(ARCHIVE_SHEET_NAME);
    sheet3.appendRow(HEADERS);
    Logger.log(ARCHIVE_SHEET_NAME + ' created.');
  } else if (sheet3.getLastRow() === 0) {
    sheet3.appendRow(HEADERS);
    Logger.log('Headers added to empty ' + ARCHIVE_SHEET_NAME);
  }
  Logger.log('Sheet setup check complete.');
  
  return 'Sheets setup complete.';
}

//------ ALERT SYSTEM FUNCTIONS ------//

/**
 * Checks when the last data update occurred and sends notifications if it's been too long
 */
function checkLastUpdateAndNotify() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(MAIN_DATA_SHEET);
    
    // Get the timestamp from the last row
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      console.log("No data found in the sheet (only headers)");
      return; // Only headers
    }
    
    // Get timestamp from column A (first column)
    // Assuming first column contains timestamp
    const timestampCell = sheet.getRange(lastRow, 1);
    const lastTimestamp = new Date(timestampCell.getValue());
    const currentTime = new Date();
    
    // Calculate difference in minutes
    const diffMinutes = (currentTime - lastTimestamp) / (1000 * 60);
    
    console.log(`Last update was ${Math.round(diffMinutes)} minutes ago`);
    
    // If more than 30 minutes, send notifications
    if (diffMinutes > 30) {
      // Send email
      sendEmailAlert(diffMinutes);
      
      // Log the alert
      console.log(`Alert sent: No data updates for ${Math.round(diffMinutes)} minutes`);
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    // Send error notification
    sendErrorAlert(error);
  }
}

/**
 * Sends an email alert when data hasn't been updated
 */
function sendEmailAlert(minutesSinceUpdate) {
  // Recipients - add or modify email addresses as needed
  const recipients = ["fahim2021@namal.edu.pk", "riaz2021@namal.edu.pk"];
  const subject = " ALERT: ESP32 Data Not Updated";
  
  // Create a detailed message body
  const body = `Your Smart Hydroponic System has not updated data for ${Math.round(minutesSinceUpdate)} minutes.

Last update: ${new Date(new Date().getTime() - minutesSinceUpdate * 60000).toLocaleString()}
Current time: ${new Date().toLocaleString()}

Please check your system for possible issues:
- ESP32 power or connectivity problems
- WiFi network issues
- Sensor failures
- Firebase connection problems

This is an automated alert from your Smart Hydroponic monitoring system.`;
  
  // Send email to all recipients
  try {
    GmailApp.sendEmail(recipients.join(","), subject, body);
    console.log("Email alert sent successfully to", recipients.join(", "));
  } catch (error) {
    console.error("Error sending email alert:", error);
  }
}

/**
 * Sends an alert about errors in the monitoring system itself
 */
function sendErrorAlert(error) {
  // Only send to the main administrator
  const adminEmail = "fahim2021@namal.edu.pk";
  const subject = "Smart Hydroponic Monitoring System Error";
  const body = `There was an error in the monitoring system itself:

${error.toString()}

Please check the Google Apps Script logs for more details.`;
  
  try {
    GmailApp.sendEmail(adminEmail, subject, body);
  } catch (e) {
    console.error("Failed to send error notification:", e);
  }
}

/**
 * Disables the automated checks
 */
function disableAlertTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkLastUpdateAndNotify') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  
  console.log(`${removed} alert triggers disabled`);
  return `Alert system deactivated. Removed ${removed} triggers.`;
}

/**
 * Manual test function - run this to test email alerts
 */
function testEmailAlert() {
  sendEmailAlert(35); // Test with 35 minutes of inactivity
  return "Test email alert sent. Check your inbox.";
}