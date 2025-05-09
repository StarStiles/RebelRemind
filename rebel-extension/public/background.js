/**
 * Background Script for Chrome Extension
 *
 * This script initializes the Chrome extension, listens for events, and handles background tasks
 * such as authentication, message passing, and user preferences storage.
 *
 * Handles:
 * - Extension installation event
 * - Message listeners for handling user authentication, preferences, and Canvas API token retrieval.
 *
 * Documentation generated by ChatGPT
 */

import { authenticateUser } from "./scripts/identity-script.js";
import { getAssignments, getCourses, getCanvasPAT } from "./scripts/canvas-script.js";
import { openSidePanel } from "./scripts/sidepanel.js";
import { fetchEvents } from "./scripts/fetch-events.js";
import { checkDailyTask } from "./scripts/check-daily-login.js";


/**
* Listens for and handles any Chrome alarms.
*/
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name == "getAssignments") { // alarm is triggered, update storage with new assignments
    fetchCanvasAssignments();
  }
});

//region BACKGROUND

/**
 * Handles background logic for scheduling and displaying daily event reminders.
 * 
 * This function is triggered automatically when Chrome starts or at scheduled intervals 
 * (via alarms or runtime listeners). It fetches daily event data, filters relevant events, 
 * and displays a system notification with a summary of upcoming activities.
 * 
 * Designed to run silently in the background as part of the RebelRemind extension.
 * 
 * Author: Billy Estrada
 */

//region notif
let notificationState = false; // Default value
chrome.storage.sync.get("notificationsEnabled", (data) => {
  if (data && data.notificationsEnabled !== undefined) {
    notificationState = data.notificationsEnabled;
  } else {
    notificationState = false;
  }
});


function getNextNineAM() {
  const now = new Date();
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  if (now > next) {
    next.setDate(next.getDate() + 1); // schedule for tomorrow
  }
  return next.getTime();
}

// Initialize from storage on extension startup

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed: Create alarm");

  chrome.alarms.create("dailyCheck", {
    when: getNextNineAM(),
    periodInMinutes: 1440 //24 hours
    // periodInMinutes: 1 //24 hours
  });
});


chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.notificationsEnabled){
    // Utility to calculate the next 9:00 AM time
    notificationState = changes.notificationsEnabled.newValue;
    if (notificationState){
      console.log("Notify from changed preferences")
      handleDailyTask();
    }
  }
});


// Run logic when Chrome starts (fallback if alarm missed)
chrome.runtime.onStartup.addListener(() => {
  const currentHour = new Date().getHours();
  console.log("Chrome started at", currentHour);
  if (currentHour >= 9) {
    console.log("Notify from chrome startup")
    handleDailyTask(true); // after 9am is true
  }
});

// Respond to the daily alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyCheck") {
    console.log("Notify daily 9am")
    handleDailyTask();
  }
});

