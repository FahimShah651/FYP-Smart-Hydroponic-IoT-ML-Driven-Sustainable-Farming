/**
 * Auto Timestamp Converter for Smart Hydroponic System
 * 
 * This script automatically converts timestamps in column A to milliseconds in column B
 * when new data is added to the Google Sheet. It focuses specifically on the last row added.
 * 
 * Works with both Sheet1 and Sheet3 to ensure all new data has correct millisecond timestamps.
 */

// The sheet IDs and names - Replace with your actual Google Sheet ID
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const MAIN_SHEET = 'Sheet1';
const ARCHIVE_SHEET = 'Sheet3';

// Column indices for timestamp data (0-indexed)
const LOGGED_AT_INDEX = 0;  // Column A - LoggedAt (Date object)
const ESP_TIMESTAMP_INDEX = 1;  // Column B - ESP_Timestamp (milliseconds)

/**
 * This function runs automatically when a cell is edited in the sheet
 * It checks if the edit is in the last row and updates the milliseconds column
 */
function onEdit(e) {
  try {
    // Get sheet information
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();
    
    // Only proceed if we're in one of our target sheets
    if (sheetName !== MAIN_SHEET && sheetName !== ARCHIVE_SHEET) {
      return;
    }
    
    // Get the edited range and row
    const range = e.range;
    const row = range.getRow();
    
    // Check if this is the last row in the sheet (latest data)
    const lastRow = sheet.getLastRow();
    if (row !== lastRow) {
      return; // Only care about the last row (latest data)
    }
    
    // Skip header row
    if (row <= 1) {
      return;
    }
    
    // Check if column A (LoggedAt) has data
    const dateCell = sheet.getRange(row, LOGGED_AT_INDEX + 1); // +1 because range is 1-indexed
    const dateValue = dateCell.getValue();
    
    // Check if it's a Date object
    if (!(dateValue instanceof Date)) {
      console.log(`Row ${row} doesn't contain a date in column A. Value: ${dateValue}`);
      return;
    }
    
    // Convert the date to milliseconds using the formula:
    // =ARRAYFORMULA(IF(A2:A="", "", INT((A2:A - DATE(1970,1,1)) * 86400000)))
    const EPOCH = new Date(1970, 0, 1);
    const milliseconds = Math.floor((dateValue - EPOCH) / 1);
    
    // Update the ESP_Timestamp cell (column B)
    const millisCell = sheet.getRange(row, ESP_TIMESTAMP_INDEX + 1); // +1 because range is 1-indexed
    millisCell.setValue(milliseconds);
    
    // Log the conversion
    console.log(`Auto-converted timestamp in ${sheetName} row ${row}: ${dateValue.toISOString()} → ${milliseconds}ms`);
    
  } catch (error) {
    console.error('Error in onEdit: ' + error.toString());
  }
}

/**
 * Manually convert timestamps in the last N rows
 * Useful if there were recent rows added that didn't get converted automatically
 */
function convertRecentTimestamps() {
  // How many recent rows to check
  const rowsToCheck = 10;
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let totalConverted = 0;
    
    // Process both sheets
    [MAIN_SHEET, ARCHIVE_SHEET].forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) return;
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return; // No data or only header
      
      // Determine how many rows to process (all data rows or requested rowsToCheck)
      const startRow = Math.max(2, lastRow - rowsToCheck + 1);
      const numRows = lastRow - startRow + 1;
      
      if (numRows <= 0) return;
      
      // Get the data range
      const dataRange = sheet.getRange(startRow, 1, numRows, 2); // Get columns A and B
      const values = dataRange.getValues();
      let modified = false;
      
      // Reference date for epoch calculations
      const EPOCH = new Date(1970, 0, 1);
      
      // Process each row
      for (let i = 0; i < values.length; i++) {
        const dateValue = values[i][LOGGED_AT_INDEX];
        
        // Skip if no date or already has milliseconds
        if (!(dateValue instanceof Date)) continue;
        
        // Convert to milliseconds
        const milliseconds = Math.floor((dateValue - EPOCH) / 1);
        
        // Update the value in our array
        values[i][ESP_TIMESTAMP_INDEX] = milliseconds;
        modified = true;
        totalConverted++;
      }
      
      // Update the sheet if we made changes
      if (modified) {
        dataRange.setValues(values);
        console.log(`Updated ${totalConverted} timestamp(s) in ${sheetName}`);
      }
    });
    
    if (totalConverted > 0) {
      return `Successfully converted ${totalConverted} timestamp(s) to milliseconds.`;
    } else {
      return "No timestamps needed conversion.";
    }
    
  } catch (error) {
    console.error('Error: ' + error.toString());
    return "Error converting timestamps: " + error.message;
  }
}

/**
 * Manually trigger conversion for the very last row in both sheets
 */
function convertLastRowTimestamp() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let totalConverted = 0;
    
    // Process both sheets
    [MAIN_SHEET, ARCHIVE_SHEET].forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) return;
      
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) return; // No data or only header
      
      // Get just the last row
      const dateCell = sheet.getRange(lastRow, LOGGED_AT_INDEX + 1);
      const dateValue = dateCell.getValue();
      
      // Skip if not a date
      if (!(dateValue instanceof Date)) return;
      
      // Convert to milliseconds
      const EPOCH = new Date(1970, 0, 1);
      const milliseconds = Math.floor((dateValue - EPOCH) / 1);
      
      // Update the milliseconds cell
      const millisCell = sheet.getRange(lastRow, ESP_TIMESTAMP_INDEX + 1);
      millisCell.setValue(milliseconds);
      
      totalConverted++;
      console.log(`Converted last row in ${sheetName}: ${dateValue.toISOString()} → ${milliseconds}ms`);
    });
    
    return `Converted ${totalConverted} last row timestamp(s).`;
    
  } catch (error) {
    console.error('Error: ' + error.toString());
    return "Error converting last row: " + error.message;
  }
}

/**
 * Add menu items for timestamp conversion
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Timestamp Utilities')
    .addItem('Convert Last Row Timestamp', 'convertLastRowTimestamp')
    .addItem('Convert Recent Timestamps (Last 10 Rows)', 'convertRecentTimestamps')
    .addToUi();
}
