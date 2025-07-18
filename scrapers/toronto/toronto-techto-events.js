require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");

const CITY = "toronto";
const TECHTO_EVENTS_URL = "https://www.techto.org/events";
const TECHTO_EVENTS_FILE = `./data/${CITY}/${CITY}-techto-events.json`;

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

async function scrapeTechTOEvents() {
    try {
        console.log("Fetching TechTO events from:", TECHTO_EVENTS_URL);
        const { data } = await axios.get(TECHTO_EVENTS_URL);
        const $ = cheerio.load(data);
        let events = [];

        // Select events from the page
        $(".collection-item").each((i, el) => {
            const $event = $(el);
            
            // Event title
            const title = $event.find("h2, h4").text().trim();
            
            // Event link
            const link = $event.find("a.button").attr("href");
            const fullLink = link ? `https://www.techto.org${link}` : null;
            
            // Event description
            const description = $event.find(".max-width-xsmall p").text().trim();
            
            // Event date and time
            const dateElement = $event.find(".detail-container .div-block-8 p");
            const dateText = dateElement.map((j, elem) => $(elem).text().trim()).get().join(" ");
            
            // Event location
            const location = $event.find(".detail-container img[alt='Location marker'] + .div-block-9 p").text().trim();
            
            // Event price
            const price = $event.find(".detail-container img[alt='Bookmark'] + .div-block-9 p").text().trim();
            
            // Event status (Up Next, Sold Out, etc.)
            const status = $event.find(".text-style-tagline").text().trim();

            if (title && fullLink) {
                events.push({
                    title,
                    link: fullLink,
                    description,
                    date: dateText,
                    location,
                    price,
                    status
                });
                console.log(`Found TechTO event:`, { title, date: dateText, location, price });
            }
        });

        console.log(`Found ${events.length} TechTO events on the website`);
        return events;
    } catch (error) {
        console.error("Error scraping TechTO events:", error);
        return [];
    }
}

function loadPreviousTechTOEvents() {
    if (fs.existsSync(TECHTO_EVENTS_FILE)) {
        try {
            const fileContent = fs.readFileSync(TECHTO_EVENTS_FILE, 'utf8');
            if (fileContent.trim() === '') {
                console.log("File is empty, starting fresh");
                return [];
            }
            const events = JSON.parse(fileContent);
            console.log(`Loaded ${events.length} previous TechTO events`);
            return events;
        } catch (error) {
            console.log("Error reading file, starting fresh:", error.message);
            return [];
        }
    }
    console.log("No previous TechTO events file found");
    return [];
}

function saveTechTOEvents(events) {
    fs.writeFileSync(TECHTO_EVENTS_FILE, JSON.stringify(events, null, 2));
}

async function checkForNewTechTOEvents() {
    const currentEvents = await scrapeTechTOEvents();
    const previousEvents = loadPreviousTechTOEvents();
    
    console.log("\nComparing TechTO events:");
    console.log(`Current events: ${currentEvents.length}`);
    console.log(`Previous events: ${previousEvents.length}`);
    
    const newEvents = currentEvents.filter(event => 
        !previousEvents.some(prev => prev.link === event.link)
    );
    
    if (newEvents.length > 0) {
        console.log("New TechTO events found:");
        newEvents.forEach(event => {
            console.log(`- ${event.title} (${event.date})`);
        });

        saveTechTOEvents(currentEvents);
        console.log(`\nSaved ${currentEvents.length} TechTO events to ${TECHTO_EVENTS_FILE}`);
        
        // Send new events to consolidated Toronto events webhook
        const webhookUrl = process.env.TORONTO_EVENTS_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                console.log("\nSending to Discord webhook...");
                
                const chunkSize = 10;
                for (let i = 0; i < newEvents.length; i += chunkSize) {
                    const chunk = newEvents.slice(i, i + chunkSize);
                    const discordMessage = {
                        embeds: chunk.map(event => ({
                            title: event.title,
                            url: event.link,
                            color: 0xf7931a, // Bitcoin orange color for Toronto events
                            description: `**Date:** ${event.date}\n**Location:** ${event.location}\n**Price:** ${event.price}\n**Status:** ${event.status}\n\n${event.description}`,
                            footer: {
                                text: `Toronto Events - TechTO (${i + 1}-${Math.min(i + chunkSize, newEvents.length)} of ${newEvents.length})`
                            }
                        }))
                    };

                    const response = await axios.post(webhookUrl, discordMessage);
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
            console.error("TORONTO_EVENTS_WEBHOOK_URL not defined in .env");
        }
    } else {
        console.log("No new TechTO events found. All events are already in our database.");
    }
}

// Test function for Discord webhook
async function testTechTOEventsDiscordWebhook() {
    if (!process.env.TORONTO_EVENTS_WEBHOOK_URL) {
        console.error("TORONTO_EVENTS_WEBHOOK_URL not defined in .env");
        return;
    }

    const testEvent = {
        title: "Test Toronto Tech Event",
        link: "https://www.techto.org/events/",
        description: "Join TechTO for engaging conversations with tech leaders",
        date: "August 11, 2025 5:00 pm - 9:00 pm",
        location: "Auditorium - MaRS Centre, 101 College St, Toronto",
        price: "$30 Early Bird | Free for Members",
        status: "Up Next"
    };

    try {
        const discordMessage = {
            embeds: [{
                title: testEvent.title,
                url: testEvent.link,
                color: 0xf7931a,
                description: `**Date:** ${testEvent.date}\n**Location:** ${testEvent.location}\n**Price:** ${testEvent.price}\n**Status:** ${testEvent.status}\n\n${testEvent.description}`,
                footer: {
                    text: "Test Message - Toronto TechTO Events"
                }
            }]
        };

        const response = await axios.post(process.env.TORONTO_EVENTS_WEBHOOK_URL, discordMessage);
        if (response.status === 204) {
            console.log('Successfully sent test message to Discord');
        }
    } catch (error) {
        console.error('Error sending test message to Discord:', error.response?.data || error.message);
    }
}

// Run the main function
checkForNewTechTOEvents();
// Uncomment to test Discord webhook
// testTechTOEventsDiscordWebhook();