// Core function to handle daily task logic
async function handleDailyTask(isStartup = false) {
  try {
    const shouldRun = await checkDailyTask();
    const currentHour = new Date().getHours();

    // Only run if the task hasn't already run, and it's after 9AM (if startup fallback)
    if (shouldRun && (isStartup || currentHour >= 9)) {
      console.log("Triggering daily task");

      const fetchAssignments = async () => {
        return new Promise((resolve) => {
          chrome.storage.local.get("Canvas_Assignments", (data) => {
            if (Array.isArray(data.Canvas_Assignments)) {
              resolve(data.Canvas_Assignments);
            } else {
              resolve([]);
            }
          });
        });
      };
      
      const assignmentList = await fetchAssignments();

      //Constants do not touch
      const now = new Date();
      const todayForFetching = now.toLocaleDateString('en-CA')
      const filterToday = (arr) =>
        safeArray(arr).filter(event => {
          if (!event.startDate || !event.startTime) return false;

          const isAllDay = event.startTime === "(ALL DAY)";
          if (event.startDate !== todayForFetching) return false;
          if (isAllDay) return true;
          
          const dateTime = new Date(`${event.startDate} ${event.startTime}`); 
          return dateTime > now;
        });
      const filterTodayCanvas = (arr) =>
        safeArray(arr).filter(item => {
          if (!item.due_at) return false;
      
          const dueDate = new Date(item.due_at);
          const localDateStr = dueDate.toLocaleDateString('en-CA'); 
          
          return localDateStr === todayForFetching && dueDate > now;
        });

      //Basically error check if a response is valid
      const safeArray = (data) => Array.isArray(data) ? data : [];

      //Check incoming fetched events
      const [data1, data2, data3, data4] = await fetchEvents(todayForFetching);

      const academiccalendar_daily = filterToday(data1).length;
      const involvementcenter_daily = filterToday(data2).length;
      const rebelcoverage_daily = filterToday(data3).length;
      const unlvcalendar_daily = filterToday(data4).length;
      const canvas_daily = filterTodayCanvas(assignmentList).length;

      const allEvents = [...safeArray(data1), ...safeArray(data2), ...safeArray(data3), ...safeArray(data4)];

      const eventsToday = academiccalendar_daily + involvementcenter_daily + rebelcoverage_daily + unlvcalendar_daily + canvas_daily > 0;
      console.log("Events today", eventsToday);
      const parts = [];

      if (canvas_daily > 0) {
        parts.push(`${canvas_daily} Canvas ${canvas_daily === 1 ? 'assignment' : 'assignments'}`);
      }

      if (academiccalendar_daily > 0) {
        parts.push(`${academiccalendar_daily} Academic ${academiccalendar_daily === 1 ? 'event' : 'events'}`);
      }

      if (involvementcenter_daily > 0) {
        parts.push(`${involvementcenter_daily} Involvement Center ${involvementcenter_daily === 1 ? 'event' : 'events'}`);
      }

      if (rebelcoverage_daily > 0) {
        parts.push(`${rebelcoverage_daily} Rebel Coverage ${rebelcoverage_daily === 1 ? 'event' : 'events'}`);
      }

      if (unlvcalendar_daily > 0) {
        parts.push(`${unlvcalendar_daily} UNLV ${unlvcalendar_daily === 1 ? 'event' : 'events'}`);
      }

      const dynamicTitle = parts.join(', ');

      if (eventsToday){
        chrome.notifications.create('', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL("images/logo_128x128.png"), // must exist and be declared in manifest.json
          title: "RebelRemind",
          message: dynamicTitle,
          priority: 2
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Notification error:', chrome.runtime.lastError.message);
          } else {
            console.log('Notification shown with ID:', notificationId);
          }
        });
      }

    //schema 
      const notificationData = {
        id: Date.now().toString(),
        startDate: todayForFetching,
        summary: dynamicTitle,
        events: [
          ...filterToday(data1).map(e => ({ ...e, source: "Academic" })),
          ...filterToday(data2).map(e => ({ ...e, source: "Involvement Center" })),
          ...filterToday(data3).map(e => ({ ...e, source: "Rebel Coverage" })),
          ...filterToday(data4).map(e => ({ ...e, source: "UNLV Calendar" })),
          ...filterTodayCanvas(assignmentList).map(e => ({ ...e, source: "Canvas" })),
        ]
      };
    
    // Push to local store
      chrome.storage.local.get("notificationHistory", (data) => {
        const history = Array.isArray(data.notificationHistory) ? data.notificationHistory : [];
        history.unshift(notificationData);
        chrome.storage.local.set({ notificationHistory: history.slice(0, 7) }); // Last 7 days
      });

    } else {
      console.log("Daily task skipped (already run or too early)");
    }
  } catch (error) {
    console.error("Error during daily task execution:", error);
  }

}

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("welcome.html#/notifications")
  });
});
//endregion

//endregion

//region MESSAGES

