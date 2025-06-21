// Google Apps Script to receive data from ESP32 and log it to Google Sheets
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // Replace with your actual Google Sheet ID
const MAIN_DATA_SHEET = 'Sheet1';
const ARCHIVE_SHEET_NAME = 'Sheet3'; // Data older than rowLimit in Sheet1 will be moved here
const ROW_LIMIT = 2000; // Max rows in Sheet1 before archiving

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

  const newRow = [
    new Date(), // LoggedAt (server timestamp)
    params.timestamp || null,
    params.temperature || null,
    params.humidity || null,
    params.nitrogen || null,
    params.phosphorus || null,
    params.potassium || null,
    params.waterLevel || null,
    params.tds || null,
    params.ph || null,
    params.ec || null
  ];
  sheet.appendRow(newRow);
  Logger.log('Data appended to ' + MAIN_DATA_SHEET);

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
}