require("dotenv").config();
const fs = require("fs");
const path = require("path");

const CITY = "halifax";

// Configuration for Halifax scrapers
const halifaxScrapers = {
    jobs: [
        {
            name: "halifax-dns-jobs",
            webhook: `${CITY.toUpperCase()}_JOBS_WEBHOOK_URL`
        },
        {
            name: "halifax-csds-jobs",
            webhook: `${CITY.toUpperCase()}_JOBS_WEBHOOK_URL`
        }
    ],
    events: [
        {
            name: "halifax-dns-events",
            webhook: `${CITY.toUpperCase()}_EVENTS_WEBHOOK_URL`
        }
    ]
};

async function runScrapers() {
    console.log(`\n=== Running Halifax Scrapers ===`);
    
    // Run job scrapers
    console.log("\n--- Running Job Scrapers ---");
    for (const scraper of halifaxScrapers.jobs) {
        try {
            const scraperPath = `./scrapers/${CITY}/${scraper.name}.js`;
            if (fs.existsSync(scraperPath)) {
                console.log(`\n🔄 Running ${scraper.name}...`);
                require(scraperPath);
                console.log(`✅ Completed ${scraper.name}`);
            } else {
                console.log(`❌ Scraper not found: ${scraperPath}`);
            }
        } catch (error) {
            console.error(`❌ Error running ${scraper.name}:`, error);
        }
    }

    // Run events scraper
    console.log("\n--- Running Events Scraper ---");
    try {
        const eventsScraper = halifaxScrapers.events[0];
        const scraperPath = `./scrapers/${CITY}/${eventsScraper.name}.js`;
        if (fs.existsSync(scraperPath)) {
            console.log(`\n Running ${eventsScraper.name}...`);
            require(scraperPath);
            console.log(`✅ Completed ${eventsScraper.name}`);
        } else {
            console.log(`❌ Events scraper not found: ${scraperPath}`);
        }
    } catch (error) {
        console.error(`❌ Error running events scraper:`, error);
    }
    
    console.log(`\n=== Completed Halifax Scrapers ===`);
}

// Run the main scraper
runScrapers();