/**
 * Handles incoming messages from content scripts, popup scripts, or other parts of the extension.
 * Uses a `switch` statement to route different message types to the appropriate handlers.
 *
 * @param {Object} message - The message object sent from a content script, popup, or other background processes.
 * @param {Object} sender - The sender of the message (not used directly here).
 * @param {Function} sendResponse - The callback function to send a response back to the sender.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return; // ⛔ skip if it's a Pomodoro-style message
  switch (message.type) {

    /**
    * Starts the alarm that will refresh Canvas assignments in storage.
    */
    case "START_CANVAS_ALARM":
      chrome.alarms.create("getAssignments", { periodInMinutes: 30 }); // refresh assignment list from Canvas every 30 minutes
      console.log("Canvas Alarm Started");
      break;
    
    /**
    * Clears the alarm that refreshes Canvas assignments in storage.
    */
    case "CLEAR_CANVAS_ALARM":
      chrome.alarms.clear("getAssignments", () => { // delete alarm that refreshes assignments
        console.log("getAssignments Alarm Cleared");
      });
      break;
    
    /**
    * Updates the Canvas assignments list that is in storage.
    */
    case "UPDATE_ASSIGNMENTS":
      fetchCanvasAssignments();
      break;

    /**
     * Initiates user authentication.
     * Calls `authenticateUser()` to handle authentication logic.
     */
    case "LOGIN":
      authenticateUser(sendResponse);
      return true;

    /**
     * Checks if the user is authenticated.
     * Retrieves authentication state from `chrome.storage.sync`.
     */
    case "CHECK_AUTH":
      chrome.storage.sync.get("user", (data) => {
        sendResponse({ isAuthenticated: !!data.user }); // Returns `true` if a user is logged in.
      });
      return true;

    /**
     * Retrieves stored user preferences.
     * Preferences are stored in `chrome.storage.sync` under the "preferences" key.
     */
    case "GET_PREFERENCES":
      chrome.storage.sync.get("preferences", (data) => {
        sendResponse({ preferences: data.preferences || {} }); // Returns preferences or an empty object if none exist.
      });
      return true;

    /**
     * Saves user preferences to Chrome storage.
     * Preferences are provided in the `message.preferences` object.
     */
    case "SAVE_PREFERENCES":
      chrome.storage.sync.set({ preferences: message.preferences }, () => {
        console.log("Preferences saved to storage:", message.preferences);
        sendResponse({ success: true }); // Confirms successful storage update.
      });
      return true;

    /**
     * Retrieves the Canvas Personal Access Token (PAT) from `chrome.storage.local`.
     * Returns `null` if no token is found.
     */
    case "GET_CANVAS_PAT":
      chrome.storage.local.get("canvasPAT", (data) => {
        sendResponse({ token: data.canvasPAT || null });
      });
      return true;

    /**
     * Opens the side panel and closes the popup`.
     */
    case "OPEN_SIDEPANEL":
      openSidePanel(sendResponse);
      return true;

    /**
     * Reloads "Your Custom Events" list in UserEventsPage by broadcasting message from UserEventInput.jsx
     * Reloads the calendar in side panel to reflect created event.
     */
    case "EVENT_CREATED":
      chrome.runtime.sendMessage({ type: "EVENT_CREATED" }); // broadcast
      break;

    /**
    * Reloads the calendar in side panel to reflect updated event.
    */
    case "EVENT_UPDATED":
      chrome.runtime.sendMessage({ type: "EVENT_UPDATED" });
      break;

    /**
     * Default case: Logs an unrecognized message type.
     * Helps with debugging unexpected messages.
     */
    default:
      console.warn("Received unknown message type:", message.type);
      break;
  }
});

//endregion

//region CANVAS

/**
* Fetches all assignments from Canvas and places them into storage.
*/
async function fetchCanvasAssignments() {
  console.log("Fetching Assignments");
  let allAssignments = [];
  
  // Await access token before continuing
  getCanvasPAT().then((accessToken) => {
    if (!accessToken) {
      console.log("No access token found.");
      return false;
    }

    getCourses(accessToken).then((courseList) => {
      // Loop through the courses and fetch assignments
      const assignmentPromises = courseList.map((course) =>
        getAssignments(course, accessToken)
      );
      
      // Wait for all assignments to be fetched
      Promise.all(assignmentPromises)
        .then((assignments) => {
          // Flatten the array
          allAssignments = assignments.flat();
          const fetchStatus = { success: true, error: null }; // fetching had no errors
          chrome.storage.local.set({ Canvas_Assignments: allAssignments }, () => {
            console.log("Assignments Stored!");
          });
          chrome.storage.local.set({ CanvasFetchStatus: fetchStatus });
          chrome.runtime.sendMessage({ type: "UPDATE_ASSIGNMENTS" }, (response) => {
            if (chrome.runtime.lastError) {
              // handle receiving end does not exist error (when popup is closed)
            }
          });
          return true;
        })
        .catch((error) => { // error is logged instead of sending error to Chrome
          console.log("Error fetching assignments", error);
          return false;
        });
    }).catch((error) => {
      console.log("Error with getCourses()", error);
      return false;
    });
  }).catch((error) => {
    console.log("Error fetching access token", error);
    return false;
  });
}
//endregion

