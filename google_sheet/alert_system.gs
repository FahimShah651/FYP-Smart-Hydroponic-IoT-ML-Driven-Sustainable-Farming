// Alert System for Smart Hydroponic System
// This script checks if data hasn't been updated in 30 minutes and sends email alerts

// Using constants already defined in Code.gs
// No need to redeclare SHEET_ID, MAIN_DATA_SHEET or other constants

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
  const subject = "ALERT: ESP32 Data Not Updated";
  
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
 * Sets up a time-based trigger to run the check every 15 minutes
 * Run this function once manually to set up the automated checking
 */
function setupAlertTrigger() {
  // Remove any existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkLastUpdateAndNotify') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create a new trigger to run every 15 minutes
  ScriptApp.newTrigger('checkLastUpdateAndNotify')
    .timeBased()
    .everyMinutes(15)
    .create();
  
  console.log("Alert trigger set up to run every 15 minutes");
  return "Alert system activated. The system will check for updates every 15 minutes.";
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