import { Language } from '../types/Settings';

// ---------------------------------------------------------------------------
// Language metadata
// ---------------------------------------------------------------------------

export const LANGUAGE_META: Record<Language, {
  direction: 'ltr' | 'rtl';
  nativeLabel: string;  // name of the language in that language
  englishLabel: string;
}> = {
  en: { direction: 'ltr', nativeLabel: 'English',  englishLabel: 'English' },
  he: { direction: 'rtl', nativeLabel: 'עברית',    englishLabel: 'Hebrew'  },
};

// ---------------------------------------------------------------------------
// Translation table
// Key   = canonical English string used in source code
// 'he'  = natural Israeli Hebrew translation
// Parameterised strings use {placeholder} — substituted at call time
// ---------------------------------------------------------------------------

const table: Record<string, Partial<Record<Language, string>>> = {

  // ── Navigation / drawer ──────────────────────────────────────────────────
  'TimeAnalyzer':               { he: 'טיים אנלייזר' },
  'Entries':                    { he: 'רשומות' },
  'Goals':                      { he: 'יעדים' },
  'Plans':                      { he: 'תכניות' },
  'Reports':                    { he: 'דוחות' },
  'Settings':                   { he: 'הגדרות' },
  'Menu':                       { he: 'תפריט' },
  'DEBUG':                      { he: 'דיבאג' },
  'AI Test':                    { he: 'בדיקת AI' },
  'Prompts':                    { he: 'פרומפטים' },
  'Daily Summaries':            { he: 'סיכומים יומיים' },
  'Seed Mock Data':             { he: 'נתוני דמה' },

  // ── Common actions ────────────────────────────────────────────────────────
  'Save':                       { he: 'שמור' },
  'Cancel':                     { he: 'ביטול' },
  'Edit':                       { he: 'עריכה' },
  'Delete':                     { he: 'מחק' },
  'Add':                        { he: 'הוסף' },
  'Done':                       { he: 'סיום' },
  'Close':                      { he: 'סגור' },
  'Back':                       { he: 'חזור' },
  'Open':                       { he: 'פתח' },
  'Send':                       { he: 'שלח' },
  'Confirm':                    { he: 'אשר' },
  'Apply':                      { he: 'החל' },
  'Stop':                       { he: 'עצור' },
  'Record':                     { he: 'הקלט' },
  'Submit':                     { he: 'שלח' },
  'Show less':                  { he: 'הצג פחות' },
  'Show {n} more':              { he: 'הצג {n} נוספים' },
  'Today':                      { he: 'היום' },
  'Yesterday':                  { he: 'אתמול' },
  'Tomorrow':                   { he: 'מחר' },

  // ── Check-in screen ───────────────────────────────────────────────────────
  'Check-in':                   { he: 'עדכון' },
  'What did you work on?':      { he: 'על מה עבדת?' },
  'Type what you worked on...': { he: 'הקלד מה עשית...' },
  'or speak':                   { he: 'או דבר' },
  'Transcribing…':              { he: 'מתמלל...' },
  'Review your check-in':       { he: 'בדוק את העדכון שלך' },
  'Add a note…':                { he: 'הוסף הערה...' },
  '+ Add note':                 { he: '+ הוסף הערה' },
  'Re-record':                  { he: 'הקלט מחדש' },
  'Check-in saved':             { he: 'עדכון נשמר' },
  'Advance by':                 { he: 'התקדם ב-' },
  'GOAL PROGRESS THIS SESSION': { he: 'התקדמות ביעדים בסשן' },
  'No goal contributions this session.': { he: 'אין תרומות ליעדים בסשן זה.' },
  '🎉 Complete!':               { he: '🎉 הושלם!' },
  '+{delta}%':                  { he: '+{delta}%' },

  // ── Goals ─────────────────────────────────────────────────────────────────
  '🎯  Goals in scope':         { he: '🎯 יעדים רלוונטיים' },
  '🎯  ACTIVE GOALS':           { he: '🎯 יעדים פעילים' },
  '🎯  HOW MUCH DID YOU ADVANCE EACH GOAL?': { he: '🎯 כמה התקדמת בכל יעד?' },
  'Active':                     { he: 'פעילים' },
  'Canceled':                   { he: 'בוטלו' },
  'All':                        { he: 'הכל' },
  'No active goals. Add one below.': { he: 'אין יעדים פעילים. הוסף אחד למטה.' },
  'No goals in this category.': { he: 'אין יעדים בקטגוריה זו.' },
  'NEW GOAL':                   { he: 'יעד חדש' },
  'What do you want to achieve?': { he: 'מה אתה רוצה להשיג?' },
  'Add goal':                   { he: 'הוסף יעד' },
  'Progress':                   { he: 'התקדמות' },
  'Overdue':                    { he: 'באיחור' },
  '✅ Done':                    { he: '✅ הושלם' },
  '✕ Cancel':                  { he: '✕ בטל' },
  '↩ Reactivate':              { he: '↩ הפעל מחדש' },
  '+ New goal':                 { he: '+ יעד חדש' },
  'Describe your goal...':      { he: 'תאר את היעד שלך...' },
  'Start':                      { he: 'התחלה' },
  'End':                        { he: 'סיום' },

  // ── Plans ─────────────────────────────────────────────────────────────────
  '📅  PLAN':                   { he: '📅 תכנית' },
  'PLAN BLOCKS':                { he: 'בלוקי תכנון' },
  'Parse into blocks':          { he: 'פרסר לבלוקים' },
  'Activity description…':      { he: 'תיאור פעילות...' },
  'No activity set':            { he: 'לא הוגדרה פעילות' },
  '+ Add block manually':       { he: '+ הוסף בלוק ידנית' },
  '{covered}/{total} blocks covered': { he: '{covered}/{total} בלוקים כוסו' },
  '{n} missed':                 { he: '{n} לא כוסו' },
  'Edit ›':                     { he: 'עריכה ›' },

  // ── Entries / Report screen ───────────────────────────────────────────────
  '📋  ENTRIES':                { he: '📋 רשומות' },
  'No entries for this day':    { he: 'אין רשומות ליום זה' },
  '→ {activities}':             { he: '→ {activities}' },
  'DAILY SUMMARY':              { he: 'סיכום יומי' },
  'No summary yet':             { he: 'אין סיכום עדיין' },

  // ── Entry detail screen ───────────────────────────────────────────────────
  'TIME RANGE':                 { he: 'טווח זמן' },
  'TRANSCRIPT':                 { he: 'תמלול' },
  'NOTES':                      { he: 'הערות' },
  'No notes yet.':              { he: 'אין הערות עדיין.' },
  'New note…':                  { he: 'הערה חדשה...' },
  'GOAL CONTRIBUTIONS':         { he: 'תרומות ליעדים' },
  'No reason saved':            { he: 'לא נשמרה סיבה' },
  'Reason...':                  { he: 'סיבה...' },
  'AI GOAL SUGGESTIONS':        { he: 'הצעות AI ליעדים' },
  '✨ Suggest with AI':         { he: '✨ הצע עם AI' },
  'No clear goal progress found in this entry.': { he: 'לא נמצאה התקדמות ברורה ביעדים ברשומה זו.' },
  'No clear goal progress found in this check-in.': { he: 'לא נמצאה התקדמות ברורה ביעדים בעדכון זה.' },
  'Suggested {n} contribution.':  { he: 'הוצעה תרומה אחת.' },
  'Suggested {n} contributions.': { he: 'הוצעו {n} תרומות.' },
  'Applied {n} contribution.':    { he: 'הוחלה תרומה אחת.' },
  'Applied {n} contributions.':   { he: 'הוחלו {n} תרומות.' },
  'Apply suggestions':          { he: 'החל הצעות' },
  'Applying...':                { he: 'מחיל...' },

  // ── Daily summary ─────────────────────────────────────────────────────────
  'Daily Summary':              { he: 'סיכום יומי' },
  'SUMMARY':                    { he: 'סיכום' },
  'KEY INSIGHTS':               { he: 'תובנות מרכזיות' },
  'MOMENTUM':                   { he: 'מומנטום' },
  'GAPS':                       { he: 'פערים' },
  'Write a summary...':         { he: 'כתוב סיכום...' },
  'Write summary':              { he: 'כתוב סיכום' },
  'Generate with AI':           { he: 'צור עם AI' },
  'Generating...':              { he: 'מייצר...' },
  'Updated {time}':             { he: 'עודכן {time}' },
  'No saved daily summaries.':  { he: 'אין סיכומים יומיים שמורים.' },

  // ── Reports screen ────────────────────────────────────────────────────────
  'Day':                        { he: 'יום' },
  'Week':                       { he: 'שבוע' },
  'No data for this period':    { he: 'אין נתונים לתקופה זו' },
  'PLAN VS ACTUAL':             { he: 'תכנון מול ביצוע' },
  'Time':                       { he: 'זמן' },
  'Planned':                    { he: 'מתוכנן' },
  'Actual':                     { he: 'בפועל' },
  'Unplanned':                  { he: 'לא מתוכנן' },
  '+{n} more':                  { he: '+{n} נוספים' },
  'TIME DISTRIBUTION':          { he: 'התפלגות זמן' },
  'Total: {duration}':          { he: 'סה"כ: {duration}' },
  'PLAN ADHERENCE':             { he: 'עמידה בתכנון' },
  '{covered} of {total} blocks covered': { he: '{covered} מתוך {total} בלוקים כוסו' },
  'Planned: {duration}':        { he: 'מתוכנן: {duration}' },
  'Actual: {duration}':         { he: 'בפועל: {duration}' },

  // ── Settings ──────────────────────────────────────────────────────────────
  'LANGUAGE':                   { he: 'שפה' },
  'NOTIFICATION SCHEDULE':      { he: 'לוח זמנים להתראות' },
  'NOTIFICATION DAYS':          { he: 'ימי התראות' },
  'NOTIFICATION HOURS':         { he: 'שעות התראות' },
  'All day':                    { he: 'כל היום' },
  'CHECK-IN FREQUENCY':         { he: 'תדירות עדכונים' },
  'Check-in frequency':         { he: 'תדירות עדכונים' },
  'hours':                      { he: 'שעות' },
  'DAILY PLAN':                 { he: 'תכנון יומי' },
  'Plan notification time':     { he: 'שעת התראת תכנון' },
  'PROVIDERS':                  { he: 'ספקים' },
  'TRANSCRIPTION':              { he: 'תמלול' },
  'ANALYSIS':                   { he: 'ניתוח' },
  'API Key':                    { he: 'מפתח API' },
  'KEYWORDS':                   { he: 'מילות מפתח' },
  'VOICE COMMANDS':             { he: 'פקודות קוליות' },
  'Note keyword':               { he: 'מילת מפתח להערה' },
  'Splits speech into a new note': { he: 'מפצל דיבור להערה חדשה' },
  'Append keyword':             { he: 'מילת מפתח לצירוף' },
  'Appends dictation to existing text': { he: 'מצרף כתיב לטקסט קיים' },
  'THEME':                      { he: 'ערכת נושא' },
  'APPEARANCE':                 { he: 'מראה' },
  'INTEGRATIONS':               { he: 'אינטגרציות' },
  'GOOGLE CALENDAR':            { he: 'יומן Google' },
  'Connected':                  { he: 'מחובר' },
  'Not connected':              { he: 'לא מחובר' },
  'Sync now':                   { he: 'סנכרן עכשיו' },
  'Hard sync':                  { he: 'סנכרון מלא' },
  'Disconnect':                 { he: 'נתק' },
  'Sign in with Google':        { he: 'התחבר עם Google' },
  'SYNC INTERVAL':              { he: 'מרווח סנכרון' },
  'Debug mode':                 { he: 'מצב דיבאג' },
  'Show sync fields on each entry': { he: 'הצג שדות סנכרון ברשומות' },
  'Emulator-only software engineer dataset': { he: 'מערכת נתוני דמה לאמולטור' },
  'NOTIFICATIONS DIAGNOSTICS':  { he: 'אבחון התראות' },
  'Run full diagnostic':        { he: 'הרץ אבחון מלא' },
  'Reschedule now':             { he: 'תזמן מחדש' },
  'Send test notification':     { he: 'שלח התראת בדיקה' },
  'Scheduled notifications':    { he: 'התראות מתוזמנות' },
  'Open alarm settings':        { he: 'פתח הגדרות אזעקה' },
  'Open app notification settings': { he: 'פתח הגדרות התראות' },

  // ── Day names ─────────────────────────────────────────────────────────────
  'Sun':  { he: 'א' },
  'Mon':  { he: 'ב' },
  'Tue':  { he: 'ג' },
  'Wed':  { he: 'ד' },
  'Thu':  { he: 'ה' },
  'Fri':  { he: 'ו' },
  'Sat':  { he: 'ש' },
  'Sunday':    { he: 'ראשון' },
  'Monday':    { he: 'שני' },
  'Tuesday':   { he: 'שלישי' },
  'Wednesday': { he: 'רביעי' },
  'Thursday':  { he: 'חמישי' },
  'Friday':    { he: 'שישי' },
  'Saturday':  { he: 'שבת' },

  // ── Components ────────────────────────────────────────────────────────────
  '🎤 Dictate':                 { he: '🎤 כתיב' },
  'Microphone Permission':      { he: 'הרשאת מיקרופון' },
  'TimeAnalyzer needs the microphone to transcribe.': { he: 'TimeAnalyzer צריך גישה למיקרופון לצורך תמלול.' },
  'Allow':                      { he: 'אפשר' },
  'Permission denied':          { he: 'הרשאה נדחתה' },
  'Microphone access is required.': { he: 'נדרשת גישה למיקרופון.' },
  'Failed to start':            { he: 'ההפעלה נכשלה' },
  'Transcription failed':       { he: 'התמלול נכשל' },

  // ── AI / Integrations ─────────────────────────────────────────────────────
  'Set your key in Settings → Analysis Provider': { he: 'הגדר מפתח API בהגדרות → ספק ניתוח' },
  'Type a message and tap Send to test the AI connection.': { he: 'כתוב הודעה ולחץ שלח לבדיקת חיבור AI.' },
  'You':                        { he: 'אתה' },
  'Ask anything…':              { he: 'שאל כל שאלה...' },
  'CONNECTED ACCOUNTS':         { he: 'חשבונות מחוברים' },
  'Coming soon':                { he: 'בקרוב' },
  'iOS only':                   { he: 'iOS בלבד' },

  // ── Note detail ───────────────────────────────────────────────────────────
  'Note text…':                 { he: 'טקסט הערה...' },

  // ── Prompts screen ────────────────────────────────────────────────────────
  'Template variables':         { he: 'משתני תבנית' },
  'Set default':                { he: 'הגדר כברירת מחדל' },
  'Default':                    { he: 'ברירת מחדל' },
  'No prompts yet.':            { he: 'אין פרומפטים עדיין.' },
  'Prompt name':                { he: 'שם הפרומפט' },
  'Prompt body':                { he: 'גוף הפרומפט' },
};

// ---------------------------------------------------------------------------
// translate() — the core function
// Supports {placeholder} substitution in parameterised strings.
// Falls back to the English key if no translation is found.
// ---------------------------------------------------------------------------

export function translate(
  key: string,
  lang: Language,
  params?: Record<string, string | number>,
): string {
  const base = lang === 'en' ? key : (table[key]?.[lang] ?? key);
  if (!params) return base;
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    base,
  );
}
