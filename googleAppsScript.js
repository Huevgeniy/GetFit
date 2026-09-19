// Google Apps Script для синхронизации GetFit с Google Sheets
// Инструкция:
// 1. Создай новый Google Sheet
// 2. Extensions → Apps Script
// 3. Вставь этот код
// 4. Deploy → New deployment → Web app
// 5. Execute as: Me, Who has access: Anyone
// 6. Скопируй URL и вставь в .env как GOOGLE_APPS_SCRIPT_URL

const SHEET_ID = ''; // Вставь ID своего Google Sheet (из URL между /d/ и /edit)

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  if (action === 'init_sheets') {
    return initSheets(ss);
  }
  
  if (action === 'log_workout') {
    return logWorkout(ss, data);
  }
  
  if (action === 'log_sleep') {
    return logSleep(ss, data);
  }
  
  if (action === 'log_metric') {
    return logMetric(ss, data);
  }
  
  if (action === 'get_data') {
    return getData(ss, data);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'ok',
    message: 'GetFit Google Sheets Integration Active',
    sheetId: SHEET_ID || 'Not configured'
  })).setMimeType(ContentService.MimeType.JSON);
}

function initSheets(ss) {
  const sheets = ['Workouts', 'Sleep', 'Metrics', 'Experiments', 'Users'];
  
  sheets.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      
      // Set headers based on sheet name
      if (sheetName === 'Workouts') {
        sheet.appendRow(['timestamp', 'user_id', 'title', 'duration_min', 'total_tonnage', 'exercises', 'notes']);
      } else if (sheetName === 'Sleep') {
        sheet.appendRow(['date', 'user_id', 'duration_hours', 'quality', 'deep_sleep', 'rem_sleep', 'notes']);
      } else if (sheetName === 'Metrics') {
        sheet.appendRow(['date', 'user_id', 'metric_name', 'value', 'unit', 'category', 'notes']);
      } else if (sheetName === 'Experiments') {
        sheet.appendRow(['id', 'user_id', 'title', 'hypothesis', 'start_date', 'end_date', 'status', 'results']);
      } else if (sheetName === 'Users') {
        sheet.appendRow(['user_id', 'name', 'telegram_username', 'created_at', 'last_sync']);
      }
    }
  });
  
  return response({ success: true, message: 'Sheets initialized' });
}

function logWorkout(ss, data) {
  const sheet = ss.getSheetByName('Workouts');
  if (!sheet) {
    return response({ error: 'Workouts sheet not found' });
  }
  
  const workout = data.workout;
  const exercisesSummary = workout.exercises?.map(e => 
    `${e.name}: ${e.sets?.length} подходов`
  ).join('; ') || '';
  
  sheet.appendRow([
    new Date().toISOString(),
    data.userId || 'unknown',
    workout.title || 'Тренировка',
    workout.durationMinutes || 0,
    workout.totalTonnageKg || 0,
    exercisesSummary,
    workout.notes || ''
  ]);
  
  return response({ success: true, row: sheet.getLastRow() });
}

function logSleep(ss, data) {
  const sheet = ss.getSheetByName('Sleep');
  if (!sheet) {
    return response({ error: 'Sleep sheet not found' });
  }
  
  const sleep = data.sleep;
  sheet.appendRow([
    sleep.date || new Date().toISOString().split('T')[0],
    data.userId || 'unknown',
    sleep.durationHours || 0,
    sleep.qualityScore || 0,
    sleep.deepSleepMinutes || 0,
    sleep.remSleepMinutes || 0,
    sleep.notes || ''
  ]);
  
  return response({ success: true, row: sheet.getLastRow() });
}

function logMetric(ss, data) {
  const sheet = ss.getSheetByName('Metrics');
  if (!sheet) {
    return response({ error: 'Metrics sheet not found' });
  }
  
  const metric = data.metric;
  sheet.appendRow([
    metric.date || new Date().toISOString().split('T')[0],
    data.userId || 'unknown',
    metric.name || 'Метрика',
    metric.value || 0,
    metric.unit || '',
    metric.category || 'general',
    metric.notes || ''
  ]);
  
  return response({ success: true, row: sheet.getLastRow() });
}

function getData(ss, data) {
  const sheetName = data.sheet || 'Workouts';
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return response({ error: `Sheet ${sheetName} not found` });
  }
  
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = rows.slice(1).map(row => {
    const record = {};
    headers.forEach((h, i) => record[h] = row[i]);
    return record;
  });
  
  return response({ success: true, data: records, count: records.length });
}

function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Тестовая функция для проверки из редактора
function test() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Logger.log(initSheets(ss));
}
