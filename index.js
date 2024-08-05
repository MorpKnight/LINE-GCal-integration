const { google } = require('googleapis');
const { format } = require('date-fns');
const cron = require('node-cron');
const fs = require('fs').promises;
require('dotenv').config();
const lineNotify = require('line-notify-nodejs')(process.env.LINE_NOTIFY_TOKEN);
const { authorize } = require('./src/auth');

const STATE_FILE_PATH = 'notifiedTasks.json';
const hour = process.env.HOUR || 6;
const minutes = process.env.MINUTES || 0;

let notifiedTasks = new Set();

// Function to log messages with timestamp
function log(message) {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    console.log(`[${timestamp}] ${message}`);
}

// Function to log errors with timestamp
function error(message) {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    console.error(`[${timestamp}] ${message}`);
}

// Load the state from the file or create it if it doesn't exist
async function loadState() {
    try {
        await fs.access(STATE_FILE_PATH); // Check if file exists
        const data = await fs.readFile(STATE_FILE_PATH, 'utf8');
        notifiedTasks = new Set(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, create an empty file and initialize notifiedTasks as an empty set
            notifiedTasks = new Set();
            await fs.writeFile(STATE_FILE_PATH, JSON.stringify([...notifiedTasks]), 'utf8');
        } else {
            error('Error loading state: ' + error.message);
        }
    }
}

// Save the state to the file
async function saveState() {
    try {
        await fs.writeFile(STATE_FILE_PATH, JSON.stringify([...notifiedTasks]), 'utf8');
    } catch (error) {
        error('Error saving state: ' + error.message);
    }
}

/**
 * Lists the user's tasks and sends notifications as needed.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function main(auth) {
    await loadState();

    const service = google.tasks({ version: 'v1', auth });

    function notifyNewTask(task) {
        if (!notifiedTasks.has(task.id)) {
            const message = `\nNew task: ${task.title}`;
            lineNotify.notify({ message })
                .then(() => log('Notify new task success'))
                .catch(err => error(err.message));
            notifiedTasks.add(task.id);
            saveState(); // Save state after adding a new task
        }
    }

    function notifyTasksOverview(tasks) {
        if (tasks.length === 0) {
            log('No tasks to notify.');
            return;
        }

        const now = new Date();
        let overdueTasks = [];
        let dueTasks = [];

        tasks.forEach(task => {
            const due = task.due ? new Date(task.due) : null;
            const dueStr = due ? format(due, 'dd/MM/yyyy') : null;
            const overdue = due && due < now;

            if (due === null) {
                dueTasks.push(`*${task.title}*`);
            } else if (overdue) {
                overdueTasks.push(`*${task.title}* | _Overdue: ${dueStr}_`);
            } else {
                dueTasks.push(`*${task.title}* | Due: ${dueStr}`);
            }
        });

        let messageParts = ['📋 *Tasks Overview*:\n'];

        if (overdueTasks.length) {
            messageParts.push('⚠️ *Overdue Tasks*:\n');
            messageParts = messageParts.concat(overdueTasks.map(task => `- ${task}`));
        }

        if (dueTasks.length) {
            if (overdueTasks.length) {
                messageParts.push('\n');
            }
            messageParts.push('✅ *Upcoming Tasks*:\n');
            messageParts = messageParts.concat(dueTasks.map(task => `- ${task}`));
        }

        const message = messageParts.join('\n');
        lineNotify.notify({ message })
            .then(() => log('Notify tasks overview success'))
            .catch(err => error(err.message));
    }

    async function checkTasks() {
        try {
            const res = await service.tasks.list({
                tasklist: '@default',
                showCompleted: false
            });
            const tasks = res.data.items || [];
            
            const now = new Date();
            const sortedTasks = tasks.sort((a, b) => {
                const dueA = new Date(a.due);
                const dueB = new Date(b.due);
                return dueA - dueB;
            });
            
            const overdueTasks = sortedTasks.filter(task => task.due && new Date(task.due) < now);
            const upcomingTasks = sortedTasks.filter(task => task.due && new Date(task.due) >= now);
            const noDueDateTasks = sortedTasks.filter(task => !task.due);
        
            const finalTaskList = [...overdueTasks, ...upcomingTasks, ...noDueDateTasks];
        
            upcomingTasks.forEach(notifyNewTask);
            notifyTasksOverview(finalTaskList);
        } catch (err) {
            error('Error checking tasks: ' + err.message);
        }
    }

    // Schedule task checking every day at specified hour and minutes for task overview and overdue tasks
    cron.schedule(`${minutes} ${hour} * * *`, () => {
        checkTasks();
    }, { timezone: 'Asia/Jakarta' });

    // Example: Create a task to test the notifications
    function createTestTask() {
        service.tasks.insert({
            tasklist: '@default',
            requestBody: {
                title: 'Test Task',
                notes: 'This is a test task',
                due: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString() // due in 24 hours
            }
        }).then(res => {
            log('Test task created: ' + JSON.stringify(res.data));
            notifyNewTask(res.data);
        }).catch(err => error(err.message));
    }

    // Uncomment to create a test task
    // createTestTask();
}

console.log('System is running...');
const formattedHour = String(hour).padStart(2, '0');
const formattedMinute = String(minutes).padStart(2, '0');

const message = `Auto Task Reminder will notify you every day at ${formattedHour}:${formattedMinute}`;
console.log(message);
authorize().then(main).catch(err => error('Error authorizing: ' + err.message));
