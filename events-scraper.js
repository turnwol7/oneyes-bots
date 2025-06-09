require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const EVENTS_URL = "https://digitalnovascotia.com/events/";
const EVENTS_FILE = "events.json";

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

async function scrapeEvents() {
    try {
        console.log("Fetching events from:", EVENTS_URL);
        const { data } = await axios.get(EVENTS_URL);
        const $ = cheerio.load(data);
        let events = [];

        // Select events from the page using The Events Calendar structure
        $(".tribe-events-calendar-month-mobile-events__mobile-event").each((i, el) => {
            const title = $(el).find(".tribe-events-calendar-month-mobile-events__mobile-event-title").text().trim();
            const link = $(el).find(".tribe-events-calendar-month-mobile-events__mobile-event-title-link").attr("href");
            const datetime = $(el).find(".tribe-events-calendar-month-mobile-events__mobile-event-datetime").text().trim();
            const isVirtual = $(el).find(".tribe-events-virtual-virtual-event").length > 0;
            const cost = $(el).find(".tribe-events-c-small-cta__price").text().trim();
            
            console.log(`Found event ${i + 1}:`, { title, datetime, isVirtual, cost });
            
            if (title && link) {
                events.push({ 
                    title, 
                    link,
                    datetime,
                    isVirtual,
                    cost
                });
            }
        });

        console.log(`Found ${events.length} events on the website`);
        return events;
    } catch (error) {
        console.error("Error scraping events:", error);
        return [];
    }
}

function loadPreviousEvents() {
    if (fs.existsSync(EVENTS_FILE)) {
        console.log("Loading previous events from", EVENTS_FILE);
        const events = JSON.parse(fs.readFileSync(EVENTS_FILE));
        console.log(`Loaded ${events.length} previous events`);
        return events;
    }
    console.log("No previous events file found");
    return [];
}

function saveEvents(events) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

async function checkForNewEvents() {
    const currentEvents = await scrapeEvents();
    const previousEvents = loadPreviousEvents();
    
    // Reverse the order so new events appear at the bottom
    //currentEvents.reverse();
    
    console.log("\nComparing events:");
    console.log(`Current events: ${currentEvents.length}`);
    console.log(`Previous events: ${previousEvents.length}`);
    
    const newEvents = currentEvents.filter(event => 
        !previousEvents.some(prev => prev.link === event.link)
    );
    
    if (newEvents.length > 0) {
        console.log("New events found:");
        newEvents.forEach(event => {
            console.log(`- ${event.title} (${event.datetime})`);
        });

        saveEvents(currentEvents);
        
        if (process.env.EVENTS_WEBHOOK_URL) {
            try {
                console.log("\nSending to Discord webhook...");
                
                const chunkSize = 10;
                for (let i = 0; i < newEvents.length; i += chunkSize) {
                    const chunk = newEvents.slice(i, i + chunkSize);
                    const discordMessage = {
                        embeds: chunk.map(event => ({
                            title: event.title,
                            url: event.link,
                            color: 0x00ff00,
                            description: `**Date & Time:** ${event.datetime}\n**Event Type:** ${event.isVirtual ? 'Virtual' : 'In Person'}${event.cost ? `\n**Cost:** ${event.cost}` : ''}`,
                            footer: {
                                text: `Digital Nova Scotia Events (${i + 1}-${Math.min(i + chunkSize, newEvents.length)} of ${newEvents.length})`
                            }
                        }))
                    };

                    const response = await axios.post(process.env.EVENTS_WEBHOOK_URL, discordMessage);
                    if (response.status === 204) {
                        console.log(`Successfully posted chunk ${Math.floor(i/chunkSize) + 1} to Discord`);
                    }
                    
                    if (i + chunkSize < newEvents.length) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error) {
                console.error('Error posting to Discord:', error.response?.data || error.message);
            }
        } else {
            console.error("EVENTS_WEBHOOK_URL not defined in .env");
        }
    } else {
        console.log("No new events found. All events are already in our database.");
    }
}

// Test function for Discord webhook
async function testDiscordWebhook() {
    if (!process.env.EVENTS_WEBHOOK_URL) {
        console.error("EVENTS_WEBHOOK_URL not defined in .env");
        return;
    }

    const testEvent = {
        title: "Test Event",
        link: "https://digitalnovascotia.com/events/",
        datetime: "June 26 @ 10:00 am - 11:00 am ADT",
        isVirtual: true,
        cost: "Free"
    };

    try {
        const discordMessage = {
            embeds: [{
                title: testEvent.title,
                url: testEvent.link,
                color: 0x3498db,
                description: `**Date & Time:** ${testEvent.datetime}\n**Event Type:** ${testEvent.isVirtual ? 'Virtual' : 'In Person'}\n**Cost:** ${testEvent.cost}`,
                footer: {
                    text: "Test Message - Digital Nova Scotia Events"
                }
            }]
        };

        const response = await axios.post(process.env.EVENTS_WEBHOOK_URL, discordMessage);
        if (response.status === 204) {
            console.log('Successfully sent test message to Discord');
        }
    } catch (error) {
        console.error('Error sending test message to Discord:', error.response?.data || error.message);
    }
}

// Run the main function
checkForNewEvents();
// Uncomment to test Discord webhook
// testDiscordWebhook(); 