//region POMODORO

// The following code is all for the Pomodoro Timer Logic
let timerInterval;
let isRunning = false;
let minutes = 25;
let seconds = 0;

// Initialize default timer state
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html"),
    });
  }

    chrome.storage.local.set({
      minutes: 25,
      seconds: 0,
      isRunning: false,
    });
  }
);


// Start the timer function that handles all the features of when the user
// starts teh timer, we also call some functions like inject or remove widget.
function startTimer() {
  if (isRunning) return;

  chrome.storage.local.get(["minutes", "seconds"], (data) => {
    let currentMinutes = data.minutes ?? 25;
    let currentSeconds = data.seconds ?? 0;

    isRunning = true;
    chrome.storage.local.set({ isRunning: true });

    // Inject the widget on the current tab and all the other open tabs
    injectWidgetIntoAllTabs();

    timerInterval = setInterval(() => {
      if (currentMinutes === 0 && currentSeconds === 0) {
        clearInterval(timerInterval);
        isRunning = false;
        chrome.storage.local.set({ isRunning: false });

        chrome.notifications.create("timerDone", {
          type: "basic",
          iconUrl: chrome.runtime.getURL("images/pomodor-icon.png"),
          title: "Pomodoro Timer",
          message: "Timer is up! Time to take a break!",
          priority: 2, // 🔺 force it to show
          requireInteraction: true // ⏳ stays visible until dismissed
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("❌ Notification error:", chrome.runtime.lastError.message);
          } else {
            console.log("✅ Pomodoro notification shown: timerDone");
          }
        });
        
        removeWidgetFromAllTabs();
        return;
      }

      if (currentSeconds === 0) {
        currentMinutes--;
        currentSeconds = 59;
      } else {
        currentSeconds--;
      }

      chrome.storage.local.set({
        minutes: currentMinutes,
        seconds: currentSeconds
      });
    }, 1000);
  });
}

// Function that handles the functionality of when the timer is paused
function pauseTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  chrome.storage.local.set({ isRunning: false });
  // we want to remove the widget pop-up when the timer is on paused, so we assume
  // the user doesn't want to see the timer until they start it back again
  removeWidgetFromAllTabs();
}

// Reset the timer function, this handles the "Reset" button 
function resetTimer(customMinutes = 25) {
  clearInterval(timerInterval);
  isRunning = false;
  minutes = customMinutes;
  seconds = 0;
  chrome.storage.local.set({ minutes, seconds, isRunning: false });
  removeWidgetFromAllTabs();
}

// Handle Pomodoro messages, this displays a chrome message as a chrome notification once the timer is 00:00
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request !== "object" || request?.type) return;

  const action = request.action;
  if (action === "start") startTimer();
  else if (action === "pause") pauseTimer();
  else if (action === "reset") resetTimer(request.minutes || 25);
  else if (action === "getStatus") {
    sendResponse({ minutes, seconds, isRunning });
  } else if (action === "timeUpNotification") {
    chrome.notifications.create("timerDone", {
      type: "basic",
      iconUrl: "images/pomodor-icon.png",
      title: "Pomodoro Timer",
      message: "Timer is up! Time to take a break!"
    });
  } else {
    console.warn("Received unknown message action:", action);
  }
});


// function that injects the widget, makes it appear on the tab that was 
function injectWidgetOnActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0) return;
    const tab = tabs[0];
    if (!tab.id || !tab.url?.startsWith("http")) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scripts/floating-widget.js"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[Background] Failed to inject widget on active tab:", chrome.runtime.lastError.message);
      } else {
        console.log("[Background] Widget injected on active tab ✅");
      }
    });
  });
}


function removeWidgetFromAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (
        !tab.id ||
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://")
      ) continue;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scripts/remove-widget.js"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`[Background] Failed to remove widget from tab ${tab.id}:`, chrome.runtime.lastError.message);
        } else {
          console.log(`[Background] Widget removed from tab ${tab.id} ✅`);
        }
      });
    }
  });
}


function injectWidgetIntoAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (
        !tab.id ||
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://")
      ) continue;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scripts/floating-widget.js"]
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn(`[Background] Could not inject widget on tab ${tab.id}:`, chrome.runtime.lastError.message);
        } else {
          console.log(`[Background] Widget reinjected on tab ${tab.id} ✅`);
        }
      });
    }
  });
}

//endregion
