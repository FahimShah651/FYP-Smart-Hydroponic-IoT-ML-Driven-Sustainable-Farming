/**
 * Ultra-simple timestamp converter with auto-trigger
 */

// Auto-runs when sheet is edited
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== 'Sheet1') return;
    
    const row = e.range.getRow();
    const lastRow = sheet.getLastRow();
    
    // Only process if this is the last row (new data)
    if (row !== lastRow || row <= 1) return;
    
    // Convert date to milliseconds
    const dateValue = sheet.getRange(lastRow, 1).getValue();
    if (!(dateValue instanceof Date)) return;
    
    const milliseconds = Math.floor((dateValue - new Date(1970, 0, 1)) / 1);
    sheet.getRange(lastRow, 2).setValue(milliseconds);
  } catch (error) {
    console.error('Error: ' + error);
  }
}

// Function to manually trigger conversion of last row
function convertLastRow() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  
  const dateValue = sheet.getRange(lastRow, 1).getValue();
  if (!(dateValue instanceof Date)) return;
  
  const milliseconds = Math.floor((dateValue - new Date(1970, 0, 1)) / 1);
  sheet.getRange(lastRow, 2).setValue(milliseconds);
}
